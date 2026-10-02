"""/api/dashboard (staff overview), /api/me (trainee home), /api/notifications (the bell)."""
from typing import Optional

from fastapi import APIRouter, Depends

from auth_guard import current_user, staff, trainee_only
from dependencies import Container, get_container

router = APIRouter(tags=["Dashboard & notifications"])


@router.get("/api/dashboard")
def dashboard(cohort_id: Optional[str] = None, _: dict = Depends(staff), c: Container = Depends(get_container)):
    return c.dashboard.staff_dashboard(cohort_id)


@router.get("/api/dashboard/trainees/{trainee_id}")
def trainee_detail(trainee_id: str, _: dict = Depends(staff), c: Container = Depends(get_container)):
    return c.dashboard.trainee_overview(trainee_id)


@router.get("/api/me/overview")
def my_overview(user: dict = Depends(trainee_only), c: Container = Depends(get_container)):
    return c.dashboard.trainee_overview(str(user["_id"]))


@router.get("/api/notifications")
def my_notifications(unread: bool = False, user: dict = Depends(current_user), c: Container = Depends(get_container)):
    return c.notifications.list_mine(str(user["_id"]), unread)


@router.post("/api/notifications/read-all")
def read_all(user: dict = Depends(current_user), c: Container = Depends(get_container)):
    return {"updated": c.notifications.mark_all_read(str(user["_id"]))}


@router.post("/api/notifications/{notification_id}/read")
def read_one(notification_id: str, user: dict = Depends(current_user), c: Container = Depends(get_container)):
    return {"ok": c.notifications.mark_read(notification_id, str(user["_id"]))}
