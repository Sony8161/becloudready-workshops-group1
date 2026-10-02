"""/api/notices: staff post notices; everyone reads what is meant for them."""
from fastapi import APIRouter, Depends, Response

from auth_guard import current_user, staff
from dependencies import Container, get_container
from models import NoticeCreate, NoticeUpdate

router = APIRouter(prefix="/api/notices", tags=["Notices"])


@router.get("")
def list_notices(user: dict = Depends(current_user), c: Container = Depends(get_container)):
    if user["role"] == "TRAINEE":
        return c.notices.list_for_trainee(str(user["_id"]))
    return c.notices.list_for_staff()


@router.post("", status_code=201)
def create_notice(body: NoticeCreate, actor: dict = Depends(staff), c: Container = Depends(get_container)):
    return c.notices.create(actor, body)


@router.get("/{notice_id}")
def get_notice(notice_id: str, _: dict = Depends(staff), c: Container = Depends(get_container)):
    return c.notices.get_for_staff(notice_id)


@router.patch("/{notice_id}")
def update_notice(notice_id: str, body: NoticeUpdate, _: dict = Depends(staff), c: Container = Depends(get_container)):
    return c.notices.update(notice_id, body)


@router.delete("/{notice_id}", status_code=204)
def delete_notice(notice_id: str, _: dict = Depends(staff), c: Container = Depends(get_container)):
    c.notices.delete(notice_id)
    return Response(status_code=204)


@router.post("/{notice_id}/read")
def mark_read(notice_id: str, user: dict = Depends(current_user), c: Container = Depends(get_container)):
    return c.notices.mark_read(user, notice_id)
