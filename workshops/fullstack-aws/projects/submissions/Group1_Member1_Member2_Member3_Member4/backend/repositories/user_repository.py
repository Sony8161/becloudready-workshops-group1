"""users collection. References to users elsewhere are stored as id strings."""
import re

from bson import ObjectId
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError


class DuplicateEmail(Exception):
    pass


class UserRepository:
    def __init__(self, db):
        self.col = db.users

    def insert(self, doc: dict) -> dict:
        try:
            result = self.col.insert_one(doc)
        except DuplicateKeyError:
            raise DuplicateEmail()
        doc["_id"] = result.inserted_id
        return doc

    def find_by_id(self, user_id: ObjectId) -> dict | None:
        return self.col.find_one({"_id": user_id})

    def find_by_email(self, email: str) -> dict | None:
        return self.col.find_one({"email": email.strip().lower()})

    def find_by_emails(self, emails: list[str]) -> list[dict]:
        return list(self.col.find({"email": {"$in": emails}}))

    def find_by_ids(self, ids: list[str]) -> list[dict]:
        oids = [ObjectId(i) for i in ids if ObjectId.is_valid(i)]
        return list(self.col.find({"_id": {"$in": oids}}))

    def find_by_name_key(self, name_key: str, role: str | None = None) -> list[dict]:
        q = {"name_key": name_key}
        if role:
            q["role"] = role
        return list(self.col.find(q))

    def find_by_name_keys(self, keys: list[str]) -> list[dict]:
        return list(self.col.find({"name_key": {"$in": keys}}))

    def search(self, role=None, status=None, q=None) -> list[dict]:
        query: dict = {}
        if role:
            query["role"] = role
        if status:
            query["status"] = status
        if q:
            pattern = re.escape(q.strip())
            query["$or"] = [
                {"name": {"$regex": pattern, "$options": "i"}},
                {"email": {"$regex": pattern, "$options": "i"}},
            ]
        return list(self.col.find(query).sort("name", 1))

    def count(self, query: dict) -> int:
        return self.col.count_documents(query)

    def update(self, user_id: ObjectId, fields: dict) -> dict | None:
        try:
            return self.col.find_one_and_update(
                {"_id": user_id}, {"$set": fields}, return_document=ReturnDocument.AFTER
            )
        except DuplicateKeyError:
            raise DuplicateEmail()

    def bump_token_version(self, user_id: ObjectId, fields: dict) -> dict | None:
        return self.col.find_one_and_update(
            {"_id": user_id},
            {"$set": fields, "$inc": {"token_version": 1}},
            return_document=ReturnDocument.AFTER,
        )

    def all_name_keys(self, role: str) -> list[dict]:
        return list(self.col.find({"role": role}, {"name": 1, "email": 1, "name_key": 1, "status": 1}))
