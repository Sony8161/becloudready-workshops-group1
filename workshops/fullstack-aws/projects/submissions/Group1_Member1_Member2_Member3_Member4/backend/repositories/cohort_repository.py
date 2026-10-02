"""cohorts collection: {name, name_key, description, manager_id, trainee_ids[], dates}."""
from bson import ObjectId
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError


class DuplicateCohort(Exception):
    pass


class CohortRepository:
    def __init__(self, db):
        self.col = db.cohorts

    def insert(self, doc: dict) -> dict:
        try:
            result = self.col.insert_one(doc)
        except DuplicateKeyError:
            raise DuplicateCohort()
        doc["_id"] = result.inserted_id
        return doc

    def find_all(self) -> list[dict]:
        return list(self.col.find().sort("name", 1))

    def find_by_id(self, cohort_id: ObjectId) -> dict | None:
        return self.col.find_one({"_id": cohort_id})

    def find_by_name_key(self, key: str) -> dict | None:
        return self.col.find_one({"name_key": key})

    def find_for_trainee(self, trainee_id: str) -> list[dict]:
        return list(self.col.find({"trainee_ids": trainee_id}).sort("name", 1))

    def update(self, cohort_id: ObjectId, fields: dict) -> dict | None:
        try:
            return self.col.find_one_and_update(
                {"_id": cohort_id}, {"$set": fields}, return_document=ReturnDocument.AFTER
            )
        except DuplicateKeyError:
            raise DuplicateCohort()

    def add_members(self, cohort_id: ObjectId, trainee_ids: list[str]) -> dict | None:
        return self.col.find_one_and_update(
            {"_id": cohort_id},
            {"$addToSet": {"trainee_ids": {"$each": trainee_ids}}},
            return_document=ReturnDocument.AFTER,
        )

    def remove_member(self, cohort_id: ObjectId, trainee_id: str) -> dict | None:
        return self.col.find_one_and_update(
            {"_id": cohort_id},
            {"$pull": {"trainee_ids": trainee_id}},
            return_document=ReturnDocument.AFTER,
        )

    def delete(self, cohort_id: ObjectId) -> bool:
        return self.col.delete_one({"_id": cohort_id}).deleted_count == 1
