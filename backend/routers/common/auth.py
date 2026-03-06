"""
Authentication API router.
Handles login, logout, and user info endpoints.
"""
import logging
import requests
from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel
from typing import Optional

from auth import (
    verify_google_token, 
    create_jwt_token, 
    lookup_user_by_email,
    UserInfo,
    GOOGLE_CLIENT_ID
)
from middleware.auth_middleware import get_current_user, get_user_info
from auth import TokenData

logger = logging.getLogger("chrms.auth")

router = APIRouter()


class GoogleLoginRequest(BaseModel):
    """Request body for Google login."""
    credential: str  # Google ID token


class LoginResponse(BaseModel):
    """Response for successful login."""
    access_token: str
    token_type: str = "bearer"
    user: UserInfo


class ConfigResponse(BaseModel):
    """Auth configuration for frontend."""
    google_client_id: str


@router.get("/config", response_model=ConfigResponse)
async def get_auth_config():
    """Get authentication configuration for frontend."""
    return ConfigResponse(google_client_id=GOOGLE_CLIENT_ID)


def sync_google_picture_to_drive(associate_id: str, google_picture_url: str):
    """
    Download a Google profile picture and save it to the associate's permanent Drive folder.
    Updates the Associates sheet with the new Drive-based link.
    """
    from services.google_drive import drive_service
    from services.google_sheets import sheets_service
    from config import settings
    import io

    try:
        # 1. Fetch associate data to get drive_folder_id
        record = sheets_service.get_row_by_id(settings.ASSOCIATES_SHEET, "Associate ID", associate_id)
        if not record or not record.get("Drive Folder ID"):
            logger.warning(f"No Drive folder for associate {associate_id}, skipping picture sync")
            return None

        drive_folder_id = record.get("Drive Folder ID")

        # 2. Download the picture
        response = requests.get(google_picture_url, timeout=10)
        if response.status_code != 200:
            logger.error(f"Failed to download Google picture: {response.status_code}")
            return None
        
        image_bytes = response.content
        filename = f"profile_photo_{associate_id}.jpg"

        # 3. Find or create "Photo" subfolder
        photo_folder_id = None
        try:
            results = drive_service._service.files().list(
                q=f"'{drive_folder_id}' in parents and name='Photo' and mimeType='application/vnd.google-apps.folder' and trashed=false",
                fields='files(id)',
                supportsAllDrives=True
            ).execute()
            files = results.get('files', [])
            if files:
                photo_folder_id = files[0]['id']
            else:
                photo_folder_id = drive_service.create_folder("Photo", drive_folder_id)
        except Exception as e:
            logger.error(f"Error finding/creating Photo folder: {e}")
            photo_folder_id = drive_folder_id # Fallback to root associate folder

        # 4. Upload to Drive
        file_id = drive_service.upload_file_binary(
            image_bytes, filename, "image/jpeg", photo_folder_id
        )

        if not file_id:
            logger.error("Failed to upload profile picture to Drive")
            return None

        # 5. Make it public (reader)
        drive_service.make_public_reader(file_id)
        drive_link = f"https://drive.google.com/file/d/{file_id}/view"

        # 6. Update the Associates sheet
        row_index = sheets_service.find_row_index(settings.ASSOCIATES_SHEET, "Associate ID", associate_id)
        if row_index:
            # We need the full row to update it or just update the specific cell
            # update_cell is safer if we don't want to re-append everything
            # Let's find the column index for "Photo"
            headers = sheets_service.get_headers(settings.ASSOCIATES_SHEET)
            try:
                photo_col_idx = headers.index("Photo") + 1
                sheets_service.update_cell(settings.ASSOCIATES_SHEET, row_index, photo_col_idx, drive_link)
                logger.info(f"Updated Associate {associate_id} photo with permanent link: {drive_link}")
                return drive_link
            except ValueError:
                logger.error("Could not find 'Photo' column in Associates sheet")
        
        return None
    except Exception as e:
        logger.error(f"Error syncing profile picture: {e}")
        return None


