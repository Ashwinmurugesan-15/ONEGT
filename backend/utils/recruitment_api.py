"""
guhatek_api.py – Async Python rewrite of src/lib/guhatek-api.ts
Uses httpx for async HTTP, preserves token caching, retry logic, and mock mode.
"""
import os
import time
import json
import asyncio
import logging
from typing import Any, Optional

import httpx
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env")

logger = logging.getLogger(__name__)

TOKEN_LIFETIME_S = 9 * 60  # 9 minutes (Token actually expires in 10m)

_cached_token: Optional[str] = None
_token_expiry: float = 0.0
_token_lock = None

def get_token_lock():
    global _token_lock
    if _token_lock is None:
        _token_lock = asyncio.Lock()
    return _token_lock


def _get_config() -> dict:
    return {
        "api_url": os.getenv("GUHATEK_API_URL", "").strip().rstrip("/"),
        "api_key": os.getenv("GUHATEK_API_KEY", "").strip(),
        "use_mock": False,
    }



# ---------------------------------------------------------------------------
# Auth token
# ---------------------------------------------------------------------------

async def _get_auth_token() -> str:
    global _cached_token, _token_expiry
    cfg = _get_config()

    if cfg["use_mock"]:
        return f"mock-token-{int(time.time())}"

    async with get_token_lock():
        if _cached_token and time.time() < _token_expiry:
            return _cached_token

        if not cfg["api_url"] or not cfg["api_key"]:
            raise RuntimeError("GUHATEK_API_URL or GUHATEK_API_KEY is not configured")

        try:
            logger.info(f"Attempting to fetch API token from URL: {cfg['api_url']}/api/token with API key length: {len(cfg['api_url'])}")
            async with httpx.AsyncClient(verify=False, timeout=15) as client:
                resp = await client.get(
                    f"{cfg['api_url']}/api/token",
                    headers={"x-api-key": cfg["api_key"]},
                )
                resp.raise_for_status()
                data = resp.json()
                _cached_token = data["token"]
                _token_expiry = time.time() + TOKEN_LIFETIME_S
                logger.info("✅ Auth token fetched and cached")
                return _cached_token  # type: ignore[return-value]
        except Exception as exc:
            logger.error("❌ Auth Token Fetch Error details:", exc_info=True)
            raise RuntimeError("API_CONNECTION_FAILED: Unable to reach Guhatek API.") from exc

    raise RuntimeError("Unreachable: token fetch failed without raising")  # satisfy type checker


def clear_token_cache() -> None:
    global _cached_token, _token_expiry
    _cached_token = None
    _token_expiry = 0.0


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

async def _authed_request(
    method: str,
    path: str,
    retries: int = 2,
    base_delay: float = 1.0,
    **kwargs,
) -> Any:
    cfg = _get_config()
    url = f"{cfg['api_url']}{path}"

    for attempt in range(retries + 1):
        try:
            token = await _get_auth_token()
            headers = kwargs.get("headers", {})
            headers["Authorization"] = f"Bearer {token}"
            
            # Ensure headers is passed back into kwargs if we modified it
            kwargs["headers"] = headers

            async with httpx.AsyncClient(verify=False, timeout=20) as client:
                resp = await client.request(method, url, **kwargs)

            # Handle Rate Limiting (429) and Server Errors (5xx) with retries
            if (resp.status_code == 429 or resp.status_code >= 500) and attempt < retries:
                delay = base_delay * (2 ** attempt)  # Exponential backoff: 1s, 2s...
                logger.warning(f"⚠️ Guhatek API {resp.status_code}, retrying in {delay}s (%d left)…", retries - attempt)
                await asyncio.sleep(delay)
                continue

            if resp.status_code == 401:
                # Token may be stale – clear and retry once
                clear_token_cache()
                if attempt < retries:
                    continue

            resp.raise_for_status()
            return resp.json()
            
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 429 and attempt >= retries:
                logger.error("❌ Guhatek API rate limit exceeded after retries")
                # Return a structured error that the router can pass through
                return {"success": False, "status": 429, "error": "Too many requests", "message": "Upstream API rate limit exceeded. Please try again later."}
            if attempt >= retries:
                raise
        except Exception as exc:
            if attempt >= retries:
                logger.error(f"❌ Guhatek API request failed: {exc}")
                raise

    return None


def _extract_list(data: Any, *keys: str) -> list:
    if isinstance(data, list):
        return data
    for k in keys:
        if isinstance(data.get(k), list):
            return data[k]
    return []


# ---------------------------------------------------------------------------
# Applications
# ---------------------------------------------------------------------------

