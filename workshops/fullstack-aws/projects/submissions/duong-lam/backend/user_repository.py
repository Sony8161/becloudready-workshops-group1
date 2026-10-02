from pymongo.database import Database

from db import from_doc, next_id
from models import Role, UserInDB


class UserRepository:
    """Storage for logins: the "users" collection. (Customers are people; users are logins.)
    A document looks like: {"_id": 1, "username": "admin", "password_hash": "$2b$12$...",
                            "role": "ADMIN", "customer_id": None}
    The password itself is NEVER stored, only its bcrypt hash."""

    def __init__(self, db: Database):
        self._db = db
        self._col = db.users

    def ensure_indexes(self) -> None:
        # unique index = the DATABASE refuses a second "john", even if two sign-ups race
        self._col.create_index("username", unique=True)
        self._col.create_index("customer_id")

    def record_failed_login(self, user_id: int, max_attempts: int, lock_until) -> UserInDB:
        """One more wrong password. On the max_attempts-th one in a row, lock the login."""
        user = self.find_by_id(user_id)
        failed = user.failed_logins + 1
        if failed >= max_attempts:
            update = {"failed_logins": 0, "locked_until": lock_until}
        else:
            update = {"failed_logins": failed}
        self._col.update_one({"_id": user_id}, {"$set": update})
        return self.find_by_id(user_id)

    def reset_failed_logins(self, user_id: int) -> None:
        self._col.update_one({"_id": user_id}, {"$set": {"failed_logins": 0, "locked_until": None}})

    def set_password(self, user_id: int, password_hash: str) -> UserInDB:
        """New password: clears any lockout AND bumps token_version, so old sessions stop working."""
        self._col.update_one({"_id": user_id}, {"$set": {"password_hash": password_hash, "failed_logins": 0,
                                                          "locked_until": None},
                                                 "$inc": {"token_version": 1}})
        return self.find_by_id(user_id)

    def bump_token_version(self, user_id: int) -> UserInDB:
        # every JWT carries the version it was made with; a higher number here retires them all
        self._col.update_one({"_id": user_id}, {"$inc": {"token_version": 1}})
        return self.find_by_id(user_id)

    def find_by_customer_ids(self, customer_ids: list[int]) -> list[UserInDB]:
        return [from_doc(UserInDB, d) for d in self._col.find({"customer_id": {"$in": customer_ids}})]

    def find_by_id(self, user_id: int) -> UserInDB | None:
        return from_doc(UserInDB, self._col.find_one({"_id": user_id}))

    def find_by_username(self, username: str) -> UserInDB | None:
        return from_doc(UserInDB, self._col.find_one({"username": username.lower()}))

    def find_by_customer_id(self, customer_id: int) -> UserInDB | None:
        return from_doc(UserInDB, self._col.find_one({"customer_id": customer_id}))

    def find_all(self) -> list[UserInDB]:
        return [from_doc(UserInDB, d) for d in self._col.find().sort("_id", 1)]

    def create(self, username: str, password_hash: str, role: Role,
               customer_id: int | None = None) -> UserInDB:
        doc = {
            "_id": next_id(self._db, "users"),
            "username": username.lower(),     # usernames are case-insensitive: "John" = "john"
            "password_hash": password_hash,
            "role": role.value,
            "customer_id": customer_id,
        }
        self._col.insert_one(doc)
        return from_doc(UserInDB, doc)

    def delete_by_customer_id(self, customer_id: int) -> None:
        self._col.delete_many({"customer_id": customer_id})
