"""Cohorts: groups of trainees led by a Training Manager."""
from __future__ import annotations

from errors import BadRequest, Conflict, NotFound
from repositories.cohort_repository import CohortRepository, DuplicateCohort
from repositories.plan_repository import PlanRepository
from repositories.user_repository import UserRepository
from serializers import clean, date_str, now, oid
from services.auth_service import name_key
from services.notification_service import NotificationService


class CohortService:
    def __init__(self, cohorts: CohortRepository, users: UserRepository, plans: PlanRepository,
                 notifications: NotificationService):
        self.cohorts = cohorts
        self.users = users
        self.plans = plans
        self.notifications = notifications

    def _doc(self, cohort_id: str) -> dict:
        c = self.cohorts.find_by_id(oid(cohort_id, "Cohort"))
        if not c:
            raise NotFound("Cohort not found")
        return c

    def _view(self, c: dict, managers: dict[str, dict]) -> dict:
        item = clean(c)
        m = managers.get(c.get("manager_id") or "")
        item["manager"] = {"id": str(m["_id"]), "name": m["name"]} if m else None
        item["trainee_count"] = len(c.get("trainee_ids", []))
        item["plan_count"] = self.plans.count(
            {"assignee_type": "COHORT", "assignee_id": str(c["_id"]), "status": "ACTIVE"}
        )
        return item

    def _managers(self, cohorts: list[dict]) -> dict[str, dict]:
        ids = [c["manager_id"] for c in cohorts if c.get("manager_id")]
        return {str(u["_id"]): u for u in self.users.find_by_ids(ids)}

    def list(self, only_ids: list[str] | None = None) -> list[dict]:
        cohorts = self.cohorts.find_all()
        if only_ids is not None:
            cohorts = [c for c in cohorts if str(c["_id"]) in only_ids]
        managers = self._managers(cohorts)
        return [self._view(c, managers) for c in cohorts]

    def list_for_trainee(self, trainee_id: str) -> list[dict]:
        cohorts = self.cohorts.find_for_trainee(trainee_id)
        managers = self._managers(cohorts)
        out = []
        for c in cohorts:
            item = self._view(c, managers)
            item.pop("trainee_ids", None)  # trainees don't need the member list
            out.append(item)
        return out

    def get(self, cohort_id: str) -> dict:
        c = self._doc(cohort_id)
        item = self._view(c, self._managers([c]))
        members = self.users.find_by_ids(c.get("trainee_ids", []))
        item["members"] = sorted(
            [{"id": str(u["_id"]), "name": u["name"], "email": u["email"], "status": u["status"],
              "track": u.get("track")} for u in members],
            key=lambda m: m["name"].lower(),
        )
        return item

    def _check_manager(self, manager_id: str | None) -> None:
        if not manager_id:
            return
        m = self.users.find_by_id(oid(manager_id, "Manager"))
        if not m or m["role"] != "MANAGER" or m["status"] != "ACTIVE":
            raise BadRequest("Lead must be an active Training Manager")

    def create(self, actor: dict, data) -> dict:
        manager_id = data.manager_id or (str(actor["_id"]) if actor["role"] == "MANAGER" else None)
        self._check_manager(manager_id)
        if data.start_date and data.end_date and data.end_date < data.start_date:
            raise BadRequest("End date is before start date")
        doc = {
            "name": data.name,
            "name_key": name_key(data.name),
            "description": data.description or "",
            "manager_id": manager_id,
            "trainee_ids": [],
            "start_date": date_str(data.start_date),
            "end_date": date_str(data.end_date),
            "created_at": now(),
            "created_by": str(actor["_id"]),
        }
        try:
            c = self.cohorts.insert(doc)
        except DuplicateCohort:
            raise Conflict("A cohort with this name already exists")
        return self.get(str(c["_id"]))

    def update(self, cohort_id: str, data) -> dict:
        c = self._doc(cohort_id)
        fields = data.model_dump(exclude_unset=True)
        if "manager_id" in fields:
            self._check_manager(fields["manager_id"])
        if "name" in fields:
            fields["name_key"] = name_key(fields["name"])
        for k in ("start_date", "end_date"):
            if k in fields:
                fields[k] = date_str(fields[k])
        start = fields.get("start_date", c.get("start_date"))
        end = fields.get("end_date", c.get("end_date"))
        if start and end and end < start:
            raise BadRequest("End date is before start date")
        if fields:
            try:
                self.cohorts.update(c["_id"], fields)
            except DuplicateCohort:
                raise Conflict("A cohort with this name already exists")
        return self.get(cohort_id)

    def delete(self, cohort_id: str) -> None:
        c = self._doc(cohort_id)
        active = self.plans.count({"assignee_type": "COHORT", "assignee_id": cohort_id, "status": "ACTIVE"})
        if active:
            raise Conflict(f"This cohort still has {active} active plan(s). Archive them first.")
        self.cohorts.delete(c["_id"])

    def add_members(self, cohort_id: str, trainee_ids: list[str]) -> dict:
        c = self._doc(cohort_id)
        found = self.users.find_by_ids(trainee_ids)
        ok = [str(u["_id"]) for u in found if u["role"] == "TRAINEE" and u["status"] == "ACTIVE"]
        if len(ok) != len(set(trainee_ids)):
            raise BadRequest("Every member must be an active trainee")
        new = [t for t in ok if t not in c.get("trainee_ids", [])]
        self.cohorts.add_members(c["_id"], ok)
        self.notifications.notify(new, "COHORT", f"You joined {c['name']}",
                                  "Plans and notices for this cohort now show on your home page.", "/me")
        return self.get(cohort_id)

    def remove_member(self, cohort_id: str, trainee_id: str) -> dict:
        c = self._doc(cohort_id)
        if trainee_id not in c.get("trainee_ids", []):
            raise NotFound("This trainee is not in the cohort")
        self.cohorts.remove_member(c["_id"], trainee_id)
        return self.get(cohort_id)
