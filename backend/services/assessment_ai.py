"""
Assessment AI Service - Parses uploaded files and generates questions.
Ported from Assessment-Portal-1/backend/ai_service.py.
"""
import csv
import io
import re
import uuid
from typing import List, Dict, Any, Optional

def _gen_id() -> str:
    return str(uuid.uuid4())

# --- CSV parser ---
def _parse_csv(content: str) -> List[Dict[str, Any]]:
    """Parse CSV content following Question,Option_A,...,Answer format."""
    reader = csv.DictReader(io.StringIO(content))
    questions: List[Dict[str, Any]] = []

    for raw_row in reader:
        # Normalise keys
        row: Dict[str, str] = {}
        for k, v in raw_row.items():
            normalised = re.sub(r"[\s]+", "_", k.strip().lower())
            normalised = re.sub(r"[.()]", "", normalised)
            row[normalised] = (v or "").strip()

        q_text = row.get("question") or row.get("text") or row.get("q") or row.get("question_text") or ""
        opt_a = row.get("option_a") or row.get("optiona") or row.get("a") or row.get("option_1") or ""
        opt_b = row.get("option_b") or row.get("optionb") or row.get("b") or row.get("option_2") or ""
        opt_c = row.get("option_c") or row.get("optionc") or row.get("c") or row.get("option_3") or ""
        opt_d = row.get("option_d") or row.get("optiond") or row.get("d") or row.get("option_4") or ""
        answer = (row.get("answer") or row.get("correct") or row.get("correct_option") or row.get("ans") or "").upper()

        if q_text:
            options = [o for o in [
                {"id": "A", "text": opt_a},
                {"id": "B", "text": opt_b},
                {"id": "C", "text": opt_c},
                {"id": "D", "text": opt_d},
            ] if o["text"]]
            questions.append({
                "id": _gen_id(),
                "text": q_text,
                "options": options,
                "correct_option_id": answer if answer in ("A", "B", "C", "D") else "A",
                "meta": {"source_file": "uploaded_file", "difficulty": "medium"},
            })
    return questions

# --- Heuristic text parser ---
def _parse_text(content: str) -> List[Dict[str, Any]]:
    """Parse plain-text MCQ content with regex heuristics."""
    if not content or not content.strip():
        return [{
            "id": _gen_id(),
            "text": "Parsing Failed: No text could be read from the file.",
            "options": [
                {"id": "A", "text": "Use a text-based PDF"},
                {"id": "B", "text": "Convert to .txt file"},
                {"id": "C", "text": "Type questions manually"},
                {"id": "D", "text": "Use OCR software first"},
            ],
            "correct_option_id": "A",
            "meta": {"source_file": "uploaded_file", "difficulty": "medium"},
        }]

    lines = [l.strip() for l in content.splitlines() if l.strip()]
    questions: List[Dict[str, Any]] = []
    current: Optional[Dict[str, Any]] = None

    q_re = re.compile(r"^(?:Q\s*\d+|Question\s*\d+|\d+)\s*[.:)]\s*(.+)", re.I)
    opt_re = re.compile(r"^\s*([A-Da-d])\s*[.:)]\s*(.+)")
    ans_re = re.compile(r"^\s*(?:Ans|Answer|Correct|Correct\s*Option|Correct\s*Answer|Answer\s*Key)[\s:-]*([A-D])", re.I)

    for line in lines:
        if re.match(r"^\d+$", line) or re.match(r"^Page\s+\d+", line, re.I):
            continue
        m_ans = ans_re.match(line)
        if m_ans and current:
            current["correct_option_id"] = m_ans.group(1).upper()
            continue
        m_opt = opt_re.match(line)
        if m_opt and current:
            current.setdefault("options", []).append({
                "id": m_opt.group(1).upper(),
                "text": m_opt.group(2).strip(),
            })
            continue
        m_q = q_re.match(line)
        if m_q:
            if current and current.get("text") and len(current.get("options", [])) > 1:
                current.setdefault("correct_option_id", current["options"][0]["id"])
                questions.append(current)
            current = {
                "id": _gen_id(),
                "text": m_q.group(1).strip(),
                "options": [],
                "meta": {"source_file": "uploaded_file", "difficulty": "medium"},
            }
            continue
        if current and not current.get("options"):
            current["text"] += " " + line

    if current and current.get("text") and len(current.get("options", [])) > 1:
        current.setdefault("correct_option_id", current["options"][0]["id"])
        questions.append(current)

    if not questions:
        return [{
            "id": _gen_id(),
            "text": f"Parsing Failed. Preview: {content[:500]}",
            "options": [
                {"id": "A", "text": "Format your file correctly"},
                {"id": "B", "text": "Use standard numbering"},
                {"id": "C", "text": 'Check for "Answer:" lines'},
                {"id": "D", "text": "Try converting to text file"},
            ],
            "correct_option_id": "A",
            "meta": {"source_file": "uploaded_file", "difficulty": "medium"},
        }]

    return questions

