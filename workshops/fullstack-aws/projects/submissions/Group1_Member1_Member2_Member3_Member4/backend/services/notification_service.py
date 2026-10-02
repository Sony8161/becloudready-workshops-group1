"""Automated notifications. Other services call notify(); users read them from the bell."""
from __future__ import annotations

from repositories.notification_repository import NotificationRepository
from serializers import clean, now, oid


class NotificationService:
    def __init__(self, repo: NotificationRepository):
        self.repo = repo

    def notify(self, user_ids, type_: str, title: str, message: str = "", link: str = "") -> int:
        created = now()
        docs = [
            {
                "user_id": uid,
                "type": type_,
                "title": title,
                "message": message,
                "link": link,
                "read": False,
                "created_at": created,
            }
            for uid in dict.fromkeys(u for u in user_ids if u)  # unique, keeps order
        ]
        return self.repo.insert_many(docs)

    def list_mine(self, user_id: str, unread_only=False) -> dict:
        items = [clean(n) for n in self.repo.find_for_user(user_id, unread_only)]
        return {"items": items, "unread": self.repo.count_unread(user_id)}

    def mark_read(self, notification_id: str, user_id: str) -> bool:
        return self.repo.mark_read(oid(notification_id, "Notification"), user_id)

    def mark_all_read(self, user_id: str) -> int:
        return self.repo.mark_all_read(user_id)