async def get_applications() -> list:
    cfg = _get_config()
    if cfg["use_mock"]:
        return [
            {"id": "1", "full_name": "Alice Mock", "email": "alice@example.com",
             "contact_number": "1234567890", "interested_position": "Frontend Dev",
             "application_status": "applied", "submitted_at": "2026-01-01T00:00:00Z"},
        ]
    data = await _authed_request("GET", "/api/applications", retries=1)
    return _extract_list(data, "data", "applications")


_debug_logged = False

def _normalize_job_opening(job: dict) -> dict:
    """
    Maps a Guhatek job opening (snake_case) to the frontend Job Postings model.
    Confirmed Guhatek fields: job_title, role, experience, location,
    number_of_openings, required_skills, status, created_at, updated_at
    """
    # Guhatek uses snake_case field names
    title = (
        job.get("job_title")
        or job.get("jobTitle")
        or job.get("title")
        or "Untitled Role"
    )

    # Guhatek status is uppercase: "OPEN", "CLOSED", "ON_HOLD", "DELETED"
    raw_status = str(job.get("status") or job.get("jobStatus") or "OPEN")
    status = raw_status.lower().replace("_", " ")  # "ON HOLD", "open", "closed"
    # Normalise back to frontend expected values
    if "hold" in status:
        status = "on_hold"
    elif status in ("closed", "deleted"):
        status = status
    else:
        status = "open"

    skills_raw = (
        job.get("required_skills")
        or job.get("requireSkill")
        or job.get("skills")
        or []
    )
    skills = skills_raw if isinstance(skills_raw, list) else []

    created_at = job.get("created_at") or job.get("createdAt") or time.strftime("%Y-%m-%dT%H:%M:%SZ")
    openings = int(
        job.get("number_of_openings")
        or job.get("numberOfOpenings")
        or job.get("openings")
        or 1
    )

    return {
        "id": str(job.get("id", "")),
        "title": title,
        "role": job.get("role", "") or title,
        "experience": job.get("experience", "Not Specified"),
        "location": job.get("location", "Remote"),
        "openings": openings,
        "skills": skills,
        "status": status,
        "createdAt": created_at,

        # Enhanced fields (will be set when Guhatek stores them, else smart defaults)
        "department": job.get("department", "Software-Development"),
        "roleCategory": job.get("roleCategory") or job.get("role") or "Engineering",
        "level": job.get("level", "Mid"),
        "employmentType": job.get("employmentType", "Full-time"),
        "workMode": job.get("workMode", "Onsite"),
        "salary": job.get("salary", "Competitive"),
        "description": job.get("description", f"We are looking for a {title} to join our team."),
        "responsibilities": job.get("responsibilities", ["Contribute to core projects", "Collaborate with team members"]),
        "requirements": job.get("requirements", skills),
        "niceToHave": job.get("niceToHave", []),
        "businessImpact": job.get("businessImpact", []),
        "isActive": status not in ["closed", "deleted"],
        "postedDate": job.get("postedDate") or created_at[:10],
    }


async def insert_application(file_bytes: bytes, filename: str, application_data: dict) -> Optional[dict]:
    cfg = _get_config()
    if cfg["use_mock"]:
        return {"success": True, "id": f"mock-id-{int(time.time())}"}
    token = await _get_auth_token()
    async with httpx.AsyncClient(verify=False, timeout=30) as client:
        resp = await client.post(
            f"{cfg['api_url']}/api/applications",
            headers={"Authorization": f"Bearer {token}"},
            files={"file": (filename, file_bytes)},
            data={"applicationData": json.dumps(application_data)},
        )
        print(f"DEBUG: Guhatek /api/applications response status: {resp.status_code}")
        print(f"DEBUG: Guhatek /api/applications response body: {resp.text[:2000]}")

        # Parse response body for user-friendly error messages
        if not resp.is_success:
            try:
                error_body = resp.json()
                error_msg = error_body.get("message", f"Guhatek API error: {resp.status_code}")
            except Exception:
                error_msg = f"Guhatek API error: {resp.status_code}"
            raise httpx.HTTPStatusError(
                error_msg,
                request=resp.request,
                response=resp
            )

        return resp.json()


async def update_application(app_id: str, updates: dict) -> Optional[dict]:
    cfg = _get_config()
    if cfg["use_mock"]:
        return {"success": True}
    data = await _authed_request(
        "PATCH", f"/api/applications/{app_id}",
        json=updates,
    )
    return data


async def delete_application(app_id: str) -> Optional[dict]:
    cfg = _get_config()
    if cfg["use_mock"]:
        return {"success": True}
    data = await _authed_request("DELETE", f"/api/applications/{app_id}")
    return data


