import re

from pymongo import ReturnDocument
from pymongo.database import Database

from db import from_doc, next_id
from models import Customer, CustomerIn


class CustomerRepository:
    """Storage only. Reads/writes the "customers" collection in MongoDB.
    A document looks like: {"_id": 1, "name": "John", "email": "j@x.com"}"""

    def __init__(self, db: Database):
        self._db = db
        self._col = db.customers          # a collection is like a SQL table

    def find_by_id(self, customer_id: int) -> Customer | None:
        return from_doc(Customer, self._col.find_one({"_id": customer_id}))

    def create(self, data: CustomerIn) -> Customer:
        doc = {"_id": next_id(self._db, "customers"), **data.model_dump()}
        self._col.insert_one(doc)
        return from_doc(Customer, doc)

    def find_all(self) -> list[Customer]:
        all_docs = self._col.find()
        return [from_doc(Customer, doc) for doc in all_docs]
    
       

    def update(self, customer_id: int, data: CustomerIn) -> Customer:
        updated_doc = self._col.find_one_and_update(
            {"_id": customer_id},
            {"$set": data.model_dump()},
            return_document=ReturnDocument.AFTER
        )
        return from_doc(Customer, updated_doc) if updated_doc else None
    
    

    def delete(self, customer_id: int) -> None:
        self._col.delete_one({"_id": customer_id})

    # ---------- Search / filter (for the React search page) ----------
    def find_by_name(self, name: str) -> list[Customer]:
        # TODO: customers whose name STARTS WITH `name`, ignoring upper/lower case.
        #   filter: {"name": {"$regex": "^" + re.escape(name), "$options": "i"}}
        #   ^ = "starts with" (so "jo" finds "John Doe"), re.escape = treat the text literally,
        #   "i" = ignore case. SQL: WHERE name LIKE 'jo%'
        docs = self._col.find({"name": {"$regex": "^" + re.escape(name), "$options": "i"}})
        return [from_doc(Customer, d) for d in docs]

    def count(self, query: dict | None = None) -> int:
        return self._col.count_documents(query or {})

    def find_page(self, query: dict, limit: int, skip: int) -> list[Customer]:
        docs = self._col.find(query).sort("_id", 1).skip(skip).limit(limit)
        return [from_doc(Customer, d) for d in docs]

    @staticmethod
    def search_query(text: str) -> dict:
        """Name STARTS WITH the text, or email CONTAINS it, ignoring case."""
        if not text.strip():
            return {}
        safe = re.escape(text.strip())
        return {"$or": [{"name": {"$regex": "^" + safe, "$options": "i"}},
                        {"email": {"$regex": safe, "$options": "i"}}]}

    def find_by_email(self, email: str) -> Customer | None:
        # exact match, ignoring case: ^...$ = the whole string
        return from_doc(Customer, self._col.find_one({"email": {"$regex": "^" + re.escape(email) + "$", "$options": "i"}}))

    def find_by_ids(self, ids: list[int]) -> list[Customer]:
        # TODO: every customer whose _id is in the list: {"_id": {"$in": ids}}
        #   SQL: WHERE id IN (1, 3, 7)
        return [from_doc(Customer, d) for d in self._col.find({"_id": {"$in": ids}})]
