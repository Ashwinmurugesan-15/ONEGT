"""
Authentication middleware for FastAPI.
Provides dependencies for route protection based on roles.
"""
import logging
from typing import List, Optional
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from auth import decode_jwt_token, TokenData, UserInfo, lookup_user_by_email

logger = logging.getLogger("chrms.middleware")

# HTTP Bearer token extractor
security = HTTPBearer(auto_error=False)


async def get_token_from_header(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> Optional[str]:
    """Extract JWT token from Authorization header."""
    if credentials:
        return credentials.credentials
    return None


async def get_current_user(
    token: Optional[str] = Depends(get_token_from_header)
) -> TokenData:
    """
    Get the current authenticated user from JWT token.
    Raises 401 if not authenticated.
    """
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"}
        )
    
    token_data = decode_jwt_token(token)
    if not token_data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"}
        )
    
    return token_data


async def get_current_user_optional(
    token: Optional[str] = Depends(get_token_from_header)
) -> Optional[TokenData]:
    """
    Get the current user if authenticated, or None if not.
    Does not raise an error for unauthenticated requests.
    """
    if not token:
        return None
    return decode_jwt_token(token)


def require_role(allowed_roles: List[str]):
    """
    Dependency factory that requires specific role(s).
    Usage: Depends(require_role(["Admin", "Manager"]))
    """
    async def role_checker(
        current_user: TokenData = Depends(get_current_user)
    ) -> TokenData:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required role: {', '.join(allowed_roles)}"
            )
        return current_user
    return role_checker


async def require_admin(
    current_user: TokenData = Depends(get_current_user)
) -> TokenData:
    """Require Admin role."""
    if current_user.role != "Admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return current_user


async def require_manager_or_admin(
    current_user: TokenData = Depends(get_current_user)
) -> TokenData:
    """Require Manager or Admin role."""
    if current_user.role not in ["Admin", "Project Manager"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Manager or Admin access required"
        )
    return current_user


async def require_hr_or_admin(
    current_user: TokenData = Depends(get_current_user)
) -> TokenData:
    """Require HR, Operations Manager, or Admin role."""
    if current_user.role not in ["Admin", "HR", "Operations Manager"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="HR, Operations Manager, or Admin access required"
        )
    return current_user


async def get_user_info(
    current_user: TokenData = Depends(get_current_user)
) -> UserInfo:
    """Get full user info including department and designation."""
    user_data = lookup_user_by_email(current_user.email)
    if user_data:
        return UserInfo(**user_data)
    return UserInfo(
        associate_id=current_user.associate_id,
        email=current_user.email,
        name=current_user.name,
        role=current_user.role
    )
