from fastapi import APIRouter, Depends
from auth_guard import ensure_owner, get_current_user, require_admin
from models import Account, Customer, CustomerIn, Transaction, User
from dependencies import customer_service as service, account_service

router = APIRouter(prefix="/api/customers", tags=["Customers"])

# wiring moved to dependencies.py so every controller shares the same objects

# Security: dependencies=admin_only runs require_admin before the route (staff screens).
# Routes a customer may use take `user` and call ensure_owner(...) instead.
admin_only = [Depends(require_admin)]


@router.get("/search", response_model=list[Customer], dependencies=admin_only)
def search_customers(name: str):
    return service.search_customers(name)

@router.get("/premium", response_model=list[Customer], dependencies=admin_only)
def premium_customers(threshold: float):
    return service.premium_customers(threshold)

@router.get("/{customer_id}", response_model=Customer)
def get_customer(customer_id: int, user: User = Depends(get_current_user)):
    ensure_owner(user, customer_id)   # a customer can only read their own record
    return service.get_customer(customer_id)

@router.post("", response_model=Customer, dependencies=admin_only)
def create_customer(data: CustomerIn):
    return service.create_customer(data)


@router.put("/{customer_id}", response_model=Customer, dependencies=admin_only)
def update_customer(customer_id: int, data: CustomerIn):
    return service.update_customer(customer_id, data)



@router.delete("/{customer_id}", status_code=204, dependencies=admin_only)
def delete_customer(customer_id: int):
    service.delete_customer(customer_id)
    return None  # FastAPI will return a 204 No Content response


@router.get("", response_model=list[Customer], dependencies=admin_only)
def list_customers():
    return service.list_customers()


@router.get("/{customer_id}/accounts", response_model=list[Account])
def list_accounts_for_customer(customer_id: int, user: User = Depends(get_current_user)):
    ensure_owner(user, customer_id)
    return account_service.list_accounts_for_customer(customer_id)


@router.get("/{customer_id}/transactions", response_model=list[Transaction])
def list_transactions_for_customer(customer_id: int, user: User = Depends(get_current_user)):
    ensure_owner(user, customer_id)
    return account_service.list_transactions_for_customer(customer_id)
