"""People: HR onboarding (one by one or bulk import), duplicate checks, deactivate, password resets."""
from __future__ import annotations

from datetime import date

from email_validator import EmailNotValidError, validate_email

from errors import BadRequest, Conflict, Forbidden, NotFound
from repositories.cohort_repository import CohortRepository
from repositories.user_repository import DuplicateEmail, UserRepository
from security import hash_password, temp_password
from serializers import clean, date_str, now, oid
from services.auth_service import name_key
from services.notification_service import NotificationService


def _summary(u: dict) -> dict:
    return {"id": str(u["_id"]), "name": u["name"], "email": u["email"], "status": u.get("status")}


class UserService:
    def __init__(self, users: UserRepository, cohorts: CohortRepository, notifications: NotificationService):
        self.users = users
        self.cohorts = cohorts
        self.notifications = notifications

    # ---------- reads ----------
    def _cohort_names_by_trainee(self) -> dict[str, list[dict]]:
        out: dict[str, list[dict]] = {}
        for c in self.cohorts.find_all():
            for tid in c.get("trainee_ids", []):
                out.setdefault(tid, []).append({"id": str(c["_id"]), "name": c["name"]})
        return out

    def list(self, role=None, status=None, q=None) -> list[dict]:
        cohorts_by = self._cohort_names_by_trainee()
        rows = []
        for u in self.users.search(role, status, q):
            item = clean(u)
            if u["role"] == "TRAINEE":
                item["cohorts"] = cohorts_by.get(str(u["_id"]), [])
            rows.append(item)
        return rows

    def get(self, user_id: str) -> dict:
        user = self.users.find_by_id(oid(user_id, "User"))
        if not user:
            raise NotFound("User not found")
        item = clean(user)
        if user["role"] == "TRAINEE":
            item["cohorts"] = [
                {"id": str(c["_id"]), "name": c["name"]} for c in self.cohorts.find_for_trainee(user_id)
            ]
        return item

    def get_doc(self, user_id: str) -> dict:
        user = self.users.find_by_id(oid(user_id, "User"))
        if not user:
            raise NotFound("User not found")
        return user

    # ---------- onboarding ----------
    def create(self, actor: dict, data) -> dict:
        email = data.email.lower()
        existing = self.users.find_by_email(email)
        if existing:
            raise Conflict(
                "Someone already has this email",
                {"code": "EMAIL_EXISTS", "existing": _summary(existing)},
            )
        key = name_key(data.name)
        if data.role.value == "TRAINEE" and not data.force:
            matches = self.users.find_by_name_key(key, "TRAINEE")
            if matches:
                raise Conflict(
                    "A trainee with the same name already exists. Is this the same person?",
                    {"code": "POSSIBLE_DUPLICATE", "matches": [_summary(m) for m in matches]},
                )
        cohort = None
        if data.cohort_id:
            if data.role.value != "TRAINEE":
                raise BadRequest("Only trainees can join a cohort")
            cohort = self.cohorts.find_by_id(oid(data.cohort_id, "Cohort"))
            if not cohort:
                raise NotFound("Cohort not found")

        password = temp_password()
        doc = {
            "name": data.name,
            "name_key": key,
            "email": email,
            "role": data.role.value,
            "status": "ACTIVE",
            "track": data.track or None,
            "phone": data.phone or None,
            "start_date": date_str(data.start_date),
            "password_hash": hash_password(password),
            "must_change_password": True,
            "token_version": 0,
            "created_at": now(),
            "created_by": str(actor["_id"]),
        }
        try:
            user = self.users.insert(doc)
        except DuplicateEmail:
            raise Conflict("Someone already has this email", {"code": "EMAIL_EXISTS"})
        uid = str(user["_id"])
        if cohort:
            self.cohorts.add_members(cohort["_id"], [uid])
        self.notifications.notify(
            [uid],
            "WELCOME",
            "Welcome to NoticeBoardTracker",
            "Your notices, training plans and progress reports all live here.",
            "/me",
        )
        if cohort:
            self.notifications.notify([uid], "COHORT", f"You joined {cohort['name']}", "", "/me")
        return {"user": self.get(uid), "temporary_password": password}

    # ---------- bulk import (replaces the Excel sheet) ----------
    def import_preview(self, rows) -> dict:
        cohorts = {c["name_key"]: c for c in self.cohorts.find_all()}
        parsed = []
        for i, r in enumerate(rows, start=1):
            name = " ".join((r.name or "").split())
            email = (r.email or "").strip().lower()
            item = {
                "row": i,
                "name": name,
                "email": email,
                "track": (r.track or "").strip() or None,
                "phone": (r.phone or "").strip() or None,
                "start_date": None,
                "cohort": (r.cohort or "").strip() or None,
                "cohort_id": None,
                "status": "NEW",
                "message": "",
                "matches": [],
            }
            problems = []
            if len(name) < 2:
                problems.append("Name is missing")
            try:
                email = validate_email(email, check_deliverability=False).normalized.lower()
                item["email"] = email
            except EmailNotValidError:
                problems.append("Email is not valid")
            if r.start_date and r.start_date.strip():
                try:
                    item["start_date"] = date.fromisoformat(r.start_date.strip()).isoformat()
                except ValueError:
                    problems.append("Start date must be YYYY-MM-DD")
            if item["cohort"]:
                c = cohorts.get(name_key(item["cohort"]))
                if c:
                    item["cohort_id"] = str(c["_id"])
                    item["cohort"] = c["name"]
                else:
                    problems.append(f"Cohort '{item['cohort']}' does not exist")
            if problems:
                item["status"] = "INVALID"
                item["message"] = "; ".join(problems)
            parsed.append(item)

        valid = [p for p in parsed if p["status"] == "NEW"]
        existing_emails = {u["email"]: u for u in self.users.find_by_emails([p["email"] for p in valid])}
        existing_names: dict[str, list[dict]] = {}
        for u in self.users.find_by_name_keys([name_key(p["name"]) for p in valid]):
            if u["role"] == "TRAINEE":
                existing_names.setdefault(u["name_key"], []).append(u)

        seen_emails: dict[str, int] = {}
        seen_names: dict[str, int] = {}
        for p in valid:
            key = name_key(p["name"])
            if p["email"] in existing_emails:
                p["status"] = "EXISTS"
                p["message"] = "Already in the system (same email)"
                p["matches"] = [_summary(existing_emails[p["email"]])]
            elif p["email"] in seen_emails:
                p["status"] = "DUPLICATE_IN_FILE"
                p["message"] = f"Same email as row {seen_emails[p['email']]}"
            elif key in existing_names:
                p["status"] = "POSSIBLE_DUPLICATE"
                p["message"] = "Same name as an existing trainee (different email)"
                p["matches"] = [_summary(u) for u in existing_names[key]]
            elif key in seen_names:
                p["status"] = "POSSIBLE_DUPLICATE"
                p["message"] = f"Same name as row {seen_names[key]} (different email)"
            seen_emails.setdefault(p["email"], p["row"])
            seen_names.setdefault(key, p["row"])

        counts: dict[str, int] = {}
        for p in parsed:
            counts[p["status"]] = counts.get(p["status"], 0) + 1
        return {"rows": parsed, "counts": counts}

    def import_rows(self, actor: dict, rows, include_possible_duplicates=False) -> dict:
        preview = self.import_preview(rows)
        allowed = {"NEW", "POSSIBLE_DUPLICATE"} if include_possible_duplicates else {"NEW"}
        created, skipped = [], []
        for p in preview["rows"]:
            if p["status"] not in allowed:
                skipped.append({"row": p["row"], "name": p["name"], "email": p["email"], "reason": p["message"] or p["status"]})
                continue
            password = temp_password()
            doc = {
                "name": p["name"],
                "name_key": name_key(p["name"]),
                "email": p["email"],
                "role": "TRAINEE",
                "status": "ACTIVE",
                "track": p["track"],
                "phone": p["phone"],
                "start_date": p["start_date"],
                "password_hash": hash_password(password),
                "must_change_password": True,
                "token_version": 0,
                "created_at": now(),
                "created_by": str(actor["_id"]),
            }
            try:
                user = self.users.insert(doc)
            except DuplicateEmail:
                skipped.append({"row": p["row"], "name": p["name"], "email": p["email"], "reason": "Email already exists"})
                continue
            uid = str(user["_id"])
            if p["cohort_id"]:
                self.cohorts.add_members(oid(p["cohort_id"]), [uid])
            self.notifications.notify([uid], "WELCOME", "Welcome to NoticeBoardTracker", "", "/me")
            created.append({"row": p["row"], "id": uid, "name": p["name"], "email": p["email"],
                            "cohort": p["cohort"], "temporary_password": password})
        return {"created": created, "skipped": skipped}

    def duplicates(self) -> list[dict]:
        groups: dict[str, list[dict]] = {}
        for u in self.users.all_name_keys("TRAINEE"):
            groups.setdefault(u["name_key"], []).append(_summary(u))
        return [{"name": g[0]["name"], "people": g} for g in groups.values() if len(g) > 1]

    # ---------- edits ----------
    def update(self, user_id: str, data) -> dict:
        user = self.get_doc(user_id)
        fields = data.model_dump(exclude_unset=True)
        if "name" in fields:
            fields["name_key"] = name_key(fields["name"])
        if "email" in fields:
            fields["email"] = fields["email"].lower()
        if "start_date" in fields:
            fields["start_date"] = date_str(fields["start_date"])
        if not fields:
            return self.get(user_id)
        try:
            self.users.update(user["_id"], fields)
        except DuplicateEmail:
            raise Conflict("Someone already has this email", {"code": "EMAIL_EXISTS"})
        return self.get(user_id)

    def set_status(self, actor: dict, user_id: str, status: str) -> dict:
        user = self.get_doc(user_id)
        if user["_id"] == actor["_id"]:
            raise Forbidden("You can't change your own status")
        if status == "INACTIVE":
            self.users.bump_token_version(user["_id"], {"status": "INACTIVE"})  # signs them out
        else:
            self.users.update(user["_id"], {"status": "ACTIVE"})
        return self.get(user_id)

    def reset_password(self, actor: dict, user_id: str) -> dict:
        user = self.get_doc(user_id)
        if user["_id"] == actor["_id"]:
            raise Forbidden("Use Change password for your own account")
        password = temp_password()
        self.users.bump_token_version(
            user["_id"], {"password_hash": hash_password(password), "must_change_password": True}
        )
        return {"user": self.get(user_id), "temporary_password": password}
