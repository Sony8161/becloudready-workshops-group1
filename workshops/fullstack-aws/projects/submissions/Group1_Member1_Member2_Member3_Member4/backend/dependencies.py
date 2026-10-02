"""Composition root: build every repository and service once and share them."""
from functools import lru_cache

from db import get_db
from repositories.cohort_repository import CohortRepository
from repositories.notice_repository import NoticeRepository
from repositories.notification_repository import NotificationRepository
from repositories.plan_repository import PlanRepository
from repositories.report_repository import ReportRepository
from repositories.user_repository import UserRepository
from services.auth_service import AuthService
from services.cohort_service import CohortService
from services.dashboard_service import DashboardService
from services.notice_service import NoticeService
from services.notification_service import NotificationService
from services.plan_service import PlanService
from services.report_service import ReportService
from services.user_service import UserService


class Container:
    def __init__(self, db):
        self.user_repo = UserRepository(db)
        cohorts = CohortRepository(db)
        plans = PlanRepository(db)
        notices = NoticeRepository(db)
        reports = ReportRepository(db)

        self.notifications = NotificationService(NotificationRepository(db))
        self.auth = AuthService(self.user_repo)
        self.users = UserService(self.user_repo, cohorts, self.notifications)
        self.cohorts = CohortService(cohorts, self.user_repo, plans, self.notifications)
        self.plans = PlanService(plans, cohorts, self.user_repo, reports, self.notifications)
        self.notices = NoticeService(notices, cohorts, self.user_repo, self.notifications)
        self.reports = ReportService(reports, plans, cohorts, self.user_repo, self.plans, self.notifications)
        self.dashboard = DashboardService(self.user_repo, cohorts, plans, reports, self.reports, self.notices)


@lru_cache
def get_container() -> Container:
    return Container(get_db())
