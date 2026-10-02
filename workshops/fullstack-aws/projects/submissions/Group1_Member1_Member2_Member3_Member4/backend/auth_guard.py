"""Who is calling? Reads the Bearer token and checks the role."""
import jwt
from bson import ObjectId
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from dependencies import Container, get_container
from security import decode_token

bearer = HTTPBearer(auto_error=False)


def _load_user(creds: HTTPAuthorizationCredentials | None, c: Container) -> dict:
    if creds is None:
        raise HTTPException(status_code=401, detail="Please sign in")
    try:
        payload = decode_token(creds.credentials)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Your session expired. Please sign in again.")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Please sign in")
    sub = payload.get("sub", "")
    user = c.user_repo.find_by_id(ObjectId(sub)) if ObjectId.is_valid(sub) else None
    if not user or user.get("status") != "ACTIVE":
        raise HTTPException(status_code=401, detail="Please sign in")
    if payload.get("ver") != user.get("token_version", 0):
        raise HTTPException(status_code=401, detail="You were signed out. Please sign in again.")
    return user


def current_user_allow_temp(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer), c: Container = Depends(get_container)
) -> dict:
    """Signed-in user, even if they still have a temporary password (for /me and change-password)."""
    return _load_user(creds, c)


def current_user(user: dict = Depends(current_user_allow_temp)) -> dict:
    if user.get("must_change_password"):
        raise HTTPException(status_code=403, detail="Please set a new password first")
    return user


def require(*roles: str):
    def checker(user: dict = Depends(current_user)) -> dict:
        if user["role"] not in roles:
            raise HTTPException(status_code=403, detail="You don't have access to this")
        return user

    return checker


staff = require("HR", "MANAGER")
hr_only = require("HR")
manager_only = require("MANAGER")
trainee_only = require("TRAINEE")
