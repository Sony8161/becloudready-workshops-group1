"""/api/plans: managers create and assign training plans; trainees read their own."""
from typing import Optional

from fastapi import APIRouter, Depends

from auth_guard import current_user, manager_only
from dependencies import Container, get_container
from models import AssigneeType, PlanCopyIn, PlanCreate, PlanUpdate

router = APIRouter(prefix="/api/plans", tags=["Plans"])


@router.get("")
def list_plans(status: Optional[str] = "ACTIVE", assignee_type: Optional[AssigneeType] = None,
               assignee_id: Optional[str] = None, user: dict = Depends(current_user),
               c: Container = Depends(get_container)):
    if user["role"] == "TRAINEE":
        tid = str(user["_id"])
        return [c.plans.get_for_trainee(tid, str(p["_id"])) for p in c.plans.plans_for_trainee(tid)]
    status = None if status in (None, "", "ALL") else status
    return c.plans.list(status, assignee_type.value if assignee_type else None, assignee_id)


@router.post("", status_code=201)
def create_plan(body: PlanCreate, actor: dict = Depends(manager_only), c: Container = Depends(get_container)):
    return c.plans.create(actor, body)


@router.get("/{plan_id}")
def get_plan(plan_id: str, user: dict = Depends(current_user), c: Container = Depends(get_container)):
    if user["role"] == "TRAINEE":
        return c.plans.get_for_trainee(str(user["_id"]), plan_id)
    return c.plans.get(plan_id)


@router.patch("/{plan_id}")
def update_plan(plan_id: str, body: PlanUpdate, _: dict = Depends(manager_only), c: Container = Depends(get_container)):
    return c.plans.update(plan_id, body)


@router.post("/{plan_id}/archive")
def archive_plan(plan_id: str, _: dict = Depends(manager_only), c: Container = Depends(get_container)):
    return c.plans.set_status(plan_id, "ARCHIVED")


@router.post("/{plan_id}/restore")
def restore_plan(plan_id: str, _: dict = Depends(manager_only), c: Container = Depends(get_container)):
    return c.plans.set_status(plan_id, "ACTIVE")


@router.post("/{plan_id}/copy", status_code=201)
def copy_plan(plan_id: str, body: PlanCopyIn, actor: dict = Depends(manager_only),
              c: Container = Depends(get_container)):
    return c.plans.copy(actor, plan_id, body)
