"""notices collection: {title, body, priority, audience_type, audience_id, pinned, read_by[]}."""
from bson import ObjectId
from pymongo import ReturnDocument


class NoticeRepository:
    def __init__(self, db):
        self.col = db.notices

    def insert(self, doc: dict) -> dict:
        doc["_id"] = self.col.insert_one(doc).inserted_id
        return doc

    def find_by_id(self, notice_id: ObjectId) -> dict | None:
        return self.col.find_one({"_id": notice_id})

    def find(self, query: dict | None = None) -> list[dict]:
        return list(self.col.find(query or {}).sort([("pinned", -1), ("created_at", -1)]))

    def update(self, notice_id: ObjectId, fields: dict) -> dict | None:
        return self.col.find_one_and_update(
            {"_id": notice_id}, {"$set": fields}, return_document=ReturnDocument.AFTER
        )

    def mark_read(self, notice_id: ObjectId, user_id: str) -> dict | None:
        return self.col.find_one_and_update(
            {"_id": notice_id},
            {"$addToSet": {"read_by": user_id}},
            return_document=ReturnDocument.AFTER,
        )

    def delete(self, notice_id: ObjectId) -> bool:
        return self.col.delete_one({"_id": notice_id}).deleted_count == 1
