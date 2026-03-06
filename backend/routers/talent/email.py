"""
routes/email.py
POST /api/email/send
"""
from fastapi import APIRouter, HTTPException
from services.email_service import email_service

router = APIRouter()

@router.post("/email/send")
async def send_email(body: dict):
    to = body.get("to")
    subject = body.get("subject")
    html = body.get("html")

    if not to or not subject or not html:
        raise HTTPException(400, "Missing required fields: to, subject, html")

    # Narrow types from str | None -> str (None case already raised above)
    to = str(to)
    subject = str(subject)
    html = str(html)

    success = await email_service.send_email(
        to_email=to, 
        subject=subject, 
        body=html, 
        html=True,
        use_talent_creds=True
    )

    if not success:
        raise HTTPException(500, "Failed to send email. Check server logs.")

    return {"success": True}
