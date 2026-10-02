from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, PlainSerializer, field_validator
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    """Base for every model. Python uses snake_case, JSON uses camelCase:
    customer_id in code  <->  "customerId" in requests/responses."""
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


# Money is stored as Decimal (exact math) but sent to the client as a JSON number.
Money = Annotated[Decimal, PlainSerializer(float, return_type=float, when_used="json")]


# ---------- Customers ----------


class CustomerIn(CamelModel):   # what the client sends
    name: str
    email: str


class Customer(CustomerIn):        # inheritance: CustomerIn + id
    id: int


# ---------- Accounts ----------
class AccountType(str, Enum):   # only these values are allowed (Swagger shows a dropdown)
    SAVINGS = "SAVINGS"
    CHECKING = "CHECKING"


class AccountIn(CamelModel):
    @staticmethod
    def example() -> "AccountIn":
        return AccountIn(customer_id=1, account_type=AccountType.SAVINGS)

    """POST /api/accounts body: {"customerId": 1, "accountType": "SAVINGS"}"""
    
    customer_id: int
    account_type: AccountType


class AccountUpdate(CamelModel):
    """PUT body. No balance on purpose: only deposit/withdraw may change money."""
    
    account_type: AccountType


class Account(CamelModel):
    """What the API returns."""
    # Inherits from AccountIn? Could be considered, but here we explicitly list all fields. 
    id: int
    customer_id: int
    account_type: AccountType
    balance: Money = Decimal("0.00")
    nickname: str | None = None   # the owner's own label: "Rent", "Vacation fund"
    goal: Money | None = None     # a savings goal; the page shows progress toward it


class AccountSettingsIn(CamelModel):
    """PATCH /api/accounts/{id}/settings: labels the OWNER picks. Never touches the balance.
    Send null (or leave out) to clear a nickname or goal."""
    nickname: str | None = Field(default=None, max_length=30)
    goal: Money | None = None

    @field_validator("nickname")
    @classmethod
    def tidy_nickname(cls, value: str | None) -> str | None:
        value = (value or "").strip()
        return value or None   # "   " counts as no nickname

    @field_validator("goal")
    @classmethod
    def goal_rule(cls, value: Decimal | None) -> Decimal | None:
        if value is not None and not (Decimal("0") < value <= Decimal("1000000")):
            raise ValueError("Goal must be between $0.01 and $1,000,000")
        return value


class PayeeOut(CamelModel):
    """Confirmation of payee: who an account number belongs to, shown BEFORE money is sent,
    as "Jane S." (first name + last initial), so a typo doesn't send money to a stranger."""
    account_id: int
    name: str


class AmountIn(CamelModel):
    """Body for deposit/withdraw: {"amount": 500}"""
    # TODO: amount (type Money)
    amount: Money


class TransferIn(CamelModel):
    """POST /api/transfers body: {"fromAccountId": 1, "toAccountId": 2, "amount": 50}"""
    
    from_account_id: int
    to_account_id: int
    amount: Money


# ---------- Audit (transactions) ----------
class TxnType(str, Enum):
    DEPOSIT = "DEPOSIT"
    WITHDRAW = "WITHDRAW"
    TRANSFER = "TRANSFER"


class TransactionIn(CamelModel):
    """One audit record. Answers: what? how much? who? which accounts? when?"""
    type: TxnType
    amount: Money
    customer_id: int
    from_account_id: int | None = None
    to_account_id: int | None = None
    timestamp: datetime
    performed_by: str | None = None   # the LOGIN that did it: "john" (online) or "admin" (a teller)



class Transaction(TransactionIn):   # same In/Out pattern as Customer(CustomerIn)
    id: int


# ---------- Login / users (JWT) ----------
def strong_password(value: str) -> str:
    """The one password rule, used by sign-up, change, reset and admin-created logins:
    6-72 characters with at least one letter AND one number."""
    if not any(c.isalpha() for c in value) or not any(c.isdigit() for c in value):
        raise ValueError("Password needs at least one letter and one number")
    return value


class Role(str, Enum):
    ADMIN = "ADMIN"         # bank staff: sees and manages everyone
    CUSTOMER = "CUSTOMER"   # sees only their own customer record, accounts and transactions


class LoginIn(CamelModel):
    """POST /api/auth/login body: {"username": "admin", "password": "admin123"}"""
    username: str
    password: str = Field(max_length=72)   # bcrypt only reads the first 72 bytes


