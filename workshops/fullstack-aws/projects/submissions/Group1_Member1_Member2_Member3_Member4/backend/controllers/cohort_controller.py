"""/api/cohorts: staff manage cohorts; trainees see their own."""
from fastapi import APIRouter, Depends, Response

from auth_guard import current_user, staff
from dependencies import Container, get_container
from models import CohortCreate, CohortUpdate, MembersIn

router = APIRouter(prefix="/api/cohorts", tags=["Cohorts"])


@router.get("")
def list_cohorts(user: dict = Depends(current_user), c: Container = Depends(get_container)):
    if user["role"] == "TRAINEE":
        return c.cohorts.list_for_trainee(str(user["_id"]))
    return c.cohorts.list()


@router.post("", status_code=201)
def create_cohort(body: CohortCreate, actor: dict = Depends(staff), c: Container = Depends(get_container)):
    return c.cohorts.create(actor, body)


@router.get("/{cohort_id}")
def get_cohort(cohort_id: str, _: dict = Depends(staff), c: Container = Depends(get_container)):
    return c.cohorts.get(cohort_id)


@router.patch("/{cohort_id}")
def update_cohort(cohort_id: str, body: CohortUpdate, _: dict = Depends(staff), c: Container = Depends(get_container)):
    return c.cohorts.update(cohort_id, body)


@router.delete("/{cohort_id}", status_code=204)
def delete_cohort(cohort_id: str, _: dict = Depends(staff), c: Container = Depends(get_container)):
    c.cohorts.delete(cohort_id)
    return Response(status_code=204)


@router.post("/{cohort_id}/members")
def add_members(cohort_id: str, body: MembersIn, _: dict = Depends(staff), c: Container = Depends(get_container)):
    return c.cohorts.add_members(cohort_id, body.trainee_ids)


@router.delete("/{cohort_id}/members/{trainee_id}")
def remove_member(cohort_id: str, trainee_id: str, _: dict = Depends(staff), c: Container = Depends(get_container)):
    return c.cohorts.remove_member(cohort_id, trainee_id)
