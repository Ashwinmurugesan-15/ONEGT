"""
Assessment Database Utility - PostgreSQL connection pool and helper functions.
Ported from Assessment-Portal-1/backend/database.py and db.py.
"""
import os
import json
import uuid
import logging
from datetime import datetime, timezone
from typing import Any, List, Optional, Dict
from urllib.parse import urlparse, parse_qs, urlencode, urlunparse

import pg8000
import pg8000.dbapi
from config import settings

logger = logging.getLogger("chrms.assessment.db")

def _get_clean_url_and_schema(url: str):
    schema_name = None
    clean_url = url
    if "?schema=" in url:
        parsed = urlparse(url)
        qs = parse_qs(parsed.query)
        schema_name = qs.pop("schema", [None])[0]
        new_query = urlencode(qs, doseq=True)
        clean_url = urlunparse(parsed._replace(query=new_query))
    return clean_url, schema_name

# In Cloudflare Workers, we don't use a long-lived pool.
# We open a connection per request or use a simple singleton for local dev.
_conn = None

def get_conn():
    global _conn
    url, schema = _get_clean_url_and_schema(settings.ASSESSMENT_DATABASE_URL)
    parsed = urlparse(url)

    # Extract connection parameters from URL
    # format: postgresql://[user[:password]@][host][:port]/database
    user = parsed.username
    password = parsed.password
    host = parsed.hostname
    port = parsed.port or 5432
    database = parsed.path.lstrip('/')

    conn = pg8000.dbapi.connect(
        user=user,
        password=password,
        host=host,
        port=port,
        database=database,
        ssl_context=None # Changed from True to None to allow local YugabyteDB/Postgres without SSL
    )

    if schema:
        cur = conn.cursor()
        try:
            cur.execute(f"SET search_path TO {schema},public")
        finally:
            cur.close()

    return conn

def put_conn(conn):
    try:
        conn.close()
    except:
        pass

class DictCursor:
    """Helper to simulate RealDictCursor behavior with pg8000."""
    def __init__(self, cursor):
        self.cursor = cursor

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.cursor.close()

    def execute(self, query, params=None):
        return self.cursor.execute(query, params)

    def fetchone(self):
        row = self.cursor.fetchone()
        if not row: return None
        columns = [col[0] for col in self.cursor.description]
        return dict(zip(columns, row))

    def fetchall(self):
        rows = self.cursor.fetchall()
        columns = [col[0] for col in self.cursor.description]
        return [dict(zip(columns, row)) for row in rows]

def init_db():
    """Run assessment_schema.sql to create tables if they don't exist."""
    schema_path = os.path.join(
        os.path.dirname(os.path.dirname(__file__)), "database", "assessment_schema.sql"
    )
    conn = get_conn()
    try:
        cur = conn.cursor()
        try:
            if os.path.exists(schema_path):
                with open(schema_path, "r") as f:
                    cur.execute(f.read())
                conn.commit()
                logger.info("✅ Assessment database schema initialized")
            else:
                logger.warning(f"⚠️ Assessment schema file not found at {schema_path}")
        finally:
            cur.close()
    except Exception as e:
        conn.rollback()
        logger.error(f"❌ Assessment schema init error: {e}")
    finally:
        put_conn(conn)

# uuid registration not needed for pg8000 as it handles it or we use strings

def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

def _gen_id() -> str:
    return str(uuid.uuid4())

def _serialise(obj: Any) -> Any:
    from datetime import datetime
    import uuid
    if isinstance(obj, datetime):
        return obj.isoformat()
    if isinstance(obj, uuid.UUID):
        return str(obj)
    return obj

def _parse_json(val: Any) -> Any:
    if isinstance(val, str):
        try:
            return json.loads(val)
        except:
            return val
    return val

# --- User Management ---
def create_user(user: dict) -> dict:
    conn = get_conn()
    try:
        with DictCursor(conn.cursor()) as cur:
            cur.execute(
                """INSERT INTO users
                   (id, name, email, password, role, created_at, is_first_login, assigned_assessments, created_assessments)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING *""",
                (
                    user["id"], user["name"], user["email"], user["password"],
                    user["role"], user.get("created_at", _now_iso()),
                    user.get("is_first_login", True),
                    user.get("assigned_assessments"),
                    user.get("created_assessments")
                )
            )
            row = cur.fetchone()
        conn.commit()
        return row
    finally:
        put_conn(conn)

def get_user_by_email(email: str) -> Optional[dict]:
    conn = get_conn()
    try:
        with DictCursor(conn.cursor()) as cur:
            cur.execute("SELECT * FROM users WHERE email = %s", (email,))
            row = cur.fetchone()
        return row
    finally:
        put_conn(conn)

