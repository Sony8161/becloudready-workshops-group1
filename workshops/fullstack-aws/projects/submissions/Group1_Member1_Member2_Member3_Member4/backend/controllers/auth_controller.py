"""/api/auth: sign in, who am I, change password."""
import time
from collections import defaultdict, deque

from fastapi import APIRouter, Depends, HTTPException, Request

from auth_guard import current_user_allow_temp
from dependencies import Container, get_container
from models import ChangePasswordIn, LoginIn
from serializers import clean

router = APIRouter(prefix="/api/auth", tags=["Auth"])

# Small in-memory limiter: 10 sign-in tries per email+IP every 15 minutes.
_WINDOW, _MAX = 15 * 60, 10
_attempts: dict[str, deque] = defaultdict(deque)


def _ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "?"


def _limit(key: str) -> None:
    now = time.monotonic()
    q = _attempts[key]
    while q and now - q[0] > _WINDOW:
        q.popleft()
    if len(q) >= _MAX:
        raise HTTPException(status_code=429, detail="Too many sign-in attempts. Try again in 15 minutes.")
    q.append(now)


@router.post("/login")
def login(body: LoginIn, request: Request, c: Container = Depends(get_container)):
    _limit(f"{body.email.lower()}|{_ip(request)}")
    return c.auth.login(body.email, body.password)


@router.get("/me")
def me(user: dict = Depends(current_user_allow_temp)):
    return clean(user)


@router.post("/change-password")
def change_password(body: ChangePasswordIn, user: dict = Depends(current_user_allow_temp),
                    c: Container = Depends(get_container)):
    return c.auth.change_password(user, body.current_password, body.new_password)