class RegisterIn(CamelModel):
    """POST /api/auth/register body: a NEW customer and their login, in one step."""
    name: str = Field(min_length=1, max_length=100)
    email: str = Field(min_length=3, max_length=254, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    username: str = Field(min_length=3, max_length=30, pattern=r"^[A-Za-z0-9_.-]+$")
    password: str = Field(min_length=6, max_length=72)

    @field_validator("password")
    @classmethod
    def password_rule(cls, value: str) -> str:
        return strong_password(value)   # letter + number, shared by every password form


class CreateLoginIn(CamelModel):
    """POST /api/auth/users body (admin only): turn on online banking for an existing customer."""
    customer_id: int
    username: str = Field(min_length=3, max_length=30, pattern=r"^[A-Za-z0-9_.-]+$")
    password: str = Field(min_length=6, max_length=72)
    @field_validator("password")
    @classmethod
    def password_rule(cls, value: str) -> str:
        return strong_password(value)   # letter + number, shared by every password form


class ForgotUsernameIn(CamelModel):
    """POST /api/auth/forgot-username body: {"email": "john@example.com"}"""
    email: str = Field(min_length=3, max_length=254)


class ForgotPasswordIn(CamelModel):
    """POST /api/auth/forgot-password body: {"usernameOrEmail": "john"}"""
    username_or_email: str = Field(min_length=3, max_length=254)


class ResetPasswordIn(CamelModel):
    """POST /api/auth/reset-password body: the token from the emailed link + the new password."""
    token: str = Field(min_length=20, max_length=200)
    new_password: str = Field(min_length=6, max_length=72)
    @field_validator("new_password")
    @classmethod
    def password_rule(cls, value: str) -> str:
        return strong_password(value)   # letter + number, shared by every password form


class ChangePasswordIn(CamelModel):
    """PUT /api/auth/me/password body (signed in): {"currentPassword": "...", "newPassword": "..."}"""
    current_password: str = Field(max_length=72)
    new_password: str = Field(min_length=6, max_length=72)
    @field_validator("new_password")
    @classmethod
    def password_rule(cls, value: str) -> str:
        return strong_password(value)   # letter + number, shared by every password form


class MessageOut(CamelModel):
    """A plain answer, e.g. "If that email is on file, we've sent your username to it.\""""
    message: str


class TempPasswordOut(CamelModel):
    """Admin reset: the temporary password is shown ONCE, to the admin, and never stored in plain text."""
    username: str
    temporary_password: str


class User(CamelModel):
    """A login, as the API returns it. Never includes the password hash."""
    id: int
    username: str
    role: Role
    customer_id: int | None = None   # which customer this login belongs to (None for admins)


class UserInDB(User):
    """A login as stored in MongoDB. Only the repository and AuthService see this."""
    password_hash: str
    failed_logins: int = 0                # wrong passwords in a row
    locked_until: datetime | None = None  # set after too many wrong passwords
    token_version: int = 0                # +1 = every token issued before stops working ("sign out everywhere")


class LoginInfo(User):
    """What staff see about a login: the public fields + whether it is locked right now."""
    locked: bool = False
    failed_logins: int = 0


class TokenOut(CamelModel):
    """Login response: {"accessToken": "eyJ...", "tokenType": "bearer", "user": {...}}"""
    access_token: str
    token_type: str = "bearer"
    user: User


# ---------- Security log (sign-ins) ----------
class SecurityEventType(str, Enum):
    LOGIN_SUCCESS = "LOGIN_SUCCESS"
    LOGIN_FAILED = "LOGIN_FAILED"
    LOCKED_OUT = "LOCKED_OUT"            # too many wrong passwords: login refused for a while
    LOGIN_BLOCKED = "LOGIN_BLOCKED"      # tried again while locked
    REGISTERED = "REGISTERED"
    LOGIN_CREATED = "LOGIN_CREATED"      # an admin turned on online banking for a customer
    USERNAME_REMINDER = "USERNAME_REMINDER"            # "forgot username" email sent
    PASSWORD_RESET_REQUESTED = "PASSWORD_RESET_REQUESTED"
    PASSWORD_RESET = "PASSWORD_RESET"                  # new password set from an emailed link
    PASSWORD_CHANGED = "PASSWORD_CHANGED"              # changed while signed in
    SIGNED_OUT_EVERYWHERE = "SIGNED_OUT_EVERYWHERE"
    UNLOCKED = "UNLOCKED"                              # staff ended a lockout early
    TEMP_PASSWORD_SET = "TEMP_PASSWORD_SET"            # staff gave a temporary password


class SecurityEventIn(CamelModel):
    """One sign-in event. Like the transactions audit trail, these are only ever added."""
    type: SecurityEventType
    username: str
    ip: str | None = None
    detail: str | None = None
    timestamp: datetime


class SecurityEvent(SecurityEventIn):
    id: int


# ---------- Admin dashboard numbers ----------
class AdminStats(CamelModel):
    """GET /api/admin/stats: totals counted BY THE DATABASE, so the browser downloads 8 numbers, not every record."""
    customers: int
    accounts: int
    savings_accounts: int
    total_balance: Money
    premium_accounts: int
    premium_threshold: Money
    transactions: int
    transactions_today: int


class AdminCustomer(CamelModel):
    """One row of the staff customer list: totals worked out on the server, one page at a time."""
    id: int
    name: str
    email: str
    account_count: int
    total_balance: Money
    premium: bool
    login: LoginInfo | None = None



# ---------- Staff notes on a customer ----------
class NoteIn(CamelModel):
    """POST /api/admin/customers/{id}/notes body."""
    text: str = Field(min_length=1, max_length=500)

    @field_validator("text")
    @classmethod
    def not_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Write something in the note")
        return value.strip()


class Note(CamelModel):
    """A staff note, e.g. "Called 10/1 about the lockout". Kept like the audit log: never edited."""
    id: int
    customer_id: int
    text: str
    author: str
    timestamp: datetime