def get_user_by_id(uid: str) -> Optional[dict]:
    conn = get_conn()
    try:
        with DictCursor(conn.cursor()) as cur:
            cur.execute("SELECT * FROM users WHERE id = %s", (uid,))
            row = cur.fetchone()
        return row
    finally:
        put_conn(conn)

def get_all_users() -> List[dict]:
    conn = get_conn()
    try:
        with DictCursor(conn.cursor()) as cur:
            cur.execute("SELECT * FROM users")
            return cur.fetchall()
    finally:
        put_conn(conn)

def get_users_by_role(role: str) -> List[dict]:
    conn = get_conn()
    try:
        with DictCursor(conn.cursor()) as cur:
            cur.execute("SELECT * FROM users WHERE role = %s", (role,))
            return cur.fetchall()
    finally:
        put_conn(conn)

def update_user(uid: str, updates: dict) -> Optional[dict]:
    if not updates: return None
    fields = list(updates.keys())
    values = list(updates.values())
    set_clause = ", ".join(f"{f} = %s" for f in fields)
    conn = get_conn()
    try:
        with DictCursor(conn.cursor()) as cur:
            cur.execute(f"UPDATE users SET {set_clause} WHERE id = %s RETURNING *", (*values, uid))
            row = cur.fetchone()
        conn.commit()
        return row
    finally:
        put_conn(conn)

def upsert_user_from_token(token_data: Any) -> dict:
    """Sync user from OneGT TokenData to Assessment DB."""
    # Map roles
    role_map = {
        "Admin": "admin",
        "Project Manager": "examiner",
        "HR": "admin",
        "Operations Manager": "admin",
        "Associate": "candidate"
    }
    role = role_map.get(token_data.role, "candidate")

    user = get_user_by_id(token_data.associate_id)
    if user:
        # Update if role changed or name changed
        if user["role"] != role or user["name"] != token_data.name:
            return update_user(token_data.associate_id, {"role": role, "name": token_data.name})
        return user
    else:
        # Create new user
        return create_user({
            "id": token_data.associate_id,
            "name": token_data.name,
            "email": token_data.email,
            "password": "SET_BY_OAUTH", # Authentication is handled by main OneGT
            "role": role,
            "is_first_login": False
        })

def delete_user(uid: str) -> bool:
    conn = get_conn()
    try:
        cur = conn.cursor()
        try:
            cur.execute("UPDATE assessments SET assigned_to = array_remove(assigned_to, %s) WHERE %s = ANY(assigned_to)", (uid, uid))
            cur.execute("DELETE FROM users WHERE id = %s", (uid,))
            conn.commit()
        finally:
            cur.close()
        return True
    finally:
        put_conn(conn)

# --- Assessment Management ---
def save_assessment(a: dict) -> None:
    conn = get_conn()
    try:
        cur = conn.cursor()
        try:
            cur.execute(
                """INSERT INTO assessments
                   (assessment_id, title, description, difficulty, questions, created_by, created_at, scheduled_for, scheduled_from, scheduled_to, duration_minutes, assigned_to, retake_permissions)
                   VALUES (%s, %s, %s, %s, %s::jsonb, %s, %s, %s, %s, %s, %s, %s, %s)""",
                (
                    a["assessment_id"], a["title"], a.get("description"), a.get("difficulty"),
                    json.dumps(a["questions"]), a["created_by"], a.get("created_at", _now_iso()),
                    a.get("scheduled_for"), a.get("scheduled_from"), a.get("scheduled_to"),
                    a.get("duration_minutes"), a.get("assigned_to", []), a.get("retake_permissions", [])
                )
            )
            conn.commit()
        finally:
            cur.close()
    finally:
        put_conn(conn)

def get_assessment(aid: str) -> Optional[dict]:
    conn = get_conn()
    try:
        with DictCursor(conn.cursor()) as cur:
            cur.execute("SELECT * FROM assessments WHERE assessment_id = %s", (aid,))
            row = cur.fetchone()
        if not row: return None
        row["questions"] = _parse_json(row["questions"])
        return row
    finally:
        put_conn(conn)

def get_all_assessments() -> List[dict]:
    conn = get_conn()
    try:
        with DictCursor(conn.cursor()) as cur:
            cur.execute("SELECT * FROM assessments ORDER BY created_at DESC")
            rows = cur.fetchall()
        return [{**r, "questions": _parse_json(r["questions"])} for r in rows]
    finally:
        put_conn(conn)

