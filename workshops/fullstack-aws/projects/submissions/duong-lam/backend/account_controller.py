from fastapi import APIRouter, Depends
from auth_guard import ensure_owner, get_current_user, require_admin
from models import Account, AccountIn, AccountSettingsIn, AccountUpdate, AmountIn, PayeeOut, Transaction, TransferIn, User
from rate_limit import limit
from dependencies import account_service as service

router = APIRouter(prefix="/api/accounts", tags=["Accounts"])
transfer_router = APIRouter(prefix="/api/transfers", tags=["Transfers"])   # second router, same file

admin_only = [Depends(require_admin)]


def own_account(account_id: int, user: User) -> Account:
    """Load the account (404 if missing), then check it belongs to this user (403 if not)."""
    account = service.get_account(account_id)
    ensure_owner(user, account.customer_id)
    return account


@router.post("", response_model=Account, status_code=201)   # 201 = Created
def create_account(data: AccountIn, user: User = Depends(get_current_user)):
    ensure_owner(user, data.customer_id)   # customers may open accounts for themselves only
    return service.create_account(data)   # example, done for you




@router.get("", response_model=list[Account], dependencies=admin_only)
def list_accounts():
    return service.list_accounts()

@router.get("/premium", response_model=list[Account], dependencies=admin_only)
def get_premium_accounts(threshold: float):
    return service.get_premium_accounts(threshold)  


@router.get("/{account_id}", response_model=Account)
def get_account(account_id: int, user: User = Depends(get_current_user)):
    return own_account(account_id, user)

@router.put("/{account_id}", response_model=Account, dependencies=admin_only)
def update_account(account_id: int, data: AccountUpdate):
    return service.update_account(account_id, data)

@router.delete("/{account_id}", status_code=204, dependencies=admin_only)
def delete_account(account_id: int):
    return service.delete_account(account_id)


@router.post("/{account_id}/deposit", response_model=Account)
def deposit(account_id: int, data: AmountIn, user: User = Depends(get_current_user)):
    own_account(account_id, user)
    return service.deposit(account_id, data.amount, actor=user.username)   # actor = who did it, for the audit log

@router.post("/{account_id}/withdraw", response_model=Account)
def withdraw(account_id: int, data: AmountIn, user: User = Depends(get_current_user)):
    own_account(account_id, user)
    return service.withdraw(account_id, data.amount, actor=user.username)

@router.patch("/{account_id}/settings", response_model=Account)
def update_settings(account_id: int, data: AccountSettingsIn, user: User = Depends(get_current_user)):
    """The owner's nickname and savings goal for one account."""
    own_account(account_id, user)
    return service.update_settings(account_id, data)


@router.get("/{account_id}/payee", response_model=PayeeOut, dependencies=[Depends(limit("payee", 30, 60))])
def payee(account_id: int, user: User = Depends(get_current_user)):
    """Any signed-in user may look up WHO an account belongs to (as "Jane S.") before sending money.
    Rate limited (30 a minute per IP) so nobody can walk through every account number."""
    return service.payee(account_id)


@router.get("/{account_id}/transactions", response_model=list[Transaction])
def get_transactions(account_id: int, user: User = Depends(get_current_user)):
    own_account(account_id, user)
    return service.get_transactions(account_id)
    # end of account routes
    
@transfer_router.post("", response_model=Transaction, status_code=201)
def transfer(data: TransferIn, user: User = Depends(get_current_user)):
    own_account(data.from_account_id, user)   # you can only send FROM your own account
    return service.transfer(data, actor=user.username)