# --- Mock question generator ---
def _generate_mock(prompt: str) -> List[Dict[str, Any]]:
    topic_m = re.search(r"about\s+([^,.;!]+)", prompt, re.I) or re.search(r"on\s+([^,.;!]+)", prompt, re.I)
    topic = topic_m.group(1).strip() if topic_m else "General Knowledge"
    count_m = re.search(r"(\d+)\s+(?:mcq|questions?)", prompt, re.I)
    count = int(count_m.group(1)) if count_m else 3

    templates = [
        {"text": f"What is the primary purpose of {topic}?",
         "options": [{"id":"A","text":"To improve performance"},{"id":"B","text":"To increase complexity"},{"id":"C","text":"To reduce security"},{"id":"D","text":"None of the above"}],
         "correct": "A",
         "explanation": f"{topic} is mainly used to optimize and improve system performance."},
        {"text": f"Which of the following is a key feature of {topic}?",
         "options": [{"id":"A","text":"Manual memory management"},{"id":"B","text":"Scalability and flexibility"},{"id":"C","text":"Single-threaded execution only"},{"id":"D","text":"Requires expensive hardware"}],
         "correct": "B",
         "explanation": f"Scalability is one of the defining features of {topic}."},
        {"text": f"When should you use {topic} in a project?",
         "options": [{"id":"A","text":"Never, it is deprecated"},{"id":"B","text":"Only for small scripts"},{"id":"C","text":"When you need robust data handling"},{"id":"D","text":"For styling only"}],
         "correct": "C",
         "explanation": f"{topic} is ideal for scenarios requiring strong data management capabilities."},
        {"text": f"What is a common misconception about {topic}?",
         "options": [{"id":"A","text":"It is easy to learn"},{"id":"B","text":"It is only for frontend"},{"id":"C","text":"It does not support async operations"},{"id":"D","text":"It is extremely slow"}],
         "correct": "B",
         "explanation": f"Many people incorrectly assume {topic} is limited to a specific domain."},
        {"text": f"How does {topic} handle errors?",
         "options": [{"id":"A","text":"It ignores them"},{"id":"B","text":"Using try-catch blocks"},{"id":"C","text":"By crashing the system"},{"id":"D","text":"It does not have error handling"}],
         "correct": "B",
         "explanation": f"Standard error handling in {topic} involves try-catch mechanisms."},
    ]

    out: List[Dict[str, Any]] = []
    for i in range(count):
        t = templates[i % len(templates)]
        diff = "hard" if i % 3 == 0 else ("medium" if i % 2 == 0 else "easy")
        out.append({
            "id": _gen_id(),
            "text": f"Q{i+1}: {t['text']}",
            "options": [dict(o) for o in t["options"]],
            "correct_option_id": t["correct"],
            "explanation": t["explanation"],
            "meta": {"difficulty": diff},
        })
    return out

# --- Public entry point ---
def generate_questions(prompt: str, file_content: Optional[str] = None) -> List[Dict[str, Any]]:
    if file_content:
        clean = file_content.lstrip("\ufeff")
        first_line = clean.split("\n")[0].lower()
        is_csv = "question" in first_line and ("option_a" in first_line or "option a" in first_line)
        if is_csv:
            return _parse_csv(clean)
        return _parse_text(clean)

    if prompt and prompt.strip():
        return _generate_mock(prompt)

    return []
