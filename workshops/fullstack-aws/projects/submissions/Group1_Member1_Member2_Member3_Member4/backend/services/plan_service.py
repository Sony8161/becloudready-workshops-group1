"""Training plans: a list of tasks assigned to a cohort (usual case) or one trainee (solo track)."""
from __future__ import annotations

import uuid

from errors import BadRequest, Forbidden, NotFound
from repositories.cohort_repository import CohortRepository
from repositories.plan_repository import PlanRepository
from repositories.report_repository import ReportRepository
from repositories.user_repository import UserRepository
from serializers import clean, date_str, now, oid
from services.notification_service import NotificationService
from services.progress_service import group_reports, plan_audience, plan_progress


def _task_id() -> str:
    return uuid.uuid4().hex[:8]


class PlanService:
    def __init__(self, plans: PlanRepository, cohorts: CohortRepository, users: UserRepository,
                 reports: ReportRepository, notifications: NotificationService):
        self.plans = plans
        self.cohorts = cohorts
        self.users = users
        self.reports = reports
        self.notifications = notifications

    # ---------- helpers ----------
    def _doc(self, plan_id: str) -> dict:
        p = self.plans.find_by_id(oid(plan_id, "Plan"))
        if not p:
            raise NotFound("Plan not found")
        return p

    def _active_trainee_ids(self) -> set[str]:
        return {str(u["_id"]) for u in self.users.search(role="TRAINEE", status="ACTIVE")}

    def _cohort_members(self) -> dict[str, list[str]]:
        return {str(c["_id"]): c.get("trainee_ids", []) for c in self.cohorts.find_all()}

    def audience_ids(self, plan: dict) -> list[str]:
        active = self._active_trainee_ids()
        return [t for t in plan_audience(plan, self._cohort_members()) if t in active]

    def _check_assignee(self, assignee_type: str, assignee_id: str) -> str:
        """Returns the assignee's display name."""
        if assignee_type == "COHORT":
            c = self.cohorts.find_by_id(oid(assignee_id, "Cohort"))
            if not c:
                raise NotFound("Cohort not found")
            return c["name"]
        u = self.users.find_by_id(oid(assignee_id, "Trainee"))
        if not u or u["role"] != "TRAINEE" or u["status"] != "ACTIVE":
            raise BadRequest("Solo plans must go to an active trainee")
        return u["name"]

    def _assignee_names(self, plans: list[dict]) -> dict[str, str]:
        names = {str(c["_id"]): c["name"] for c in self.cohorts.find_all()}
        trainee_ids = [p["assignee_id"] for p in plans if p["assignee_type"] == "TRAINEE"]
        names.update({str(u["_id"]): u["name"] for u in self.users.find_by_ids(trainee_ids)})
        return names

    def _tasks(self, tasks_in, old_tasks: list[dict] | None = None) -> list[dict]:
        old_ids = {t["id"] for t in (old_tasks or [])}
        out = []
        for t in tasks_in:
            tid = t.id if t.id in old_ids else _task_id()
            out.append({"id": tid, "title": t.title, "due_date": date_str(t.due_date)})
        return out

    def _summary(self, p: dict, names: dict[str, str], members: dict[str, list[str]],
                 active: set[str], grouped) -> dict:
        item = clean(p)
        item["assignee_name"] = names.get(p["assignee_id"], "(removed)")
        audience = [t for t in plan_audience(p, members) if t in active]
        progresses = [plan_progress(p, grouped.get((t, str(p["_id"])), []))["progress"] for t in audience]
        item["trainee_count"] = len(audience)
        item["task_count"] = len(p.get("tasks", []))
        item["avg_progress"] = round(sum(progresses) / len(progresses)) if progresses else 0
        return item

    # ---------- staff ----------
    def list(self, status="ACTIVE", assignee_type=None, assignee_id=None) -> list[dict]:
        q: dict = {}
        if status:
            q["status"] = status
        if assignee_type:
            q["assignee_type"] = assignee_type
        if assignee_id:
            q["assignee_id"] = assignee_id
        plans = self.plans.find(q)
        names = self._assignee_names(plans)
        members = self._cohort_members()
        active = self._active_trainee_ids()
        grouped = group_reports(self.reports.for_progress({"plan_id": {"$in": [str(p["_id"]) for p in plans]}}))
        return [self._summary(p, names, members, active, grouped) for p in plans]

    def get(self, plan_id: str) -> dict:
        p = self._doc(plan_id)
        names = self._assignee_names([p])
        members = self._cohort_members()
        active = self._active_trainee_ids()
        grouped = group_reports(self.reports.for_progress({"plan_id": plan_id}))
        item = self._summary(p, names, members, active, grouped)
        audience = [t for t in plan_audience(p, members) if t in active]
        people = {str(u["_id"]): u for u in self.users.find_by_ids(audience)}
        rows = []
        for t in audience:
            prog = plan_progress(p, grouped.get((t, plan_id), []))
            prog.pop("tasks")
            u = people.get(t)
            rows.append({"trainee_id": t, "name": u["name"] if u else "?", **prog})
        item["trainees"] = sorted(rows, key=lambda r: r["name"].lower())
        return item

    def create(self, actor: dict, data) -> dict:
        name = self._check_assignee(data.assignee_type.value, data.assignee_id)
        doc = {
            "title": data.title,
            "description": data.description or "",
            "assignee_type": data.assignee_type.value,
            "assignee_id": data.assignee_id,
            "tasks": self._tasks(data.tasks),
            "status": "ACTIVE",
            "created_by": str(actor["_id"]),
            "created_at": now(),
        }
        p = self.plans.insert(doc)
        self.notifications.notify(
            self.audience_ids(p), "PLAN", f"New training plan: {p['title']}",
            f"{len(p['tasks'])} task(s), assigned to {name}.", f"/me/plans/{p['_id']}",
        )
        return self.get(str(p["_id"]))

    def update(self, plan_id: str, data) -> dict:
        p = self._doc(plan_id)
        fields = data.model_dump(exclude_unset=True)
        if "tasks" in fields:
            fields["tasks"] = self._tasks(data.tasks, p.get("tasks"))
        if fields:
            fields["updated_at"] = now()
            p = self.plans.update(p["_id"], fields)
            self.notifications.notify(self.audience_ids(p), "PLAN", f"Plan updated: {p['title']}", "",
                                      f"/me/plans/{p['_id']}")
        return self.get(plan_id)

    def set_status(self, plan_id: str, status: str) -> dict:
        p = self._doc(plan_id)
        self.plans.update(p["_id"], {"status": status, "updated_at": now()})
        return self.get(plan_id)

    def copy(self, actor: dict, plan_id: str, data) -> dict:
        p = self._doc(plan_id)
        name = self._check_assignee(data.assignee_type.value, data.assignee_id)
        doc = {
            "title": p["title"],
            "description": p.get("description", ""),
            "assignee_type": data.assignee_type.value,
            "assignee_id": data.assignee_id,
            "tasks": [{**t, "id": _task_id()} for t in p.get("tasks", [])],
            "status": "ACTIVE",
            "created_by": str(actor["_id"]),
            "created_at": now(),
            "copied_from": plan_id,
        }
        new = self.plans.insert(doc)
        self.notifications.notify(
            self.audience_ids(new), "PLAN", f"New training plan: {new['title']}",
            f"{len(new['tasks'])} task(s), assigned to {name}.", f"/me/plans/{new['_id']}",
        )
        return self.get(str(new["_id"]))

    # ---------- trainee ----------
    def plans_for_trainee(self, trainee_id: str) -> list[dict]:
        cohort_ids = [str(c["_id"]) for c in self.cohorts.find_for_trainee(trainee_id)]
        return self.plans.find_for_assignees(trainee_id, cohort_ids)

    def ensure_trainee_can_see(self, trainee_id: str, plan: dict) -> None:
        if plan["status"] != "ACTIVE":
            raise NotFound("Plan not found")
        if plan["assignee_type"] == "TRAINEE":
            ok = plan["assignee_id"] == trainee_id
        else:
            c = self.cohorts.find_by_id(oid(plan["assignee_id"]))
            ok = bool(c and trainee_id in c.get("trainee_ids", []))
        if not ok:
            raise Forbidden("This plan isn't assigned to you")

    def get_for_trainee(self, trainee_id: str, plan_id: str) -> dict:
        p = self._doc(plan_id)
        self.ensure_trainee_can_see(trainee_id, p)
        reports = self.reports.for_progress({"plan_id": plan_id, "trainee_id": trainee_id})
        item = clean(p)
        item["assignee_name"] = self._assignee_names([p]).get(p["assignee_id"])
        item["my_progress"] = plan_progress(p, reports)
        return item
