"""Progress reports: trainees submit them, managers read them and reply with feedback."""
from __future__ import annotations

from errors import BadRequest, NotFound
from repositories.cohort_repository import CohortRepository
from repositories.plan_repository import PlanRepository
from repositories.report_repository import ReportRepository
from repositories.user_repository import UserRepository
from serializers import clean, now, oid
from services.notification_service import NotificationService
from services.plan_service import PlanService


class ReportService:
    def __init__(self, reports: ReportRepository, plans: PlanRepository, cohorts: CohortRepository,
                 users: UserRepository, plan_service: PlanService, notifications: NotificationService):
        self.reports = reports
        self.plans = plans
        self.cohorts = cohorts
        self.users = users
        self.plan_service = plan_service
        self.notifications = notifications

    def _view(self, reports: list[dict]) -> list[dict]:
        plan_ids = list({r["plan_id"] for r in reports})
        plans = {str(p["_id"]): p for p in self.plans.find({"_id": {"$in": [oid(i) for i in plan_ids]}})}
        trainees = {str(u["_id"]): u["name"] for u in self.users.find_by_ids(list({r["trainee_id"] for r in reports}))}
        out = []
        for r in reports:
            item = clean(r)
            p = plans.get(r["plan_id"])
            item["plan_title"] = p["title"] if p else "(removed plan)"
            task = next((t for t in (p or {}).get("tasks", []) if t["id"] == r.get("task_id")), None)
            item["task_title"] = task["title"] if task else None
            item["trainee_name"] = trainees.get(r["trainee_id"], "?")
            out.append(item)
        return out

    def create(self, trainee: dict, data) -> dict:
        tid = str(trainee["_id"])
        plan = self.plans.find_by_id(oid(data.plan_id, "Plan"))
        if not plan:
            raise NotFound("Plan not found")
        self.plan_service.ensure_trainee_can_see(tid, plan)
        task = None
        if data.task_id:
            task = next((t for t in plan.get("tasks", []) if t["id"] == data.task_id), None)
            if not task:
                raise BadRequest("That task is not part of this plan")
        if data.status.value == "DONE" and not task:
            raise BadRequest("Pick the task you finished")
        if data.status.value == "BLOCKED" and not (data.blockers or "").strip():
            raise BadRequest("Tell your manager what is blocking you")
        doc = {
            "trainee_id": tid,
            "plan_id": data.plan_id,
            "task_id": data.task_id,
            "status": data.status.value,
            "summary": data.summary,
            "blockers": data.blockers or "",
            "hours": data.hours,
            "feedback": None,
            "reviewed": False,
            "created_at": now(),
        }
        r = self.reports.insert(doc)

        # Tell the people who own this plan.
        recipients = [plan.get("created_by")]
        if plan["assignee_type"] == "COHORT":
            c = self.cohorts.find_by_id(oid(plan["assignee_id"]))
            if c and c.get("manager_id"):
                recipients.append(c["manager_id"])
        what = f" on '{task['title']}'" if task else ""
        if doc["status"] == "BLOCKED":
            title = f"{trainee['name']} is blocked{what}"
            type_ = "BLOCKED"
        elif doc["status"] == "DONE":
            title = f"{trainee['name']} finished '{task['title']}'"
            type_ = "REPORT"
        else:
            title = f"{trainee['name']} sent a progress report{what}"
            type_ = "REPORT"
        self.notifications.notify(recipients, type_, title, doc["summary"][:140], f"/reports?focus={r['_id']}")
        return self._view([r])[0]

    def list(self, trainee_id=None, plan_id=None, cohort_id=None, status=None, awaiting_feedback=False,
             limit=200) -> list[dict]:
        q: dict = {}
        if trainee_id:
            q["trainee_id"] = trainee_id
        if plan_id:
            q["plan_id"] = plan_id
        if cohort_id:
            c = self.cohorts.find_by_id(oid(cohort_id, "Cohort"))
            q["trainee_id"] = {"$in": c.get("trainee_ids", []) if c else []}
        if status:
            q["status"] = status
        if awaiting_feedback:
            q["reviewed"] = False
        return self._view(self.reports.find(q, limit=limit))

    def list_mine(self, trainee_id: str) -> list[dict]:
        return self._view(self.reports.find({"trainee_id": trainee_id}, limit=200))

    def feedback(self, actor: dict, report_id: str, text: str) -> dict:
        r = self.reports.find_by_id(oid(report_id, "Report"))
        if not r:
            raise NotFound("Report not found")
        fb = {"text": text, "by": str(actor["_id"]), "by_name": actor["name"], "at": now()}
        r = self.reports.set_fields(r["_id"], {"feedback": fb, "reviewed": True})
        self.notifications.notify([r["trainee_id"]], "FEEDBACK", f"{actor['name']} replied to your report",
                                  text[:140], "/me/reports")
        return self._view([r])[0]

    def mark_reviewed(self, report_id: str) -> dict:
        """Seen, nothing to add (no notification to the trainee)."""
        r = self.reports.find_by_id(oid(report_id, "Report"))
        if not r:
            raise NotFound("Report not found")
        return self._view([self.reports.set_fields(r["_id"], {"reviewed": True})])[0]
