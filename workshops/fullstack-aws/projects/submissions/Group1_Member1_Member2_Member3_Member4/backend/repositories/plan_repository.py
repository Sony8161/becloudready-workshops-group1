"""plans collection: {title, description, tasks[{id,title,due_date}], assignee_type, assignee_id, status}."""
from bson import ObjectId
from pymongo import ReturnDocument


class PlanRepository:
    def __init__(self, db):
        self.col = db.plans

    def insert(self, doc: dict) -> dict:
        doc["_id"] = self.col.insert_one(doc).inserted_id
        return doc

    def find_by_id(self, plan_id: ObjectId) -> dict | None:
        return self.col.find_one({"_id": plan_id})

    def find(self, query: dict | None = None) -> list[dict]:
        return list(self.col.find(query or {}).sort("created_at", -1))

    def find_for_assignees(self, trainee_id: str, cohort_ids: list[str], status="ACTIVE") -> list[dict]:
        return self.find(
            {
                "status": status,
                "$or": [
                    {"assignee_type": "TRAINEE", "assignee_id": trainee_id},
                    {"assignee_type": "COHORT", "assignee_id": {"$in": cohort_ids}},
                ],
            }
        )

    def count(self, query: dict) -> int:
        return self.col.count_documents(query)

    def update(self, plan_id: ObjectId, fields: dict) -> dict | None:
        return self.col.find_one_and_update(
            {"_id": plan_id}, {"$set": fields}, return_document=ReturnDocument.AFTER
        )