def get_assessments_by_candidate(candidate_id: str) -> List[dict]:
    conn = get_conn()
    try:
        with DictCursor(conn.cursor()) as cur:
            cur.execute("SELECT * FROM assessments WHERE %s = ANY(assigned_to) ORDER BY created_at DESC", (candidate_id,))
            rows = cur.fetchall()
        return [{**r, "questions": _parse_json(r["questions"])} for r in rows]
    finally:
        put_conn(conn)

def get_assessments_by_examiner(examiner_id: str) -> List[dict]:
    conn = get_conn()
    try:
        with DictCursor(conn.cursor()) as cur:
            cur.execute("SELECT id FROM users WHERE role = %s", ("admin",))
            admin_ids = [r["id"] for r in cur.fetchall()]
            ids = [examiner_id] + admin_ids
            cur.execute("SELECT * FROM assessments WHERE created_by = ANY(%s) ORDER BY created_at DESC", (ids,))
            rows = cur.fetchall()
        return [{**dict(r), "questions": _parse_json(r["questions"])} for r in rows]
    finally:
        put_conn(conn)

def update_assessment(aid: str, updates: dict) -> Optional[dict]:
    if not updates: return None
    fields = list(updates.keys())
    values = list(updates.values())
    parts = []
    for i, f in enumerate(fields):
        if f == "questions":
            values[i] = json.dumps(values[i])
            parts.append(f"{f} = %s::jsonb")
        else:
            parts.append(f"{f} = %s")
    set_clause = ", ".join(parts)
    conn = get_conn()
    try:
        with DictCursor(conn.cursor()) as cur:
            cur.execute(f"UPDATE assessments SET {set_clause} WHERE assessment_id = %s RETURNING *", (*values, aid))
            row = cur.fetchone()
        conn.commit()
        if not row: return None
        row["questions"] = _parse_json(row["questions"])
        return row
    finally:
        put_conn(conn)

def delete_assessment(aid: str) -> bool:
    conn = get_conn()
    try:
        cur = conn.cursor()
        try:
            cur.execute("DELETE FROM assessments WHERE assessment_id = %s", (aid,))
            conn.commit()
        finally:
            cur.close()
        return True
    finally:
        put_conn(conn)

# --- Results Management ---
def save_result(result: dict) -> None:
    conn = get_conn()
    try:
        cur = conn.cursor()
        try:
            cur.execute("SELECT id FROM results WHERE assessment_id = %s AND user_id = %s AND (result->>'total_questions')::int = 0", (result["assessment_id"], result["user_id"]))
            placeholder = cur.fetchone()
            if placeholder:
                cur.execute("UPDATE results SET result = %s::jsonb, timestamp = %s WHERE id = %s", (json.dumps(result), _now_iso(), placeholder[0]))
            else:
                cur.execute("INSERT INTO results (assessment_id, user_id, result, timestamp) VALUES (%s, %s, %s::jsonb, %s)", (result["assessment_id"], result["user_id"], json.dumps(result), _now_iso()))
            conn.commit()
        finally:
            cur.close()
    finally:
        put_conn(conn)

def get_results(assessment_id: str) -> List[dict]:
    conn = get_conn()
    try:
        with DictCursor(conn.cursor()) as cur:
            cur.execute("SELECT * FROM results WHERE assessment_id = %s ORDER BY timestamp DESC", (assessment_id,))
            rows = cur.fetchall()
        return [{**r, "result": _parse_json(r["result"])} for r in rows]
    finally:
        put_conn(conn)

def get_results_by_user(user_id: str) -> List[dict]:
    conn = get_conn()
    try:
        with DictCursor(conn.cursor()) as cur:
            cur.execute("SELECT * FROM results WHERE user_id = %s ORDER BY timestamp DESC", (user_id,))
            rows = cur.fetchall()
        return [{**r, "result": _parse_json(r["result"])} for r in rows]
    finally:
        put_conn(conn)

def get_all_results() -> List[dict]:
    conn = get_conn()
    try:
        with DictCursor(conn.cursor()) as cur:
            cur.execute("SELECT * FROM results ORDER BY timestamp DESC")
            rows = cur.fetchall()
        return [{**dict(r), "result": _parse_json(r["result"])} for r in rows]
    finally:
        put_conn(conn)

def get_user_attempt_count(assessment_id: str, user_id: str) -> int:
    conn = get_conn()
    try:
        cur = conn.cursor()
        try:
            cur.execute("SELECT COUNT(*) FROM results WHERE assessment_id = %s AND user_id = %s AND (result->>'total_questions')::int > 0", (assessment_id, user_id))
            return cur.fetchone()[0]
        finally:
            cur.close()
    finally:
        put_conn(conn)

