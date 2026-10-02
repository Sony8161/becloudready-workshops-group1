"""notifications collection: one row per user per event {user_id, type, title, message, link, read}."""
from bson import ObjectId


class NotificationRepository:
    def __init__(self, db):
        self.col = db.notifications

    def insert_many(self, docs: list[dict]) -> int:
        if not docs:
            return 0
        return len(self.col.insert_many(docs).inserted_ids)

    def find_for_user(self, user_id: str, unread_only=False, limit=50) -> list[dict]:
        q = {"user_id": user_id}
        if unread_only:
            q["read"] = False
        return list(self.col.find(q).sort("created_at", -1).limit(limit))

    def count_unread(self, user_id: str) -> int:
        return self.col.count_documents({"user_id": user_id, "read": False})

    def mark_read(self, notification_id: ObjectId, user_id: str) -> bool:
        res = self.col.update_one({"_id": notification_id, "user_id": user_id}, {"$set": {"read": True}})
        return res.matched_count == 1

    def mark_all_read(self, user_id: str) -> int:
        return self.col.update_many({"user_id": user_id, "read": False}, {"$set": {"read": True}}).modified_count
