"""/api/users: HR onboarding and people management. Managers can read."""
from typing import Optional

from fastapi import APIRouter, Depends

from auth_guard import hr_only, staff
from dependencies import Container, get_container
from models import ImportIn, Role, UserCreate, UserStatus, UserUpdate

router = APIRouter(prefix="/api/users", tags=["Users (HR)"])


@router.get("")
def list_users(role: Optional[Role] = None, status: Optional[UserStatus] = None, q: Optional[str] = None,
               _: dict = Depends(staff), c: Container = Depends(get_container)):
    return c.users.list(role.value if role else None, status.value if status else None, q)


# Fixed paths go above /{user_id}.
@router.get("/duplicates")
def duplicates(_: dict = Depends(hr_only), c: Container = Depends(get_container)):
    return c.users.duplicates()


@router.post("/import/preview")
def import_preview(body: ImportIn, _: dict = Depends(hr_only), c: Container = Depends(get_container)):
    return c.users.import_preview(body.rows)


@router.post("/import", status_code=201)
def import_users(body: ImportIn, actor: dict = Depends(hr_only), c: Container = Depends(get_container)):
    return c.users.import_rows(actor, body.rows, body.include_possible_duplicates)


@router.post("", status_code=201)
def create_user(body: UserCreate, actor: dict = Depends(hr_only), c: Container = Depends(get_container)):
    return c.users.create(actor, body)


@router.get("/{user_id}")
def get_user(user_id: str, _: dict = Depends(staff), c: Container = Depends(get_container)):
    return c.users.get(user_id)


@router.patch("/{user_id}")
def update_user(user_id: str, body: UserUpdate, _: dict = Depends(hr_only), c: Container = Depends(get_container)):
    return c.users.update(user_id, body)


@router.post("/{user_id}/deactivate")
def deactivate(user_id: str, actor: dict = Depends(hr_only), c: Container = Depends(get_container)):
    return c.users.set_status(actor, user_id, "INACTIVE")


@router.post("/{user_id}/reactivate")
def reactivate(user_id: str, actor: dict = Depends(hr_only), c: Container = Depends(get_container)):
    return c.users.set_status(actor, user_id, "ACTIVE")


@router.post("/{user_id}/reset-password")
def reset_password(user_id: str, actor: dict = Depends(hr_only), c: Container = Depends(get_container)):
    return c.users.reset_password(actor, user_id)
