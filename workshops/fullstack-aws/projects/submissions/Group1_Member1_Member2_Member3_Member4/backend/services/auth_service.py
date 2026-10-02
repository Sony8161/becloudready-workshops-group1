"""Login, current user, change password, first HR account."""
from __future__ import annotations

import config
from errors import BadRequest, Unauthorized
from repositories.user_repository import UserRepository
from security import create_token, hash_password, verify_password
from serializers import clean, now


def name_key(name: str) -> str:
    """'  Jane   DOE ' -> 'jane doe' (used to spot duplicate people)."""
    return " ".join(name.lower().split())


class AuthService:
    def __init__(self, users: UserRepository):
        self.users = users

    def login(self, email: str, password: str) -> dict:
        user = self.users.find_by_email(email)
        # Same message for "no such email" and "wrong password".
        if not user or not verify_password(password, user["password_hash"]):
            raise Unauthorized("Wrong email or password")
        if user.get("status") != "ACTIVE":
            raise Unauthorized("This account is deactivated. Contact HR.")
        self.users.update(user["_id"], {"last_login_at": now()})
        token = create_token(str(user["_id"]), user["role"], user.get("token_version", 0))
        return {"access_token": token, "token_type": "bearer", "user": clean(user)}

    def change_password(self, user: dict, current: str, new: str) -> dict:
        if not verify_password(current, user["password_hash"]):
            raise BadRequest("Current password is wrong")
        if current == new:
            raise BadRequest("New password must be different")
        # Bumping token_version signs out every other session.
        updated = self.users.bump_token_version(
            user["_id"], {"password_hash": hash_password(new), "must_change_password": False}
        )
        token = create_token(str(updated["_id"]), updated["role"], updated.get("token_version", 0))
        return {"access_token": token, "token_type": "bearer", "user": clean(updated)}

    def bootstrap_hr(self) -> None:
        if self.users.count({"role": "HR"}) > 0:
            return
        self.users.insert(
            {
                "name": "HR Admin",
                "name_key": name_key("HR Admin"),
                "email": config.BOOTSTRAP_HR_EMAIL.lower(),
                "role": "HR",
                "status": "ACTIVE",
                "password_hash": hash_password(config.BOOTSTRAP_HR_PASSWORD),
                "must_change_password": False,
                "token_version": 0,
                "track": None,
                "phone": None,
                "start_date": None,
                "created_at": now(),
                "created_by": None,
            }
        )
