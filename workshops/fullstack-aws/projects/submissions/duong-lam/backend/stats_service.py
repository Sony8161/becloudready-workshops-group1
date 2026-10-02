from datetime import datetime, timezone
from decimal import Decimal

from account_repository import AccountRepository
from audit_service import AuditService
from customer_repository import CustomerRepository
from models import AdminStats

PREMIUM_THRESHOLD = Decimal("1000")   # same rule as the premium search: balance >= $1,000


class StatsService:
    """Numbers for the admin dashboard. MongoDB counts and adds them up, so the browser
    gets 8 numbers instead of downloading every customer, account and transaction."""

    def __init__(self, customer_repo: CustomerRepository, account_repo: AccountRepository,
                 audit_service: AuditService):
        self._customers = customer_repo
        self._accounts = account_repo
        self._audit = audit_service

    def admin_stats(self) -> AdminStats:
        accounts = self._accounts.stats(PREMIUM_THRESHOLD)
        midnight = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        transactions = self._audit.page(limit=1, skip=0)[1]
        return AdminStats(
            customers=self._customers.count(),
            accounts=accounts["accounts"],
            savings_accounts=accounts["savings_accounts"],
            total_balance=accounts["total_balance"],
            premium_accounts=accounts["premium_accounts"],
            premium_threshold=PREMIUM_THRESHOLD,
            transactions=transactions,
            transactions_today=self._audit.count_since(midnight),
        )
