"""Demo data for a presentation. Run from backend/:   python seed_demo.py
Safe to run twice: it skips any login that already exists.

Logins it creates (password in brackets):
  john  (john123)   John Doe   - Savings $5,000, Checking $1,250
  jane  (jane123)   Jane Smith - Checking $800
  (no login)        Ann Lee    - Savings $1,200   <- staff can turn on her online banking
  demoadmin (admin123)   staff login with an easy password, for demos (also works on the AWS site)
The main admin login (admin / admin123 unless .env says otherwise) is made when the server starts.
On AWS, "admin" gets the generated ADMIN_PASSWORD instead, which is why demoadmin exists.
"""
import os
from decimal import Decimal

from fastapi import HTTPException

from dependencies import account_service, auth_service, customer_repo, customer_service, user_repo
from models import AccountIn, AccountType, CreateLoginIn, CustomerIn, TransferIn

DEMO = [
    ("John Doe", "john@example.com", "john", "john123", [(AccountType.SAVINGS, 5000), (AccountType.CHECKING, 1250)]),
    ("Jane Smith", "jane@example.com", "jane", "jane123", [(AccountType.CHECKING, 800)]),
    ("Ann Lee", "ann@example.com", None, None, [(AccountType.SAVINGS, 1200)]),
]

auth_service.ensure_admin(os.getenv("ADMIN_USERNAME", "admin"), os.getenv("ADMIN_PASSWORD", "admin123"))

# A second staff login with an easy password, for demos. Anyone who knows it gets staff powers on the live site,
# so delete it from the users collection (or change the password here) once the demos are over.
DEMO_ADMIN_USERNAME, DEMO_ADMIN_PASSWORD = "demoadmin", "admin123"
auth_service.ensure_admin(DEMO_ADMIN_USERNAME, DEMO_ADMIN_PASSWORD)   # skipped if it already exists
print(f"staff login: {DEMO_ADMIN_USERNAME} / {DEMO_ADMIN_PASSWORD}")
first_accounts = []
for name, email, username, password, accounts in DEMO:
    if customer_repo.find_by_email(email):
        print(f"skip {name}: already there")
        continue
    customer = customer_service.create_customer(CustomerIn(name=name, email=email))
    if username:
        try:
            auth_service.create_login(CreateLoginIn(customer_id=customer.id, username=username, password=password), by="seed")
        except HTTPException as e:
            print(f"login {username}: {e.detail}")
    created = []
    for account_type, amount in accounts:
        account = account_service.create_account(AccountIn(customer_id=customer.id, account_type=account_type))
        account_service.deposit(account.id, Decimal(amount), actor="admin")
        created.append(account)
    first_accounts.append(created[0])
    print(f"{name}: customer {customer.id}, accounts {[a.id for a in created]}")

if len(first_accounts) == 3:   # a transfer and a withdrawal so the activity lists aren't empty
    john_savings, jane_checking = first_accounts[0], first_accounts[1]
    account_service.transfer(TransferIn(from_account_id=john_savings.id, to_account_id=jane_checking.id, amount=Decimal(150)), actor="john")
    account_service.withdraw(jane_checking.id, Decimal(60), actor="jane")
    print("added a transfer and a withdrawal")
