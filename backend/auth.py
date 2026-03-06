"""
Authentication module for OneGT.
Handles Google OAuth token verification and JWT session management.
"""
import os
import logging
from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from pydantic import BaseModel
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

logger = logging.getLogger("chrms.auth")

# JWT Configuration
JWT_SECRET = os.getenv("JWT_SECRET", "chrms-secret-key-change-in-production")
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_HOURS = int(os.getenv("JWT_EXPIRY_HOURS", "24"))

# Google OAuth Configuration
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")


class TokenData(BaseModel):
    """JWT token payload data."""
    associate_id: str
    email: str
    name: str
    role: str
    exp: Optional[datetime] = None


class UserInfo(BaseModel):
    """Current user information returned to frontend."""
    associate_id: str
    email: str
    name: str
    role: str
    department_id: Optional[str] = ""
    designation_id: Optional[str] = ""
    designation: Optional[str] = ""
    picture: Optional[str] = ""
    google_picture: Optional[str] = ""
    iam_role_id: Optional[str] = ""
    permissions: Optional[list] = []


def verify_google_token(token: str) -> Optional[dict]:
    """
    Verify Google OAuth ID token and return user info.
    Returns None if verification fails.
    """
    try:
        # Verify the token with Google
        idinfo = id_token.verify_oauth2_token(
            token,
            google_requests.Request(),
            GOOGLE_CLIENT_ID
        )
        
        # Log what Google returns (for debugging)
        #logger.info(f"Google token info: {idinfo}")
        
        # Check issuer
        if idinfo['iss'] not in ['accounts.google.com', 'https://accounts.google.com']:
            logger.warning(f"Invalid token issuer: {idinfo['iss']}")
            return None
        
        return {
            "email": idinfo.get("email"),
            "name": idinfo.get("name"),
            "picture": idinfo.get("picture"),
            "email_verified": idinfo.get("email_verified", False)
        }
    except ValueError as e:
        logger.error(f"Google token verification failed: {e}")
        return None


def create_jwt_token(data: dict) -> str:
    """Create a JWT token with expiration."""
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(hours=JWT_EXPIRY_HOURS)
    to_encode.update({"exp": expire})
    
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)
    return encoded_jwt


def decode_jwt_token(token: str) -> Optional[TokenData]:
    """Decode and validate JWT token."""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return TokenData(
            associate_id=payload.get("associate_id"),
            email=payload.get("email"),
            name=payload.get("name"),
            role=payload.get("role"),
            exp=payload.get("exp")
        )
    except JWTError as e:
        logger.error(f"JWT decode error: {e}")
        return None


def lookup_user_by_email(email: str) -> Optional[dict]:
    """
    Look up user in Associates sheet by email.
    Returns associate data including role if found.
    """
    from services.google_sheets import sheets_service
    from config import settings
    
    try:
        records = sheets_service.get_all_records(settings.ASSOCIATES_SHEET)
        for record in records:
            record_email = str(record.get("Email", "")).strip()
            if record_email.lower() == email.lower():
                # Case-insensitive lookup for Photo column
                photo_val = record.get("Photo") or record.get("photo") or record.get("picture") or ""
                # Resolve designation name
                designation_id = str(record.get("Designation ID") or record.get("Designation", "") or "").strip()
                designation_name = designation_id
                
                try:
                    designation_records = sheets_service.get_all_records(settings.DESIGNATIONS_SHEET)
                    for d_rec in designation_records:
                        d_id = str(d_rec.get("Role ID") or d_rec.get("Role Id") or "").strip()
                        if d_id == designation_id:
                            designation_name = str(d_rec.get("Role Name", "")).strip()
                            break
                except Exception:
                    pass

                role_id = str(record.get("IAM Role ID") or record.get("Role ID", "") or "").strip()
                logger.info(f"Login role lookup: email={email}, Role ID from sheet='{role_id}'")

                # Derive role name from Role ID by looking up the roles sheet
                role_name = "Associate"  # default fallback
                if role_id:
                    try:
                        role_records = sheets_service.get_all_records(settings.SETTINGS_ROLES_SHEET)
                        logger.info(f"Roles sheet has {len(role_records)} records: {[{r.get('id'): r.get('name')} for r in role_records]}")
                        for r_rec in role_records:
                            if str(r_rec.get("id", "")) == role_id:
                                role_name = str(r_rec.get("name", "Associate")).strip()
                                logger.info(f"Matched role: {role_id} -> {role_name}")
                                break
                        else:
                            logger.warning(f"No role found matching ID '{role_id}'")
                    except Exception as e:
                        logger.error(f"Error looking up role name for {role_id}: {e}")

                # Load permissions for the assigned IAM role (or default role)
                perms = load_permissions_for_role(role_id)

                return {
                    "associate_id": str(record.get("Associate ID", "")).strip(),
                    "email": record_email,
                    "name": str(record.get("Associate Name", "")).strip(),
                    "role": role_name,
                    "department_id": str(record.get("Department ID") or record.get("Department", "") or "").strip(),
                    "designation_id": designation_id,
                    "designation": designation_name,
                    "picture": str(photo_val).strip(),
                    "iam_role_id": role_id,
                    "permissions": perms
                }
        return None
    except Exception as e:
        logger.error(f"Error looking up user: {e}")
        return None


def load_permissions_for_role(iam_role_id: str) -> list:
    """Load permissions for a given IAM role ID. Falls back to default role if empty."""
    from services.google_sheets import sheets_service
    from config import settings
    try:
        # If no IAM role assigned, find the default role
        if not iam_role_id:
            try:
                roles = sheets_service.get_all_records(settings.SETTINGS_ROLES_SHEET)
                default_role = next(
                    (r for r in roles if str(r.get("is_default", "")).upper() == "TRUE" or r.get("is_default") is True),
                    None
                )
                if default_role:
                    iam_role_id = str(default_role.get("id", ""))
                else:
                    return []
            except Exception:
                return []

        # Load permissions for this role
        perm_records = sheets_service.get_all_records(settings.SETTINGS_PERMISSIONS_SHEET)
        perms = []
        for p in perm_records:
            if str(p.get("role_id", "")) == iam_role_id:
                perms.append({
                    "capability_id": p.get("capability_id", ""),
                    "page_id": p.get("page_id", ""),
                    "can_read": p.get("can_read", False) in [True, "TRUE", "true"],
                    "can_write": p.get("can_write", False) in [True, "TRUE", "true"],
                    "scope": p.get("scope", "associate")
                })
        return perms
    except Exception as e:
        logger.error(f"Error loading permissions for role {iam_role_id}: {e}")
        return []


def is_admin(role: str) -> bool:
    """Check if role is Admin."""
    return role.lower() == "admin"


def is_manager(role: str) -> bool:
    """Check if role is Manager."""
    return role.lower() == "project manager"


def is_hr(role: str) -> bool:
    """Check if role is HR or Operations Manager."""
    return role.lower() in ["hr", "operations manager"]


def is_operations_manager(role: str) -> bool:
    """Check if role is Operations Manager."""
    return role.lower() == "operations manager"


def is_manager_or_admin(role: str) -> bool:
    """Check if role is Manager or Admin."""
    return role.lower() in ["admin", "project manager"]


def can_access_all_data(role: str) -> bool:
    """Check if role can access all data (Admin or HR)."""
    return is_admin(role) or is_hr(role)


def can_manage_allocations(role: str) -> bool:
    """Check if role can manage allocations (Admin or Manager)."""
    return is_manager_or_admin(role)