# ---------------------------------------------------------------------------
# Job Openings / Demands
# ---------------------------------------------------------------------------

async def get_job_openings() -> list:
    cfg = _get_config()
    if cfg["use_mock"]:
        return []
    data = await _authed_request("GET", "/api/applications/jobOpenings", retries=1)
    raw_list = _extract_list(data, "data", "jobOpenings")
    return [_normalize_job_opening(j) for j in raw_list]


async def create_demand(job_opening: dict) -> Optional[dict]:
    cfg = _get_config()
    if cfg["use_mock"]:
        return {"success": True, "id": f"mock-demand-{int(time.time())}"}
    token = await _get_auth_token()
    async with httpx.AsyncClient(verify=False, timeout=20) as client:
        resp = await client.post(
            f"{cfg['api_url']}/api/applications/createDemand",
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            json={"jobOpening": json.dumps(job_opening)},
        )
        if not resp.is_success:
            err = resp.json() if resp.headers.get("content-type", "").startswith("application/json") else {"message": resp.text}
            return {"success": False, "error": err.get("error", "Bad Request"), "message": err.get("message"), "status": resp.status_code}
        data = resp.json()
        return {"success": True, "id": data.get("id")}


async def update_demand(demand_id: str, updates: dict) -> Optional[dict]:
    cfg = _get_config()
    if cfg["use_mock"]:
        return {"success": True, "updated": {}}
    token = await _get_auth_token()
    async with httpx.AsyncClient(verify=False, timeout=20) as client:
        url = f"{cfg['api_url']}/api/applications/{demand_id}/updateDemand"
        logger.info(f"Sending PATCH to {url} with payload: {updates}")
        resp = await client.patch(
            url,
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            json=updates,
        )
        logger.info(f"Guhatek PATCH response status: {resp.status_code}, body: {resp.text}")
        if not resp.is_success:
            err = resp.json() if resp.headers.get("content-type", "").startswith("application/json") else {"message": resp.text}
            return {"success": False, "error": err.get("error"), "message": err.get("message"), "status": resp.status_code}
        data = resp.json()
        return {"success": True, "updated": data.get("updated", {})}


async def delete_demand(demand_id: str) -> Optional[dict]:
    """
    Deletes a job demand.
    Note: The Guhatek API's direct DELETE endpoint /api/applications/{id}/deleteDemand 
    returns 404. We perform a 'soft-delete' by updating the status to 'Deleted'.
    """
    return await update_demand(demand_id, {"jobStatus": "Deleted"})


# ---------------------------------------------------------------------------
# Scheduled Meetings / Interviews
# ---------------------------------------------------------------------------

async def get_scheduled_meetings() -> list:
    cfg = _get_config()
    if cfg["use_mock"]:
        return []
    data = await _authed_request("GET", "/api/applications/scheduleMeet", retries=1)
    return _extract_list(data, "data", "meetings")


async def schedule_meet(meeting_data: dict) -> Optional[dict]:
    cfg = _get_config()
    if cfg["use_mock"]:
        return {"success": True, "id": f"mock-meet-{int(time.time())}"}
    token = await _get_auth_token()
    async with httpx.AsyncClient(verify=False, timeout=20) as client:
        payload = {"scheduleMeeting": json.dumps(meeting_data)}
        print(f"DEBUG schedule_meet payload being sent: {json.dumps(payload)}")
        resp = await client.post(
            f"{cfg['api_url']}/api/applications/scheduleMeet",
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            json=payload,
        )
        if not resp.is_success:
            err = resp.json() if resp.headers.get("content-type", "").startswith("application/json") else {"message": resp.text}
            print(f"DEBUG schedule_meet Failed. Status: {resp.status_code}, Response: {err}")
            return {"success": False, "error": err.get("error", "Bad Request"), "message": err.get("message"), "status": resp.status_code}
        data = resp.json()
        return {"success": True, "id": data.get("id")}


async def update_meet(meet_id: str, updates: dict) -> Optional[dict]:
    cfg = _get_config()
    if cfg["use_mock"]:
        return {"success": True, "updated": {}}
    token = await _get_auth_token()
    async with httpx.AsyncClient(verify=False, timeout=20) as client:
        resp = await client.patch(
            f"{cfg['api_url']}/api/applications/{meet_id}/updateMeet",
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            json=updates,
        )
        if not resp.is_success:
            err = resp.json() if resp.headers.get("content-type", "").startswith("application/json") else {"message": resp.text}
            return {"success": False, "error": err.get("error"), "message": err.get("message"), "status": resp.status_code}
        data = resp.json()
        return {"success": True, "updated": data.get("updated", {})}
