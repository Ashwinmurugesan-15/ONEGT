from email.message import EmailMessage
from email.utils import formataddr
import aiosmtplib
import logging
import os
import traceback
from config import settings
from utils.logging_utils import trace_exceptions_async

logger = logging.getLogger(__name__)

class EmailService:
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    async def _get_auth_params(self):
        """Helper to determine authentication parameters (Standard vs OAuth2).
        
        Authentication priority:
        1. OAuth2 Refresh Token (if GOOGLE_REFRESH_TOKEN is set)
        2. Service Account credentials.json with domain-wide delegation (local dev)
        3. Federated Auth / Application Default Credentials (AKS / higher environments)
        """
        if settings.SMTP_USE_OAUTH2:
            try:
                from google.auth.transport.requests import Request
                
                gmail_scopes = ["https://mail.google.com/"]
                creds = None
                
                # Priority 1: Explicit OAuth2 Refresh Token
                if settings.GOOGLE_REFRESH_TOKEN:
                    from google.oauth2.credentials import Credentials
                    logger.info("Email OAuth2: Using explicit refresh token")
                    creds = Credentials(
                        None,
                        refresh_token=settings.GOOGLE_REFRESH_TOKEN,
                        token_uri=settings.GOOGLE_TOKEN_URI,
                        client_id=settings.GOOGLE_CLIENT_ID,
                        client_secret=settings.GOOGLE_CLIENT_SECRET
                    )
                
                # Priority 2: Service Account credentials file (local dev)
                elif settings.GOOGLE_CREDENTIALS_FILE and os.path.exists(settings.GOOGLE_CREDENTIALS_FILE):
                    from google.oauth2 import service_account
                    logger.info(f"Email OAuth2: Using service account from {settings.GOOGLE_CREDENTIALS_FILE} "
                                f"with domain-wide delegation (impersonating {settings.SMTP_USER})")
                    creds = service_account.Credentials.from_service_account_file(
                        settings.GOOGLE_CREDENTIALS_FILE,
                        scopes=gmail_scopes,
                        subject=settings.SMTP_USER  # Impersonate the SMTP user via domain-wide delegation
                    )
                
                # Priority 3: Federated Auth / Application Default Credentials (AKS)
                else:
                    import google.auth
                    logger.info("Email OAuth2: Using Application Default Credentials (federated auth)")
                    creds, project = google.auth.default(scopes=gmail_scopes)
                
                # Refresh to get a valid access token
                creds.refresh(Request())
                return {
                    "username": settings.SMTP_USER,
                    "password": creds.token,
                    "auth_method": "xoauth2"
                }
            except Exception as e:
                from google.auth.exceptions import RefreshError
                if isinstance(e, RefreshError):
                    logger.error("OAuth2 token refresh failed (invalid_grant or delegation issue).")
                    logger.error("If using a service account, ensure domain-wide delegation is enabled "
                                 "in Google Workspace Admin for the service account's client ID "
                                 f"with scope: https://mail.google.com/ and subject: {settings.SMTP_USER}")
                else:
                    logger.error(f"Failed to obtain OAuth2 token: {e}")
                logger.error(traceback.format_exc())
                return None
        
        return {
            "username": settings.SMTP_USER,
            "password": settings.SMTP_PASSWORD
        }

    @trace_exceptions_async
    async def send_email(self, to_email: str, subject: str, body: str, html: bool = False):
        """Generic method to send an email asynchronously."""
        # Minimum requirement: User for OAuth2 or User+Pass for standard
        if not settings.SMTP_USER:
            logger.warning("SMTP user not configured. Skipping email.")
            return False
            
        try:
            auth_params = await self._get_auth_params()
            if not auth_params:
                return False

            message = EmailMessage()
            sender_email = settings.FROM_EMAIL or settings.SMTP_USER
            message["From"] = formataddr(("OneGT (HRMS)", sender_email))
            message["To"] = to_email
            message["Subject"] = subject
            
            if html:
                message.add_alternative(body, subtype="html")
            else:
                message.set_content(body)
            
            # Use SMTP client for full control over auth method
            # Create SSL context (fixes macOS Python certificate issues)
            import ssl
            tls_context = ssl.create_default_context()
            if settings.DEBUG:
                tls_context.check_hostname = False
                tls_context.verify_mode = ssl.CERT_NONE
            
            use_implicit_tls = settings.SMTP_USE_TLS and settings.SMTP_PORT == 465
            use_starttls = settings.SMTP_USE_TLS and settings.SMTP_PORT == 587
            
            smtp = aiosmtplib.SMTP(
                hostname=settings.SMTP_HOST,
                port=settings.SMTP_PORT,
                use_tls=use_implicit_tls,
                start_tls=use_starttls,
                tls_context=tls_context
            )
            
            await smtp.connect()
            
            # Authenticate
            auth_method = auth_params.get("auth_method")
            username = auth_params.get("username")
            password = auth_params.get("password")
            
            if auth_method == "xoauth2":
                # Build XOAUTH2 string: "user=<email>\x01auth=Bearer <token>\x01\x01"
                import base64
                oauth2_str = f"user={username}\x01auth=Bearer {password}\x01\x01"
                oauth2_b64 = base64.b64encode(oauth2_str.encode()).decode()
                
                code, resp = await smtp.execute_command(b"AUTH", b"XOAUTH2", oauth2_b64.encode())
                if code not in (235,):
                    logger.error(f"XOAUTH2 auth failed: {code} {resp}")
                    await smtp.quit()
                    return False
            else:
                await smtp.login(username, password)
            
            await smtp.send_message(message)
            await smtp.quit()
            
            logger.info(f"Email sent successfully to {to_email}")
            return True
        except Exception as e:
            logger.error(f"Failed to send email to {to_email}: {e}")
            logger.error(traceback.format_exc())
            return False

    async def send_allocation_email(self, associate_email: str, associate_name: str, project_id: str, project_name: str):
        """Notify an associate about a new project allocation."""
        subject = f"New Project Allocation: {project_id} - {project_name}"
        body = f"""
        <html>
        <body style="font-family: sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                <h2 style="color: #2563eb;">New Project Allocation</h2>
                <p>Hello <strong>{associate_name}</strong>,</p>
                <p>You have been allocated to a new project in the GuhaTek HRMS portal:</p>
                <div style="background-color: #f8fafc; padding: 15px; border-left: 4px solid #2563eb; margin: 20px 0;">
                    <p style="margin: 5px 0;"><strong>Project ID:</strong> {project_id}</p>
                    <p style="margin: 5px 0;"><strong>Project Name:</strong> {project_name}</p>
                </div>
                <p>Please log in to the portal to view more details and start logging your timesheets against this project.</p>
                <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
                <p style="font-size: 0.9em; color: #64748b;">Best Regards,<br/>GuhaTek HRMS Team</p>
            </div>
        </body>
        </html>
        """
        return await self.send_email(associate_email, subject, body, html=True)

    async def send_rejection_email(self, type: str, associate_email: str, associate_name: str, identifier: str, reason: str):
        """Notify an associate when a submission (timesheet/expense) is rejected."""
        # type can be 'Timesheet' or 'Expense Report'
        subject = f"{type} Rejected: {identifier}"
        body = f"""
        <html>
        <body style="font-family: sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                <h2 style="color: #ef4444;">{type} Rejected</h2>
                <p>Hello <strong>{associate_name}</strong>,</p>
                <p>Your <strong>{type.lower()}</strong> ({identifier}) has been rejected by your manager.</p>
                <div style="background-color: #fef2f2; padding: 15px; border-left: 4px solid #ef4444; margin: 20px 0;">
                    <p style="margin: 5px 0;"><strong>Reason for rejection:</strong></p>
                    <p style="margin: 5px 0; font-style: italic;">"{reason or 'No specific reason provided.'}"</p>
                </div>
                <p>Please log in to the portal, review the full comments, and resubmit with the necessary corrections.</p>
                <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
                <p style="font-size: 0.9em; color: #64748b;">Best Regards,<br/>GuhaTek HRMS Team</p>
            </div>
        </body>
        </html>
        """
        return await self.send_email(associate_email, subject, body, html=True)

    async def send_task_creation_email(
        self,
        creator_email: str,
        creator_name: str,
        assignee_email: str,
        assignee_name: str,
        task_id: str,
        task_title: str,
        priority: str,
        due_date: str
    ):
        """Notify creator and assignee about a new task."""
        subject = f"New Task Assigned: {task_id} - {task_title}"
        
        body_assignee = f"""
        <html>
        <body style="font-family: sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                <h2 style="color: #2563eb;">New Task Assigned to You</h2>
                <p>Hello <strong>{assignee_name}</strong>,</p>
                <p><strong>{creator_name}</strong> has assigned a new task to you in the CRM:</p>
                <div style="background-color: #f8fafc; padding: 15px; border-left: 4px solid #2563eb; margin: 20px 0;">
                    <p style="margin: 5px 0;"><strong>Task ID:</strong> {task_id}</p>
                    <p style="margin: 5px 0;"><strong>Title:</strong> {task_title}</p>
                    <p style="margin: 5px 0;"><strong>Priority:</strong> {priority}</p>
                    <p style="margin: 5px 0;"><strong>Due Date:</strong> {due_date or 'Not Set'}</p>
                </div>
                <p>Please log in to the portal to view full details and manage this task.</p>
                <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
                <p style="font-size: 0.9em; color: #64748b;">Best Regards,<br/>GuhaTek CRM</p>
            </div>
        </body>
        </html>
        """
        
        body_creator = f"""
        <html>
        <body style="font-family: sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                <h2 style="color: #2563eb;">Task Successfully Created</h2>
                <p>Hello <strong>{creator_name}</strong>,</p>
                <p>You have successfully created and assigned a new task to <strong>{assignee_name}</strong>:</p>
                <div style="background-color: #f8fafc; padding: 15px; border-left: 4px solid #2563eb; margin: 20px 0;">
                    <p style="margin: 5px 0;"><strong>Task ID:</strong> {task_id}</p>
                    <p style="margin: 5px 0;"><strong>Title:</strong> {task_title}</p>
                    <p style="margin: 5px 0;"><strong>Priority:</strong> {priority}</p>
                    <p style="margin: 5px 0;"><strong>Due Date:</strong> {due_date or 'Not Set'}</p>
                </div>
                <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
                <p style="font-size: 0.9em; color: #64748b;">Best Regards,<br/>GuhaTek CRM</p>
            </div>
        </body>
        </html>
        """
        
        if assignee_email:
            try:
                await self.send_email(assignee_email, subject, body_assignee, html=True)
            except Exception as e:
                logger.error(f"Failed to send task email to assignee {assignee_email}: {e}")
            
        if creator_email and creator_email != assignee_email:
            try:
                await self.send_email(creator_email, f"Task Created: {task_id} - {task_title}", body_creator, html=True)
            except Exception as e:
                logger.error(f"Failed to send task email to creator {creator_email}: {e}")

# Singleton instance
email_service = EmailService()
