import hashlib
import secrets
import string
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException

from customer_repository import CustomerRepository
from mailer import FRONTEND_URL, send_email
from models import (ChangePasswordIn, CreateLoginIn, CustomerIn, LoginIn, LoginInfo, MessageOut, RegisterIn,
                    ResetPasswordIn, Role, SecurityEvent, SecurityEventIn, SecurityEventType, TempPasswordOut,
                    TokenOut, User, UserInDB)
from reset_repository import ResetRepository
from security import (LOCK_MINUTES, MAX_FAILED_LOGINS, RESET_MINUTES, create_access_token, hash_password,
                      verify_password)
from security_repository import SecurityRepository
from user_repository import UserRepository

# The SAME answer whether or not the account exists, so these forms can't be used to find out who banks here.
USERNAME_SENT = "If that email is on file, we've sent the username to it."
RESET_SENT = f"If that account exists, we've emailed a reset link to the address on file. It works for {RESET_MINUTES} minutes."


class AuthService:
    """Logins: sign in, sign up, admin-created logins, and the first admin account."""

    def __init__(self, user_repo: UserRepository, customer_repo: CustomerRepository,
                 security_repo: SecurityRepository, reset_repo: ResetRepository):
        self._users = user_repo
        self._customers = customer_repo
        self._events = security_repo   # the sign-in log (auditing)
        self._resets = reset_repo      # "forgot password" links

    def login(self, data: LoginIn, ip: str | None = None) -> TokenOut:
        username = data.username.strip().lower()
        user = self._users.find_by_username(username)
        self._ensure_not_locked(user, ip)   # a locked login is refused BEFORE the password is even checked
        if user is None or not verify_password(data.password, user.password_hash):
            self._login_failed(username, user, ip)
            raise HTTPException(status_code=401, detail="Invalid username or password")
        self._users.reset_failed_logins(user.id)   # a correct password clears the count
        self._log(SecurityEventType.LOGIN_SUCCESS, username, ip)
        return self._token_for(user)

    # ---------- lockout: stops password guessing ----------
    def _ensure_not_locked(self, user: UserInDB | None, ip: str | None) -> None:
        """429 Too Many Requests while a login is locked after MAX_FAILED_LOGINS wrong passwords."""
        if user is None or user.locked_until is None:
            return
        left = user.locked_until - datetime.now(timezone.utc)
        if left.total_seconds() > 0:
            minutes = int(left.total_seconds() // 60) + 1
            self._log(SecurityEventType.LOGIN_BLOCKED, user.username, ip, f"locked for {minutes} more min")
            raise HTTPException(status_code=429,
                                detail=f"Too many failed attempts. Try again in {minutes} minute(s).")

    def _login_failed(self, username: str, user: UserInDB | None, ip: str | None) -> None:
        if user is None:
            self._log(SecurityEventType.LOGIN_FAILED, username, ip, "unknown username")
            return
        lock_until = datetime.now(timezone.utc) + timedelta(minutes=LOCK_MINUTES)
        updated = self._users.record_failed_login(user.id, MAX_FAILED_LOGINS, lock_until)
        if updated.locked_until is not None:
            self._log(SecurityEventType.LOCKED_OUT, username, ip,
                      f"{MAX_FAILED_LOGINS} wrong passwords, locked {LOCK_MINUTES} min")
        else:
            self._log(SecurityEventType.LOGIN_FAILED, username, ip,
                      f"wrong password ({updated.failed_logins} of {MAX_FAILED_LOGINS})")

    def _log(self, kind: SecurityEventType, username: str, ip: str | None = None,
             detail: str | None = None) -> None:
        self._events.create(SecurityEventIn(type=kind, username=username, ip=ip, detail=detail,
                                            timestamp=datetime.now(timezone.utc)))

    def register(self, data: RegisterIn, ip: str | None = None) -> TokenOut:
        """Online sign-up: creates a NEW customer and their login, then logs them in."""
        username = data.username.strip().lower()
        if self._users.find_by_username(username):
            raise HTTPException(status_code=409, detail="That username is taken")
        if self._customers.find_by_email(data.email.strip()):
            # Don't let a stranger claim an existing customer just by knowing their email.
            raise HTTPException(status_code=409,
                                detail="A customer with this email already exists. Ask the bank to turn on online banking.")
        customer = self._customers.create(CustomerIn(name=data.name.strip(), email=data.email.strip()))
        user = self._users.create(username, hash_password(data.password), Role.CUSTOMER, customer.id)
        self._log(SecurityEventType.REGISTERED, username, ip, f"new customer {customer.id}")
        return self._token_for(user)

    def create_login(self, data: CreateLoginIn, by: str | None = None) -> User:
        """Admin turns on online banking for an existing customer."""
        if self._customers.find_by_id(data.customer_id) is None:
            raise HTTPException(status_code=404, detail="Customer not found")
        if self._users.find_by_customer_id(data.customer_id):
            raise HTTPException(status_code=409, detail="This customer already has a login")
        if self._users.find_by_username(data.username.strip()):
            raise HTTPException(status_code=409, detail="That username is taken")
        user = self._users.create(data.username.strip(), hash_password(data.password),
                                  Role.CUSTOMER, data.customer_id)
        self._log(SecurityEventType.LOGIN_CREATED, user.username, None,
                  f"customer {data.customer_id}, by {by or 'system'}")
        return _public(user)

    def list_events(self, limit: int, skip: int, problems_only: bool = False):
        # problems = wrong passwords, lockouts, and tries while locked
        query = {"type": {"$in": ["LOGIN_FAILED", "LOCKED_OUT", "LOGIN_BLOCKED"]}} if problems_only else {}
        return self._events.find_page(limit, skip, query), self._events.count(query)

    # ---------- forgot username / forgot password / reset ----------
    def forgot_username(self, email: str, ip: str | None = None) -> MessageOut:
        customer = self._customers.find_by_email(email.strip())
        user = self._users.find_by_customer_id(customer.id) if customer else None
        if user:
            send_email(customer.email, "Your Simple Bank username",
                       f"Hi {customer.name},\n\nYour username is: {user.username}\n\n"
                       "If you didn't ask for this, you can ignore this email.")
            self._log(SecurityEventType.USERNAME_REMINDER, user.username, ip, "sent to the email on file")
        return MessageOut(message=USERNAME_SENT)

    def forgot_password(self, username_or_email: str, ip: str | None = None) -> MessageOut:
        text = username_or_email.strip()
        user = self._users.find_by_username(text)
        if user is None and "@" in text:
            customer = self._customers.find_by_email(text)
            user = self._users.find_by_customer_id(customer.id) if customer else None
        customer = self._customers.find_by_id(user.customer_id) if user and user.customer_id else None
        if user and customer:
            token = secrets.token_urlsafe(32)          # 43 random characters: impossible to guess
            self._resets.cancel_open_for_user(user.id)  # only the newest link works
            self._resets.create(user.id, _sha256(token),
                                datetime.now(timezone.utc) + timedelta(minutes=RESET_MINUTES))
            send_email(customer.email, "Reset your Simple Bank password",
                       f"Hi {customer.name},\n\nOpen this link to choose a new password "
                       f"(it works for {RESET_MINUTES} minutes, once):\n{FRONTEND_URL}/reset-password?token={token}\n\n"
                       "If you didn't ask for this, ignore this email: your password stays the same.")
            self._log(SecurityEventType.PASSWORD_RESET_REQUESTED, user.username, ip, "link emailed")
        return MessageOut(message=RESET_SENT)

    def reset_password(self, data: ResetPasswordIn, ip: str | None = None) -> MessageOut:
        row = self._resets.find_valid(_sha256(data.token), datetime.now(timezone.utc))
        if row is None:
            raise HTTPException(status_code=400, detail="This reset link is invalid or has expired. Ask for a new one.")
        user = self._users.set_password(row["user_id"], hash_password(data.new_password))   # also signs out everywhere
        self._resets.cancel_open_for_user(user.id)
        self._log(SecurityEventType.PASSWORD_RESET, user.username, ip, "new password set from emailed link")
        return MessageOut(message="Password changed. You can sign in with your new password.")

    # ---------- signed-in account security ----------
    def change_password(self, user: User, data: ChangePasswordIn, ip: str | None = None) -> TokenOut:
        stored = self._users.find_by_id(user.id)
        if not verify_password(data.current_password, stored.password_hash):
            raise HTTPException(status_code=400, detail="Your current password is not right")
        if data.current_password == data.new_password:
            raise HTTPException(status_code=400, detail="Pick a password you haven't just used")
        updated = self._users.set_password(user.id, hash_password(data.new_password))   # old tokens stop working
        self._log(SecurityEventType.PASSWORD_CHANGED, user.username, ip, "other sessions signed out")
        return self._token_for(updated)   # a fresh token keeps THIS browser signed in

    def refresh(self, user: User) -> TokenOut:
        """A new token with a new expiry time. The guard already checked the old token (signature, expiry,
        token_version), so this only extends a session that is still alive; "sign out everywhere" still wins."""
        return self._token_for(self._users.find_by_id(user.id))

    def sign_out_everywhere(self, user: User, ip: str | None = None) -> TokenOut:
        updated = self._users.bump_token_version(user.id)
        self._log(SecurityEventType.SIGNED_OUT_EVERYWHERE, user.username, ip)
        return self._token_for(updated)

    def my_events(self, user: User, limit: int = 10) -> list[SecurityEvent]:
        return self._events.find_for_username(user.username, limit)

    def token_is_current(self, user_id: int, token_version: int) -> bool:
        user = self._users.find_by_id(user_id)
        return user is not None and user.token_version == token_version

    # ---------- staff tools ----------
    def login_info(self, user: UserInDB) -> LoginInfo:
        locked = user.locked_until is not None and user.locked_until > datetime.now(timezone.utc)
        return LoginInfo(**_public(user).model_dump(), locked=locked, failed_logins=user.failed_logins)

    def unlock(self, user_id: int, by: str) -> LoginInfo:
        user = self._require_login(user_id)
        self._users.reset_failed_logins(user.id)
        self._log(SecurityEventType.UNLOCKED, user.username, None, f"by {by}")
        return self.login_info(self._users.find_by_id(user.id))

    def temporary_password(self, user_id: int, by: str) -> TempPasswordOut:
        user = self._require_login(user_id)
        temp = _temporary_password()
        self._users.set_password(user.id, hash_password(temp))   # unlocks + signs out everywhere
        self._log(SecurityEventType.TEMP_PASSWORD_SET, user.username, None, f"by {by}")
        return TempPasswordOut(username=user.username, temporary_password=temp)

    def _require_login(self, user_id: int) -> UserInDB:
        user = self._users.find_by_id(user_id)
        if user is None:
            raise HTTPException(status_code=404, detail="Login not found")
        return user

    def list_users(self) -> list[User]:
        return [_public(u) for u in self._users.find_all()]

    def get_user(self, user_id: int) -> User | None:
        user = self._users.find_by_id(user_id)
        return _public(user) if user else None

    def ensure_admin(self, username: str, password: str) -> None:
        """Runs when the server starts: makes sure there is at least one admin to log in with."""
        self._users.ensure_indexes()
        if self._users.find_by_username(username) is None:
            self._users.create(username, hash_password(password), Role.ADMIN)
            print(f"Created admin login '{username}'")

    def _token_for(self, user: UserInDB) -> TokenOut:
        return TokenOut(access_token=create_access_token(user), user=_public(user))


def _sha256(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()


def _temporary_password() -> str:
    """10 random characters, letters AND digits, without look-alikes (0/O, 1/l/I)."""
    letters = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ"
    digits = "23456789"
    chars = [secrets.choice(letters) for _ in range(7)] + [secrets.choice(digits) for _ in range(3)]
    secrets.SystemRandom().shuffle(chars)
    return "".join(chars)


def _public(user: UserInDB) -> User:
    """Drop the password hash before anything leaves the service."""
    return User(**user.model_dump(exclude={"password_hash", "failed_logins", "locked_until", "token_version"}))
