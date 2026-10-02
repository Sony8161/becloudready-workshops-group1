"""reports collection (progress reports): {trainee_id, plan_id, task_id, status, summary, blockers, hours, feedback}."""
from bson import ObjectId
from pymongo import ReturnDocument


class ReportRepository:
    def __init__(self, db):
        self.col = db.reports

    def insert(self, doc: dict) -> dict:
        doc["_id"] = self.col.insert_one(doc).inserted_id
        return doc

    def find_by_id(self, report_id: ObjectId) -> dict | None:
        return self.col.find_one({"_id": report_id})

    def find(self, query: dict | None = None, limit: int = 0) -> list[dict]:
        cur = self.col.find(query or {}).sort("created_at", -1)
        if limit:
            cur = cur.limit(limit)
        return list(cur)

    def count(self, query: dict) -> int:
        return self.col.count_documents(query)

    def for_progress(self, query: dict | None = None) -> list[dict]:
        """Only the fields the progress maths needs, newest first."""
        fields = {"trainee_id": 1, "plan_id": 1, "task_id": 1, "status": 1, "created_at": 1, "feedback": 1}
        return list(self.col.find(query or {}, fields).sort("created_at", -1))

    def set_fields(self, report_id: ObjectId, fields: dict) -> dict | None:
        return self.col.find_one_and_update(
            {"_id": report_id}, {"$set": fields}, return_document=ReturnDocument.AFTER
        )
