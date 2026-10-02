"""Security checks that routes plug in with Depends(...).

FastAPI runs a dependency BEFORE the route function. If the dependency raises, the route
never runs. So `user: User = Depends(get_current_user)` means "no valid token, no entry".
"""
import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from dependencies import auth_service
from models import Role, User
from security import decode_access_token

# Reads the "Authorization: Bearer <token>" header. It also adds the Authorize button to /docs.
# auto_error=False: if the header is missing we raise our own clear 401 below.
bearer = HTTPBearer(auto_error=False)


def _unauthorized(detail: str) -> HTTPException:
    # 401 = "who are you?" (no login / bad token). The header tells clients to send a Bearer token.
    return HTTPException(status_code=401, detail=detail, headers={"WWW-Authenticate": "Bearer"})


def get_current_user(credentials: HTTPAuthorizationCredentials | None = Depends(bearer)) -> User:
    """Token in, logged-in User out. Every protected route depends on this."""
    if credentials is None:
        raise _unauthorized("Not logged in")    
    token = credentials.credentials
    
    try:
        payload = decode_access_token(token)
    except jwt.ExpiredSignatureError:
        raise _unauthorized("Session expired. Please log in again.")
    except jwt.InvalidTokenError:
        raise _unauthorized("Invalid token")

    user = auth_service.get_user(int(payload["sub"]))
    if user is None:
        raise _unauthorized("This login no longer exists")
    # "Sign out everywhere" / a password change bumps the login's token_version: older tokens fail here.
    if not auth_service.token_is_current(user.id, payload.get("ver", 0)):
        raise _unauthorized("You were signed out. Please sign in again.")
    return user


def require_admin(user: User = Depends(get_current_user)) -> User:
    """Chains on get_current_user: first "are you logged in?", then "are you an admin?"."""
    if user.role != Role.ADMIN:
        # 403 = "I know who you are, but you're not allowed"
        raise HTTPException(status_code=403, detail="Admins only")
    return user


def ensure_owner(user: User, customer_id: int) -> None:
    """Admins can see everyone. A customer can only touch their OWN customer id."""
    if user.role != Role.ADMIN and user.customer_id != customer_id:
        raise HTTPException(status_code=403, detail="You can only access your own accounts")
