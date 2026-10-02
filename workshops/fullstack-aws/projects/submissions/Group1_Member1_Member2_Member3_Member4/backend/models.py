"""Request bodies (Pydantic v2). Responses are plain dicts made by serializers.py."""
from datetime import date
from enum import Enum
from typing import Optional

from pydantic import BaseModel, EmailStr, Field, field_validator


class Role(str, Enum):
    HR = "HR"
    MANAGER = "MANAGER"
    TRAINEE = "TRAINEE"


class UserStatus(str, Enum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"


class AssigneeType(str, Enum):
    COHORT = "COHORT"
    TRAINEE = "TRAINEE"


class AudienceType(str, Enum):
    ALL = "ALL"
    COHORT = "COHORT"
    TRAINEE = "TRAINEE"


class Priority(str, Enum):
    NORMAL = "NORMAL"
    IMPORTANT = "IMPORTANT"
    URGENT = "URGENT"


class ReportStatus(str, Enum):
    IN_PROGRESS = "IN_PROGRESS"
    DONE = "DONE"
    BLOCKED = "BLOCKED"


def _password_rule(v: str) -> str:
    if len(v) < 8 or not any(c.isalpha() for c in v) or not any(c.isdigit() for c in v):
        raise ValueError("Password needs at least 8 characters, with a letter and a number")
    return v


def _clean(v: Optional[str]) -> Optional[str]:
    return v.strip() if isinstance(v, str) else v


# ---------- auth ----------
class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=200)


class ChangePasswordIn(BaseModel):
    current_password: str = Field(min_length=1, max_length=200)
    new_password: str = Field(max_length=200)

    _rule = field_validator("new_password")(_password_rule)


# ---------- users ----------
class UserCreate(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    role: Role = Role.TRAINEE
    track: Optional[str] = Field(default=None, max_length=100)
    phone: Optional[str] = Field(default=None, max_length=30)
    start_date: Optional[date] = None
    cohort_id: Optional[str] = None
    force: bool = False  # create even if a trainee with the same name exists

    _strip = field_validator("name", "track", "phone")(_clean)


class UserUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=100)
    email: Optional[EmailStr] = None
    track: Optional[str] = Field(default=None, max_length=100)
    phone: Optional[str] = Field(default=None, max_length=30)
    start_date: Optional[date] = None

    _strip = field_validator("name", "track", "phone")(_clean)


class ImportRow(BaseModel):
    name: str = ""
    email: str = ""
    track: Optional[str] = None
    phone: Optional[str] = None
    start_date: Optional[str] = None
    cohort: Optional[str] = None  # cohort name


class ImportIn(BaseModel):
    rows: list[ImportRow] = Field(max_length=500)
    include_possible_duplicates: bool = False


# ---------- cohorts ----------
class CohortCreate(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    description: Optional[str] = Field(default="", max_length=500)
    manager_id: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None

    _strip = field_validator("name", "description")(_clean)


class CohortUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=80)
    description: Optional[str] = Field(default=None, max_length=500)
    manager_id: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None

    _strip = field_validator("name", "description")(_clean)


class MembersIn(BaseModel):
    trainee_ids: list[str] = Field(min_length=1, max_length=500)


# ---------- plans ----------
class TaskIn(BaseModel):
    id: Optional[str] = None  # keep existing id when editing
    title: str = Field(min_length=2, max_length=150)
    due_date: Optional[date] = None

    _strip = field_validator("title")(_clean)


class PlanCreate(BaseModel):
    title: str = Field(min_length=2, max_length=120)
    description: Optional[str] = Field(default="", max_length=2000)
    assignee_type: AssigneeType
    assignee_id: str
    tasks: list[TaskIn] = Field(min_length=1, max_length=50)

    _strip = field_validator("title", "description")(_clean)


class PlanUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=2, max_length=120)
    description: Optional[str] = Field(default=None, max_length=2000)
    tasks: Optional[list[TaskIn]] = Field(default=None, min_length=1, max_length=50)

    _strip = field_validator("title", "description")(_clean)


class PlanCopyIn(BaseModel):
    assignee_type: AssigneeType
    assignee_id: str


# ---------- notices ----------
class NoticeCreate(BaseModel):
    title: str = Field(min_length=2, max_length=120)
    body: str = Field(min_length=1, max_length=5000)
    priority: Priority = Priority.NORMAL
    audience_type: AudienceType = AudienceType.ALL
    audience_id: Optional[str] = None
    pinned: bool = False

    _strip = field_validator("title", "body")(_clean)


class NoticeUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=2, max_length=120)
    body: Optional[str] = Field(default=None, min_length=1, max_length=5000)
    priority: Optional[Priority] = None
    pinned: Optional[bool] = None

    _strip = field_validator("title", "body")(_clean)


# ---------- progress reports ----------
class ReportCreate(BaseModel):
    plan_id: str
    task_id: Optional[str] = None
    status: ReportStatus = ReportStatus.IN_PROGRESS
    summary: str = Field(min_length=3, max_length=3000)
    blockers: Optional[str] = Field(default="", max_length=2000)
    hours: Optional[float] = Field(default=None, ge=0, le=100)

    _strip = field_validator("summary", "blockers")(_clean)


class FeedbackIn(BaseModel):
    text: str = Field(min_length=1, max_length=2000)

    _strip = field_validator("text")(_clean)
