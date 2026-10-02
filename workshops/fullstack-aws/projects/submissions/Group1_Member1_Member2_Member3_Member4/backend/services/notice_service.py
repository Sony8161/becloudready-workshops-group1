"""Notices: announcements to everyone, one cohort, or one trainee, with read tracking."""
from __future__ import annotations

from errors import BadRequest, Forbidden, NotFound
from repositories.cohort_repository import CohortRepository
from repositories.notice_repository import NoticeRepository
from repositories.user_repository import UserRepository
from serializers import clean, now, oid
from services.notification_service import NotificationService

STAFF = {"HR", "MANAGER"}


class NoticeService:
    def __init__(self, notices: NoticeRepository, cohorts: CohortRepository, users: UserRepository,
                 notifications: NotificationService):
        self.notices = notices
        self.cohorts = cohorts
        self.users = users
        self.notifications = notifications

    def _doc(self, notice_id: str) -> dict:
        n = self.notices.find_by_id(oid(notice_id, "Notice"))
        if not n:
            raise NotFound("Notice not found")
        return n

    def _audience(self, n: dict, active: set[str], members: dict[str, list[str]]) -> list[str]:
        if n["audience_type"] == "ALL":
            return sorted(active)
        if n["audience_type"] == "COHORT":
            return [t for t in members.get(n["audience_id"], []) if t in active]
        return [n["audience_id"]] if n["audience_id"] in active else []

    def _context(self):
        active = {str(u["_id"]) for u in self.users.search(role="TRAINEE", status="ACTIVE")}
        cohorts = self.cohorts.find_all()
        members = {str(c["_id"]): c.get("trainee_ids", []) for c in cohorts}
        names = {str(c["_id"]): c["name"] for c in cohorts}
        return active, members, names

    def _audience_name(self, n: dict, names: dict[str, str]) -> str:
        if n["audience_type"] == "ALL":
            return "Everyone"
        if n["audience_type"] == "COHORT":
            return names.get(n["audience_id"], "(removed cohort)")
        u = self.users.find_by_id(oid(n["audience_id"]))
        return u["name"] if u else "(removed trainee)"

    def _staff_view(self, n: dict, active, members, names, authors) -> dict:
        audience = self._audience(n, active, members)
        read = set(n.get("read_by", []))
        item = clean(n)
        item.pop("read_by", None)
        item["audience_name"] = self._audience_name(n, names)
        item["audience_size"] = len(audience)
        item["read_count"] = len([t for t in audience if t in read])
        item["author"] = authors.get(n.get("created_by"), "")
        return item

    def _authors(self, notices: list[dict]) -> dict[str, str]:
        ids = list({n.get("created_by") for n in notices if n.get("created_by")})
        return {str(u["_id"]): u["name"] for u in self.users.find_by_ids(ids)}

    # ---------- reads ----------
    def list_for_staff(self) -> list[dict]:
        notices = self.notices.find()
        active, members, names = self._context()
        authors = self._authors(notices)
        return [self._staff_view(n, active, members, names, authors) for n in notices]

    def visible_query(self, trainee_id: str) -> dict:
        cohort_ids = [str(c["_id"]) for c in self.cohorts.find_for_trainee(trainee_id)]
        return {
            "$or": [
                {"audience_type": "ALL"},
                {"audience_type": "COHORT", "audience_id": {"$in": cohort_ids}},
                {"audience_type": "TRAINEE", "audience_id": trainee_id},
            ]
        }

    def list_for_trainee(self, trainee_id: str) -> list[dict]:
        notices = self.notices.find(self.visible_query(trainee_id))
        _, _, names = self._context()
        authors = self._authors(notices)
        out = []
        for n in notices:
            item = clean(n)
            item["read"] = trainee_id in n.get("read_by", [])
            item.pop("read_by", None)
            item["audience_name"] = self._audience_name(n, names)
            item["author"] = authors.get(n.get("created_by"), "")
            out.append(item)
        return out

    def get_for_staff(self, notice_id: str) -> dict:
        n = self._doc(notice_id)
        active, members, names = self._context()
        item = self._staff_view(n, active, members, names, self._authors([n]))
        audience = self._audience(n, active, members)
        read = set(n.get("read_by", []))
        people = {str(u["_id"]): u["name"] for u in self.users.find_by_ids(audience)}
        item["read_by"] = sorted([people[t] for t in audience if t in read and t in people])
        item["not_read_by"] = sorted([people[t] for t in audience if t not in read and t in people])
        return item

    # ---------- writes ----------
    def create(self, actor: dict, data) -> dict:
        audience_id = None
        if data.audience_type.value == "COHORT":
            if not data.audience_id or not self.cohorts.find_by_id(oid(data.audience_id, "Cohort")):
                raise BadRequest("Pick a cohort for this notice")
            audience_id = data.audience_id
        elif data.audience_type.value == "TRAINEE":
            u = self.users.find_by_id(oid(data.audience_id or "", "Trainee")) if data.audience_id else None
            if not u or u["role"] != "TRAINEE":
                raise BadRequest("Pick a trainee for this notice")
            audience_id = data.audience_id
        doc = {
            "title": data.title,
            "body": data.body,
            "priority": data.priority.value,
            "audience_type": data.audience_type.value,
            "audience_id": audience_id,
            "pinned": data.pinned,
            "read_by": [],
            "created_by": str(actor["_id"]),
            "created_at": now(),
        }
        n = self.notices.insert(doc)
        active, members, _ = self._context()
        label = {"URGENT": "Urgent notice", "IMPORTANT": "Important notice"}.get(n["priority"], "New notice")
        self.notifications.notify(self._audience(n, active, members), "NOTICE", f"{label}: {n['title']}",
                                  n["body"][:140], f"/me/notices/{n['_id']}")
        return self.get_for_staff(str(n["_id"]))

    def update(self, notice_id: str, data) -> dict:
        n = self._doc(notice_id)
        fields = data.model_dump(exclude_unset=True)
        for k in ("priority",):
            if k in fields and fields[k] is not None:
                fields[k] = fields[k].value if hasattr(fields[k], "value") else fields[k]
        if fields:
            fields["updated_at"] = now()
            self.notices.update(n["_id"], fields)
        return self.get_for_staff(notice_id)

    def delete(self, notice_id: str) -> None:
        n = self._doc(notice_id)
        self.notices.delete(n["_id"])

    def mark_read(self, user: dict, notice_id: str) -> dict:
        n = self._doc(notice_id)
        uid = str(user["_id"])
        if user["role"] not in STAFF:
            visible = self.notices.find({"_id": n["_id"], **self.visible_query(uid)})
            if not visible:
                raise Forbidden("This notice isn't for you")
        self.notices.mark_read(n["_id"], uid)
        return {"ok": True}
