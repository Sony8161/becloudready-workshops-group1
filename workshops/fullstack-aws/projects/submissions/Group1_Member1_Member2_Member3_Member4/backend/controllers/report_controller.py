"""/api/reports: trainees submit progress; managers review and give feedback."""
from typing import Optional

from fastapi import APIRouter, Depends

from auth_guard import current_user, staff, trainee_only
from dependencies import Container, get_container
from models import FeedbackIn, ReportCreate, ReportStatus

router = APIRouter(prefix="/api/reports", tags=["Progress reports"])


@router.get("")
def list_reports(trainee_id: Optional[str] = None, plan_id: Optional[str] = None, cohort_id: Optional[str] = None,
                 status: Optional[ReportStatus] = None, awaiting_feedback: bool = False,
                 user: dict = Depends(current_user), c: Container = Depends(get_container)):
    if user["role"] == "TRAINEE":
        return c.reports.list_mine(str(user["_id"]))
    return c.reports.list(trainee_id, plan_id, cohort_id, status.value if status else None, awaiting_feedback)


@router.post("", status_code=201)
def submit_report(body: ReportCreate, trainee: dict = Depends(trainee_only), c: Container = Depends(get_container)):
    return c.reports.create(trainee, body)


@router.post("/{report_id}/feedback")
def give_feedback(report_id: str, body: FeedbackIn, actor: dict = Depends(staff),
                  c: Container = Depends(get_container)):
    return c.reports.feedback(actor, report_id, body.text)


@router.post("/{report_id}/reviewed")
def mark_reviewed(report_id: str, _: dict = Depends(staff), c: Container = Depends(get_container)):
    return c.reports.mark_reviewed(report_id)
