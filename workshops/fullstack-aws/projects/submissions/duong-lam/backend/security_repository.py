from pymongo.database import Database

from db import from_doc, next_id
from models import SecurityEvent, SecurityEventIn


class SecurityRepository:
    """The "security_events" collection: every sign-in, failed password and lockout.
    Like the transactions audit trail, records are only ever ADDED."""

    def __init__(self, db: Database):
        self._db = db
        self._col = db.security_events

    def create(self, data: SecurityEventIn) -> SecurityEvent:
        doc = {"_id": next_id(self._db, "security_events"), **data.model_dump()}
        self._col.insert_one(doc)
        return from_doc(SecurityEvent, doc)

    def find_page(self, limit: int, skip: int, query: dict | None = None) -> list[SecurityEvent]:
        docs = self._col.find(query or {}).sort("_id", -1).skip(skip).limit(limit)   # newest first, one page
        return [from_doc(SecurityEvent, d) for d in docs]

    def count(self, query: dict | None = None) -> int:
        return self._col.count_documents(query or {})

    def find_for_username(self, username: str, limit: int) -> list[SecurityEvent]:
        docs = self._col.find({"username": username}).sort("_id", -1).limit(limit)
        return [from_doc(SecurityEvent, d) for d in docs]

    def ensure_indexes(self) -> None:
        self._col.create_index("username")
