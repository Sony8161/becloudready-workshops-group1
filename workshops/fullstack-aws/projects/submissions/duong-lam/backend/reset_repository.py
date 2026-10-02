from datetime import datetime

from pymongo.database import Database

from db import next_id


class ResetRepository:
    """The "password_resets" collection: one row per "forgot password" request.
    Only a SHA-256 HASH of the emailed token is stored, so a database leak can't be used to reset passwords.
    A row: {"_id": 1, "user_id": 2, "token_hash": "9f86d0...", "expires_at": ..., "used": false}"""

    def __init__(self, db: Database):
        self._db = db
        self._col = db.password_resets

    def create(self, user_id: int, token_hash: str, expires_at: datetime) -> None:
        self._col.insert_one({"_id": next_id(self._db, "password_resets"), "user_id": user_id,
                              "token_hash": token_hash, "expires_at": expires_at, "used": False})

    def find_valid(self, token_hash: str, now: datetime) -> dict | None:
        # right hash, not used yet, not expired
        return self._col.find_one({"token_hash": token_hash, "used": False, "expires_at": {"$gt": now}})

    def mark_used(self, reset_id: int) -> None:
        self._col.update_one({"_id": reset_id}, {"$set": {"used": True}})

    def cancel_open_for_user(self, user_id: int) -> None:
        # a new request (or a successful reset) kills every older link for that login
        self._col.update_many({"user_id": user_id, "used": False}, {"$set": {"used": True}})

    def ensure_indexes(self) -> None:
        self._col.create_index("token_hash")