def mark_assessment_started(assessment_id: str, user_id: str) -> None:
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM results WHERE assessment_id = %s AND user_id = %s", (assessment_id, user_id))
            if cur.fetchone(): return
            placeholder = {
                "assessment_id": assessment_id, "user_id": user_id, "score": 0, "max_score": 100,
                "total_questions": 0, "correct_count": 0, "detailed": [],
                "analytics": {"time_taken_seconds": 0, "accuracy_percent": 0, "avg_time_per_question_seconds": 0},
                "graded_at": _now_iso()
            }
            cur.execute("INSERT INTO results (assessment_id, user_id, result, timestamp) VALUES (%s, %s, %s::jsonb, %s)", (assessment_id, user_id, json.dumps(placeholder), _now_iso()))
        conn.commit()
    finally:
        put_conn(conn)

# --- Learning Resources ---
def create_learning_resource(resource: dict) -> dict:
    now = _now_iso()
    conn = get_conn()
    try:
        with DictCursor(conn.cursor()) as cur:
            cur.execute(
                """INSERT INTO learning_resources (id, title, description, course_url, url_type, image_url, created_by, created_at, updated_at)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING *""",
                (resource["id"], resource["title"], resource["description"], resource["course_url"], resource["url_type"], resource.get("image_url"), resource["created_by"], now, now)
            )
            row = cur.fetchone()
        conn.commit()
        return row
    finally:
        put_conn(conn)

def get_all_learning_resources() -> List[dict]:
    conn = get_conn()
    try:
        with DictCursor(conn.cursor()) as cur:
            cur.execute("SELECT * FROM learning_resources ORDER BY created_at DESC")
            return cur.fetchall()
    finally:
        put_conn(conn)

def update_learning_resource(rid: str, updates: dict) -> Optional[dict]:
    if not updates: return None
    updates["updated_at"] = _now_iso()
    fields = list(updates.keys())
    values = list(updates.values())
    set_clause = ", ".join(f"{f} = %s" for f in fields)
    conn = get_conn()
    try:
        with DictCursor(conn.cursor()) as cur:
            cur.execute(f"UPDATE learning_resources SET {set_clause} WHERE id = %s RETURNING *", (*values, rid))
            row = cur.fetchone()
        conn.commit()
        return row
    finally:
        put_conn(conn)

def delete_learning_resource(rid: str) -> bool:
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM learning_resources WHERE id = %s", (rid,))
        conn.commit()
        return True
    finally:
        put_conn(conn)

def get_learning_resource(rid: str) -> Optional[dict]:
    conn = get_conn()
    try:
        with DictCursor(conn.cursor()) as cur:
            cur.execute("SELECT * FROM learning_resources WHERE id = %s", (rid,))
            row = cur.fetchone()
        return row
    finally:
        put_conn(conn)

def save_learning_progress(user_id: str, resource_id: str) -> None:
    now = _now_iso()
    id = f"{user_id}_{resource_id}"
    conn = get_conn()
    try:
        cur = conn.cursor()
        try:
            cur.execute(
                """INSERT INTO learning_progress (id, user_id, resource_id, viewed_at, updated_at)
                   VALUES (%s, %s, %s, %s, %s)
                       ON CONFLICT (user_id, resource_id) 
                   DO UPDATE SET updated_at = %s, viewed_at = %s""",
                (id, user_id, resource_id, now, now, now, now)
            )
            conn.commit()
        finally:
            cur.close()
    finally:
        put_conn(conn)

def get_user_learning_progress(user_id: str) -> List[dict]:
    conn = get_conn()
    try:
        with DictCursor(conn.cursor()) as cur:
            cur.execute("SELECT resource_id, viewed_at, updated_at FROM learning_progress WHERE user_id = %s", (user_id,))
            return cur.fetchall()
    finally:
        put_conn(conn)

def get_resource_view_analytics(resource_id: str) -> List[dict]:
    conn = get_conn()
    try:
        with DictCursor(conn.cursor()) as cur:
            cur.execute(
                """SELECT lp.user_id, u.name as user_name, u.email as user_email, lp.viewed_at
                   FROM learning_progress lp
                            JOIN users u ON lp.user_id = u.id
                   WHERE lp.resource_id = %s
                   ORDER BY lp.viewed_at DESC""",
                (resource_id,)
            )
            return cur.fetchall()
    finally:
        put_conn(conn)
