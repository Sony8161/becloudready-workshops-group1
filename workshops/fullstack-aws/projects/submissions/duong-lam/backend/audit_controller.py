from fastapi import APIRouter, Depends, Query, Response
from auth_guard import require_admin
from models import SecurityEvent, Transaction, TxnType
from dependencies import audit_service as service, auth_service

# dependencies on the ROUTER = every route below is admin-only
router = APIRouter(prefix="/api/audit", tags=["Audit"], dependencies=[Depends(require_admin)])


@router.get("/transactions", response_model=list[Transaction])
def list_transactions(response: Response,
                      limit: int = Query(100, ge=1, le=500),       # one page at a time, never everything
                      skip: int = Query(0, ge=0),
                      type: TxnType | None = None,
                      customer_id: int | None = Query(None, alias="customerId")):
    items, total = service.page(limit, skip, type, customer_id)
    response.headers["X-Total-Count"] = str(total)   # how many match in all, so the page can say "50 of 230"
    return items


@router.get("/transactions/{txn_id}", response_model=Transaction)
def get_transaction(txn_id: int):
    return service.get_transaction(txn_id)   # example, done for you


@router.get("/security-events", response_model=list[SecurityEvent])
def list_security_events(response: Response, limit: int = Query(100, ge=1, le=500), skip: int = Query(0, ge=0),
                         problems: bool = False):
    """The sign-in log: logins, wrong passwords, lockouts, sign-ups, resets, staff actions.
    ?problems=true keeps only wrong passwords and lockouts."""
    items, total = auth_service.list_events(limit, skip, problems)
    response.headers["X-Total-Count"] = str(total)
    return items
