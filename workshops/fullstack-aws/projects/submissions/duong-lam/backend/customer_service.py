from decimal import Decimal

from fastapi import HTTPException
from models import Customer, CustomerIn
from customer_repository import CustomerRepository
from account_repository import AccountRepository
from user_repository import UserRepository


class CustomerService:
    """Business logic. Talks to the repository, never to routes."""

    def __init__(self, repo: CustomerRepository, account_repo: AccountRepository,
                 user_repo: UserRepository):
        self._repo = repo
        self._account_repo = account_repo   # needed for the cascade delete
        self._user_repo = user_repo         # ...and their login goes too

    def get_customer(self, customer_id: int) -> Customer:
        customer = self._repo.find_by_id(customer_id)
        if customer is None:
            raise HTTPException(status_code=404, detail="Customer not found")
        return customer

    def create_customer(self, data: CustomerIn) -> Customer:
        return self._repo.create(data)
    
    def update_customer(self, customer_id: int, data: CustomerIn) -> Customer:
        self.get_customer(customer_id)  # Reuse the 404 check
        updated_customer = self._repo.update(customer_id, data)
        return updated_customer


    def list_customers(self) -> list[Customer]:
        return self._repo.find_all()
    

    def delete_customer(self, customer_id: int) -> None:
        self.get_customer(customer_id)  # Reuse the 404 check
        #delete this customer's accounts first
        self._account_repo.delete_by_customer_id(customer_id)
        self._user_repo.delete_by_customer_id(customer_id)
        self._repo.delete(customer_id)


    # ---------- Search / filter ----------
    def search_customers(self, name: str) -> list[Customer]:
        
        return self._repo.find_by_name(name.strip())

    def premium_customers(self, threshold: float) -> list[Customer]:
        
        if threshold < 0:
            raise HTTPException(status_code=400, detail="Threshold must be non-negative")
        accounts = self._account_repo.find_premium(Decimal(str(threshold)))
        ids = {a.customer_id for a in accounts}
        return self._repo.find_by_ids(list(ids))
