from fastapi import APIRouter, Depends, Query, Request

from auth_guard import get_current_user, require_admin
from dependencies import auth_service as service
from models import (ChangePasswordIn, CreateLoginIn, ForgotPasswordIn, ForgotUsernameIn, LoginIn, LoginInfo,
                    MessageOut, RegisterIn, ResetPasswordIn, SecurityEvent, TempPasswordOut, TokenOut, User)
from rate_limit import client_ip, limit

router = APIRouter(prefix="/api/auth", tags=["Auth"])


def ip_of(request: Request) -> str | None:
    # the caller's IP address, saved in the sign-in log (real IP even behind CloudFront)
    return client_ip(request)


# ---------- anyone ----------
@router.post("/login", response_model=TokenOut)
def login(data: LoginIn, request: Request):
    return service.login(data, ip_of(request))


@router.post("/register", response_model=TokenOut, status_code=201)
def register(data: RegisterIn, request: Request):
    return service.register(data, ip_of(request))


# 5 requests per 15 minutes per IP: stops inbox flooding and email guessing
@router.post("/forgot-username", response_model=MessageOut, dependencies=[Depends(limit("forgot", 5, 900))])
def forgot_username(data: ForgotUsernameIn, request: Request):
    return service.forgot_username(data.email, ip_of(request))


@router.post("/forgot-password", response_model=MessageOut, dependencies=[Depends(limit("forgot", 5, 900))])
def forgot_password(data: ForgotPasswordIn, request: Request):
    return service.forgot_password(data.username_or_email, ip_of(request))


@router.post("/reset-password", response_model=MessageOut, dependencies=[Depends(limit("reset", 10, 900))])
def reset_password(data: ResetPasswordIn, request: Request):
    return service.reset_password(data, ip_of(request))


# ---------- signed in ----------
@router.get("/me", response_model=User)
def me(user: User = Depends(get_current_user)):
    return user   # get_current_user already did the work


@router.post("/refresh", response_model=TokenOut)
def refresh(user: User = Depends(get_current_user)):
    """The "Stay signed in" button: a fresh token for someone whose token is still valid."""
    return service.refresh(user)


@router.put("/me/password", response_model=TokenOut)
def change_password(data: ChangePasswordIn, request: Request, user: User = Depends(get_current_user)):
    return service.change_password(user, data, ip_of(request))


@router.post("/me/sign-out-everywhere", response_model=TokenOut)
def sign_out_everywhere(request: Request, user: User = Depends(get_current_user)):
    return service.sign_out_everywhere(user, ip_of(request))


@router.get("/me/events", response_model=list[SecurityEvent])
def my_events(limit: int = Query(10, ge=1, le=50), user: User = Depends(get_current_user)):
    """My own sign-in history: last sign-in, failed passwords, lockouts."""
    return service.my_events(user, limit)


# ---------- staff ----------
@router.get("/users", response_model=list[User], dependencies=[Depends(require_admin)])
def list_users():
    return service.list_users()


@router.post("/users", response_model=User, status_code=201)
def create_login(data: CreateLoginIn, admin: User = Depends(require_admin)):
    return service.create_login(data, by=admin.username)


@router.post("/users/{user_id}/unlock", response_model=LoginInfo)
def unlock(user_id: int, admin: User = Depends(require_admin)):
    return service.unlock(user_id, by=admin.username)


@router.post("/users/{user_id}/temporary-password", response_model=TempPasswordOut)
def temporary_password(user_id: int, admin: User = Depends(require_admin)):
    return service.temporary_password(user_id, by=admin.username)
