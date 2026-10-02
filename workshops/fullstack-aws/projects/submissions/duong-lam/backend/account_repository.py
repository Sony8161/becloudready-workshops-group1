from decimal import Decimal

from pymongo import ReturnDocument
from pymongo.database import Database

from db import from_doc, next_id
from models import Account, AccountIn, AccountUpdate


class AccountRepository:
    """Storage only. Reads/writes the "accounts" collection.
    A document looks like: {"_id": 1, "customer_id": 1, "account_type": "SAVINGS", "balance": 0.00}
    Same patterns as CustomerRepository. Cheat sheet at the bottom of this file."""

    def __init__(self, db: Database):
        self._db = db
        self._col = db.accounts

    def find_all(self) -> list[Account]:
        docs = self._col.find()
        return [_doc_to_account(doc) for doc in docs]

    def find_by_id(self, account_id: int) -> Account | None:
        doc = self._col.find_one({"_id": account_id})
        return _doc_to_account(doc) if doc else None

    def find_by_customer_id(self, customer_id: int) -> list[Account]:
        docs = self._col.find({"customer_id": customer_id})
        return [_doc_to_account(doc) for doc in docs]

    def find_premium(self, threshold: Decimal) -> list[Account]:
        docs = self._col.find({"balance": {"$gte": threshold}})
        return [_doc_to_account(doc) for doc in docs]

    def create(self, data: AccountIn) -> Account:
        doc = {
            "_id": next_id(self._db, "accounts"),
            "customer_id": data.customer_id,
            "account_type": data.account_type,
            "balance": Decimal("0.00")
        }
        self._col.insert_one(doc)
        return _doc_to_account(doc)
        

    def update(self, account_id: int, data: AccountUpdate) -> Account:
        doc = self._col.find_one_and_update(
            {"_id": account_id},
            {"$set": data.model_dump()},
            return_document=ReturnDocument.AFTER
        )
        return _doc_to_account(doc) if doc else None

    def update_balance(self, account_id: int, new_balance: Decimal) -> Account:
        doc = self._col.find_one_and_update(
            {"_id": account_id},
            {"$set": {"balance": new_balance}},
            return_document=ReturnDocument.AFTER
        )
        return _doc_to_account(doc) if doc else None

    def update_settings(self, account_id: int, nickname: str | None, goal: Decimal | None) -> Account:
        """Only the owner's labels change; the balance is never in this $set."""
        doc = self._col.find_one_and_update(
            {"_id": account_id},
            {"$set": {"nickname": nickname, "goal": goal}},
            return_document=ReturnDocument.AFTER
        )
        return _doc_to_account(doc) if doc else None

    def stats(self, premium_threshold: Decimal) -> dict:
        """Totals for the admin dashboard, added up INSIDE MongoDB with an aggregation pipeline.
        SQL: SELECT COUNT(*), SUM(balance) ... GROUP BY nothing"""
        rows = list(self._col.aggregate([{"$group": {"_id": None, "accounts": {"$sum": 1},
                                                     "total": {"$sum": "$balance"}}}]))
        totals = rows[0] if rows else {"accounts": 0, "total": Decimal("0")}
        return {
            "accounts": totals["accounts"],
            "total_balance": totals["total"],
            "savings_accounts": self._col.count_documents({"account_type": "SAVINGS"}),
            "premium_accounts": self._col.count_documents({"balance": {"$gte": premium_threshold}}),
        }

    def find_by_customer_ids(self, customer_ids: list[int]) -> list[Account]:
        return [_doc_to_account(d) for d in self._col.find({"customer_id": {"$in": customer_ids}})]

    def customer_ids_with_balance_at_least(self, threshold: Decimal) -> list[int]:
        return sorted({a.customer_id for a in self.find_premium(threshold)})

    def ensure_indexes(self) -> None:
        # without an index, "all accounts of customer 1" reads EVERY account; with one it jumps straight there
        self._col.create_index("customer_id")

    def delete(self, account_id: int) -> None:
        self._col.delete_one({"_id": account_id})

    def delete_by_customer_id(self, customer_id: int) -> None:
        self._col.delete_many({"customer_id": customer_id})


def _doc_to_account(doc) -> Account:
    return from_doc(Account, doc) if doc else None
# ---------- Mongo cheat sheet (SQL in comments) ----------


def find():
    # find()                                         SELECT *
    pass    
def find_by_customer_id():
    # find({"customer_id": 1})                       WHERE customer_id = 1
    pass

def find_accounts_with_balance_above():
    # find({"balance": {"$gte": 1000}})              WHERE balance >= 1000
    pass

def find_by_id():
    # find_one({"_id": 5})                           one document, or None
    pass

def find_one_and_update():
    # find_one_and_update(filter, {"$set": {...}}, return_document=ReturnDocument.AFTER)
    pass    


def delete_one():
    # delete_one(filter)
    pass

def delete_many():
    # delete_many(filter)
    pass


