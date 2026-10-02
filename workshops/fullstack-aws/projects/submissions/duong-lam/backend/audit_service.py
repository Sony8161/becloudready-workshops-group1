from datetime import datetime, timezone
from decimal import Decimal

from fastapi import HTTPException
from audit_repository import AuditRepository
from models import Transaction, TransactionIn, TxnType


class AuditService:
    """Records every money movement and answers "what happened?" questions.
    AccountService calls record() after each deposit / withdraw / transfer."""

    def __init__(self, repo: AuditRepository):
        self._repo = repo

    def record(self, txn_type: TxnType, amount: Decimal, customer_id: int,
               from_account_id: int | None = None, to_account_id: int | None = None,
               performed_by: str | None = None) -> Transaction:
        
        
        txn_in = TransactionIn(
            type=txn_type,
            amount=amount,
            customer_id=customer_id,
            from_account_id=from_account_id,
            to_account_id=to_account_id,
            timestamp=datetime.now(timezone.utc),
            performed_by=performed_by,   # which login did it (customer online, or a teller)
        )
        return self._repo.create(txn_in)

        #  raise NotImplementedError

    def list_transactions(self) -> list[Transaction]:
        return self._repo.find_all()

    def page(self, limit: int, skip: int, txn_type: TxnType | None = None,
             customer_id: int | None = None) -> tuple[list[Transaction], int]:
        """One page of the audit log, filtered in the DATABASE (not in the browser), plus the total."""
        query = {}
        if txn_type is not None:
            query["type"] = txn_type.value
        if customer_id is not None:
            query["customer_id"] = customer_id
        return self._repo.find_page(query, limit, skip), self._repo.count(query)

    def count_since(self, since: datetime) -> int:
        return self._repo.count({"timestamp": {"$gte": since}})

    def get_transaction(self, txn_id: int) -> Transaction:
        txn = self._repo.find_by_id(txn_id)
        if not txn:
            raise HTTPException(status_code=404, detail="Transaction not found")
        return txn

    def list_for_account(self, account_id: int) -> list[Transaction]:
        return self._repo.find_by_account_id(account_id)

    def list_for_accounts(self, account_ids: list[int]) -> list[Transaction]:
        return self._repo.find_by_account_ids(account_ids) if account_ids else []