@router.post("/google", response_model=LoginResponse)
async def login_with_google(request: GoogleLoginRequest):
    """
    Authenticate with Google OAuth.
    Verifies Google token, looks up user in Associates sheet,
    and returns a JWT session token.
    """
    # Verify Google token
    google_user = verify_google_token(request.credential)
    if not google_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Google token"
        )
    
    if not google_user.get("email_verified"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email not verified"
        )
    
    email = google_user.get("email")
    logger.info(f"Google login attempt for: {email}")
    
    # Look up user in Associates sheet
    user_data = lookup_user_by_email(email)
    if not user_data:
        logger.warning(f"User not found in Associates: {email}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not registered as an associate. Please contact your administrator."
        )
    
    # Create JWT token
    token_payload = {
        "associate_id": user_data["associate_id"],
        "email": user_data["email"],
        "name": user_data["name"],
        "role": user_data["role"]
    }
    access_token = create_jwt_token(token_payload)
    
    # Always set google_picture from Google user info for fallback
    user_data["google_picture"] = google_user.get("picture", "")
    
    # Add Google profile picture to user data if Associate photo is not present
    # OR if the existing photo is an external Google URL (which expires)
    existing_photo = user_data.get("picture", "")
    google_photo = google_user.get("picture", "")

    is_temporary_google_url = "googleusercontent.com" in existing_photo

    if not existing_photo or is_temporary_google_url:
        if google_photo:
            # Sync to Drive permanently
            permanent_link = sync_google_picture_to_drive(user_data["associate_id"], google_photo)
            if permanent_link:
                user_data["picture"] = permanent_link
            else:
                user_data["picture"] = google_photo
    
    logger.info(f"Login successful for: {email} (role: {user_data['role']})")
    
    return LoginResponse(
        access_token=access_token,
        user=UserInfo(**user_data)
    )


@router.get("/me", response_model=UserInfo)
async def get_current_user_info(user_info: UserInfo = Depends(get_user_info)):
    """Get current authenticated user's information."""
    return user_info


@router.post("/dev-login", response_model=LoginResponse)
async def dev_login(email: str = "ashwin.m@guhatek.com"):
    """
    Developer bypass login for troubleshooting.
    """
    logger.info(f"Dev login attempt for: {email}")
    user_data = lookup_user_by_email(email)
    
    if not user_data:
        # Check if we can list at least one user to login as
        from services.google_sheets import sheets_service
        from config import settings
        try:
            records = sheets_service.get_all_records(settings.ASSOCIATES_SHEET)
            if records:
                # Use the first user found or search for admin
                for record in records:
                    if record.get("Role ID") == "admin" or record.get("IAM Role ID") == "admin":
                        email = record.get("Email")
                        user_data = lookup_user_by_email(email)
                        break
                if not user_data:
                    email = records[0].get("Email")
                    user_data = lookup_user_by_email(email)
        except Exception:
            pass

    if not user_data:
        # Hard fallback for emergency access when Sheets is down
        user_data = {
            "associate_id": "ADMIN001",
            "email": email,
            "name": "Dev Admin",
            "role": "Admin",
            "department_id": "MGMT",
            "designation_id": "ADMIN",
            "designation": "Administrator",
            "picture": "",
            "iam_role_id": "admin",
            "permissions": []
        }

    token_payload = {
        "associate_id": user_data["associate_id"],
        "email": user_data["email"],
        "name": user_data["name"],
        "role": user_data["role"]
    }
    access_token = create_jwt_token(token_payload)
    
    return LoginResponse(
        access_token=access_token,
        user=UserInfo(**user_data)
    )

@router.post("/logout")
async def logout(current_user: TokenData = Depends(get_current_user)):
    """
    Logout the current user.
    Note: JWT tokens are stateless, so this just confirms the logout.
    Client should discard the token.
    """
    logger.info(f"Logout: {current_user.email}")
    return {"message": "Logged out successfully"}
