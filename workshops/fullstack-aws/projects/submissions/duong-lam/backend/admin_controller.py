from fastapi import APIRouter, Depends, Query, Response

from auth_guard import require_admin
from dependencies import admin_service, stats_service as service
from models import AdminCustomer, AdminStats, Note, NoteIn, User

router = APIRouter(prefix="/api/admin", tags=["Admin"], dependencies=[Depends(require_admin)])


@router.get("/stats", response_model=AdminStats)
def admin_stats():
    return service.admin_stats()


@router.get("/customers", response_model=list[AdminCustomer])
def admin_customers(response: Response, query: str = "", premium: bool = False,
                    limit: int = Query(25, ge=1, le=200), skip: int = Query(0, ge=0)):
    """One page of customers with their account count, total balance and login status."""
    rows, total = admin_service.customer_page(query, premium, limit, skip)
    response.headers["X-Total-Count"] = str(total)
    return rows


@router.get("/customers/{customer_id}/notes", response_model=list[Note])
def customer_notes(customer_id: int):
    """Staff notes about one customer, newest first."""
    return admin_service.notes(customer_id)


@router.post("/customers/{customer_id}/notes", response_model=Note, status_code=201)
def add_customer_note(customer_id: int, data: NoteIn, admin: User = Depends(require_admin)):
    return admin_service.add_note(customer_id, data.text, author=admin.username)
