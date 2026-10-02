from datetime import datetime, timezone

from pymongo.database import Database

from db import from_doc, next_id
from models import Note


class NoteRepository:
    """Storage for staff notes. A document looks like:
    {"_id": 1, "customer_id": 3, "text": "Called about the lockout", "author": "admin", "timestamp": ...}"""

    def __init__(self, db: Database):
        self._db = db
        self._col = db.customer_notes

    def create(self, customer_id: int, text: str, author: str) -> Note:
        doc = {"_id": next_id(self._db, "customer_notes"), "customer_id": customer_id, "text": text,
               "author": author, "timestamp": datetime.now(timezone.utc)}
        self._col.insert_one(doc)
        return from_doc(Note, doc)

    def find_for_customer(self, customer_id: int, limit: int = 50) -> list[Note]:
        docs = self._col.find({"customer_id": customer_id}).sort("_id", -1).limit(limit)   # newest first
        return [from_doc(Note, d) for d in docs]

    def ensure_indexes(self) -> None:
        self._col.create_index([("customer_id", 1), ("_id", -1)])
