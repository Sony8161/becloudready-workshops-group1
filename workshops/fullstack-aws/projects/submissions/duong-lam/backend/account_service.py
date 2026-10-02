from decimal import Decimal
from fastapi import HTTPException

MAX_AMOUNT = Decimal("1000000")   # one deposit, withdrawal or transfer can't be more than this


def masked_name(full_name: str) -> str:
    """'Jane Smith' -> 'Jane S.'   'Cher' -> 'Cher'"""
    parts = full_name.split()
    if len(parts) < 2:
        return full_name.strip()
    return f"{parts[0]} {parts[-1][0].upper()}."


def check_amount(amount: Decimal) -> None:
    """The money rules every deposit, withdrawal and transfer share."""
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")
    if amount.as_tuple().exponent < -2:   # 10.555 has 3 decimal places
        raise HTTPException(status_code=400, detail="Amounts can have at most 2 decimal places")
    if amount > MAX_AMOUNT:
        raise HTTPException(status_code=400, detail="Amount is over the $1,000,000 limit")
from models import Account, AccountIn, AccountSettingsIn, AccountUpdate, PayeeOut, Transaction, TransferIn, TxnType
from account_repository import AccountRepository
from customer_service import CustomerService
from audit_service import AuditService


class AccountService:
    """Business rules for accounts. Reuses CustomerService for the "customer exists" check."""

    def __init__(self, repo: AccountRepository, customer_service: CustomerService,
                 audit_service: AuditService):
        self._repo = repo
        self._customer_service = customer_service
        self._audit = audit_service   # records every money movement (Priority 3)

    def get_account(self, account_id: int) -> Account:
        account = self._repo.find_by_id(account_id)
        if not account:
            raise HTTPException(status_code=404, detail="Account not found")
        return account

    def list_accounts(self) -> list[Account]:
        return self._repo.find_all()

    def list_accounts_for_customer(self, customer_id: int) -> list[Account]:
        self._customer_service.get_customer(customer_id)  # will raise 404 if customer not found
        return self._repo.find_by_customer_id(customer_id)

    def create_account(self, data: AccountIn) -> Account:
        self._customer_service.get_customer(data.customer_id)  # will raise 404 if customer not found
        return self._repo.create(data)

    def update_account(self, account_id: int, data: AccountUpdate) -> Account:
        self.get_account(account_id)
        return self._repo.update(account_id, data)

    def update_settings(self, account_id: int, data: AccountSettingsIn) -> Account:
        self.get_account(account_id)   # 404 if it doesn't exist
        return self._repo.update_settings(account_id, data.nickname, data.goal)

    def payee(self, account_id: int) -> PayeeOut:
        """Who owns this account number, as "Jane S.": enough to spot a typo, not a full identity."""
        account = self.get_account(account_id)
        customer = self._customer_service.get_customer(account.customer_id)
        return PayeeOut(account_id=account.id, name=masked_name(customer.name))

    def delete_account(self, account_id: int) -> None:
        self.get_account(account_id)
        return self._repo.delete(account_id)

    # ---------- Step 4: money ----------
    def deposit(self, account_id: int, amount: Decimal, actor: str | None = None) -> Account:
        account = self.get_account(account_id)
        check_amount(amount)
        new_balance = account.balance + amount
        result = self._repo.update_balance(account_id, new_balance)
        self._audit.record(TxnType.DEPOSIT, amount, account.customer_id, to_account_id=account_id,
                           performed_by=actor)
        return result
        

    def withdraw(self, account_id: int, amount: Decimal, actor: str | None = None) -> Account:
        account = self.get_account(account_id)
        check_amount(amount)
        if amount > account.balance:
            raise HTTPException(status_code=400, detail="Insufficient funds")
        new_balance = account.balance - amount
        result = self._repo.update_balance(account_id, new_balance)
        self._audit.record(TxnType.WITHDRAW, amount, account.customer_id, from_account_id=account_id,
                           performed_by=actor)
        return result

    # ---------- Priority 2 ----------
    def get_premium_accounts(self, threshold: float) -> list[Account]:
        if threshold < 0:
            raise HTTPException(status_code=400, detail="Threshold must be non-negative")
        return self._repo.find_premium(Decimal(str(threshold)))

    def transfer(self, data: TransferIn, actor: str | None = None) -> Transaction:
        from_account = self.get_account(data.from_account_id)
        to_account = self.get_account(data.to_account_id)
        if from_account.id == to_account.id:
            raise HTTPException(status_code=400, detail="Cannot transfer to the same account") 
        check_amount(data.amount)
        if data.amount > from_account.balance:
            raise HTTPException(status_code=400, detail="Insufficient funds")   
        new_from_balance = from_account.balance - data.amount
        new_to_balance = to_account.balance + data.amount
        self._repo.update_balance(from_account.id, new_from_balance)
        self._repo.update_balance(to_account.id, new_to_balance)
        return self._audit.record(TxnType.TRANSFER, data.amount, from_account.customer_id, from_account_id=from_account.id, to_account_id=to_account.id,
                                  performed_by=actor)
       

    # ---------- Priority 3 ----------
    def get_transactions(self, account_id: int) -> list[Transaction]:
        self.get_account(account_id)  # will raise 404 if not found
        return self._audit.list_for_account(account_id)

    def list_transactions_for_customer(self, customer_id: int) -> list[Transaction]:
        """Everything that touched any of this customer's accounts, including money sent TO them."""
        accounts = self.list_accounts_for_customer(customer_id)   # 404 if no such customer
        return self._audit.list_for_accounts([a.id for a in accounts])
