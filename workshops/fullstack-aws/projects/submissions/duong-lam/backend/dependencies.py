"""Composition root: the ONE place objects are created and wired together.

Every controller imports from here, so they all share the same objects.
Switching from in-memory to MongoDB only changed this file and the repositories:
services and controllers didn't notice. That's the point of the layers.
"""
from db import db
from account_repository import AccountRepository
from account_service import AccountService
from audit_repository import AuditRepository
from audit_service import AuditService
from auth_service import AuthService
from customer_repository import CustomerRepository
from customer_service import CustomerService
from security_repository import SecurityRepository
from reset_repository import ResetRepository
from note_repository import NoteRepository
from admin_service import AdminService
from stats_service import StatsService
from user_repository import UserRepository

customer_repo = CustomerRepository(db)
account_repo = AccountRepository(db)
audit_repo = AuditRepository(db)
user_repo = UserRepository(db)
security_repo = SecurityRepository(db)
reset_repo = ResetRepository(db)
note_repo = NoteRepository(db)

audit_service = AuditService(audit_repo)
customer_service = CustomerService(customer_repo, account_repo, user_repo)
account_service = AccountService(account_repo, customer_service, audit_service)
auth_service = AuthService(user_repo, customer_repo, security_repo, reset_repo)
stats_service = StatsService(customer_repo, account_repo, audit_service)
admin_service = AdminService(customer_repo, account_repo, user_repo, auth_service, note_repo)
