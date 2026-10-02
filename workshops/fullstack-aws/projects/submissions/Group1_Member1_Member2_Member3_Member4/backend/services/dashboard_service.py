"""High-level views: the manager/HR dashboard and one trainee's overview."""
from __future__ import annotations

from collections import Counter
from datetime import timedelta

from errors import NotFound
from repositories.cohort_repository import CohortRepository
from repositories.plan_repository import PlanRepository
from repositories.report_repository import ReportRepository
from repositories.user_repository import UserRepository
from serializers import clean, iso, now, oid
from services.notice_service import NoticeService
from services.progress_service import AT_RISK, group_reports, plan_audience, plan_progress, trainee_status
from services.report_service import ReportService


class DashboardService:
    def __init__(self, users: UserRepository, cohorts: CohortRepository, plans: PlanRepository,
                 reports: ReportRepository, report_service: ReportService, notice_service: NoticeService):
        self.users = users
        self.cohorts = cohorts
        self.plans = plans
        self.reports = reports
        self.report_service = report_service
        self.notice_service = notice_service

    def _snapshot(self):
        trainees = self.users.search(role="TRAINEE", status="ACTIVE")
        cohorts = self.cohorts.find_all()
        plans = self.plans.find({"status": "ACTIVE"})
        reports = self.reports.for_progress()
        members = {str(c["_id"]): c.get("trainee_ids", []) for c in cohorts}
        plans_by_trainee: dict[str, list[dict]] = {}
        for p in plans:
            for t in plan_audience(p, members):
                plans_by_trainee.setdefault(t, []).append(p)
        reports_by_trainee: dict[str, list[dict]] = {}
        for r in reports:
            reports_by_trainee.setdefault(r["trainee_id"], []).append(r)
        return trainees, cohorts, plans, reports, members, plans_by_trainee, reports_by_trainee, group_reports(reports)

    def _trainee_row(self, t, cohorts_of, plans_by_trainee, reports_by_trainee, grouped) -> dict:
        tid = str(t["_id"])
        plans = plans_by_trainee.get(tid, [])
        rows = [plan_progress(p, grouped.get((tid, str(p["_id"])), [])) for p in plans]
        mine = reports_by_trainee.get(tid, [])
        status = trainee_status(rows, plans, mine)
        return {
            "id": tid,
            "name": t["name"],
            "email": t["email"],
            "track": t.get("track"),
            "cohorts": cohorts_of.get(tid, []),
            "plan_count": len(plans),
            "progress": round(sum(r["progress"] for r in rows) / len(rows)) if rows else 0,
            "overdue_count": sum(r["overdue_count"] for r in rows),
            "last_report_at": iso(mine[0]["created_at"]) if mine else None,
            "status": status,
            "blocked_plans": [r["title"] for r in rows if r["state"] == "BLOCKED"],
        }

    def staff_dashboard(self, cohort_id: str | None = None) -> dict:
        trainees, cohorts, plans, reports, members, plans_by_trainee, reports_by_trainee, grouped = self._snapshot()
        cohorts_of: dict[str, list[str]] = {}
        for c in cohorts:
            for t in c.get("trainee_ids", []):
                cohorts_of.setdefault(t, []).append(c["name"])
        if cohort_id:
            scope = set(members.get(cohort_id, []))
            trainees = [t for t in trainees if str(t["_id"]) in scope]
        rows = [self._trainee_row(t, cohorts_of, plans_by_trainee, reports_by_trainee, grouped) for t in trainees]
        by_id = {r["id"]: r for r in rows}
        scope_ids = set(by_id)

        week_ago = now() - timedelta(days=7)
        scoped_reports = [r for r in reports if r["trainee_id"] in scope_ids]
        status_counts = Counter(r["status"] for r in rows)

        managers = {str(u["_id"]): u["name"] for u in self.users.search(role="MANAGER")}
        cohort_rows = []
        for c in cohorts:
            if cohort_id and str(c["_id"]) != cohort_id:
                continue
            active_members = [by_id[t] for t in c.get("trainee_ids", []) if t in by_id]
            cohort_rows.append(
                {
                    "id": str(c["_id"]),
                    "name": c["name"],
                    "manager": managers.get(c.get("manager_id") or "", None),
                    "trainee_count": len(active_members),
                    "avg_progress": round(sum(m["progress"] for m in active_members) / len(active_members))
                    if active_members else 0,
                    "at_risk": sum(1 for m in active_members if m["status"] in AT_RISK),
                    "reports_7d": sum(
                        1 for r in reports
                        if r["trainee_id"] in set(c.get("trainee_ids", [])) and r["created_at"] >= week_ago
                    ),
                    "plan_count": sum(
                        1 for p in plans if p["assignee_type"] == "COHORT" and p["assignee_id"] == str(c["_id"])
                    ),
                }
            )

        # Reports per day, last 14 days (oldest first) for the activity chart.
        today = now().date()
        per_day = Counter(r["created_at"].date().isoformat() for r in scoped_reports
                          if r["created_at"].date() > today - timedelta(days=14))
        activity = [
            {"date": (today - timedelta(days=i)).isoformat(),
             "reports": per_day.get((today - timedelta(days=i)).isoformat(), 0)}
            for i in range(13, -1, -1)
        ]

        awaiting = [r for r in self.report_service.list(awaiting_feedback=True, limit=500)
                    if r["trainee_id"] in scope_ids]
        with_plans = [r for r in rows if r["plan_count"]]
        summary = {
            "active_trainees": len(rows),
            "cohorts": len(cohort_rows),
            "active_plans": len(plans) if not cohort_id else sum(
                1 for p in plans if any(t in scope_ids for t in plan_audience(p, members))),
            "avg_progress": round(sum(r["progress"] for r in with_plans) / len(with_plans)) if with_plans else 0,
            "reports_7d": sum(1 for r in scoped_reports if r["created_at"] >= week_ago),
            "awaiting_feedback": len(awaiting),
            "at_risk": sum(status_counts[s] for s in AT_RISK),
            "unassigned": status_counts["UNASSIGNED"],
            "status_counts": dict(status_counts),
            "no_cohort": sum(1 for r in rows if not r["cohorts"]),
        }
        order = {"BLOCKED": 0, "NOT_REPORTING": 1, "BEHIND": 2, "UNASSIGNED": 3, "ON_TRACK": 4, "COMPLETE": 5}
        rows.sort(key=lambda r: (order.get(r["status"], 9), r["name"].lower()))
        return {
            "summary": summary,
            "trainees": rows,
            "cohorts": cohort_rows,
            "activity": activity,
            "awaiting_feedback": awaiting[:6],
            "notices": self.notice_service.list_for_staff()[:5],
            "generated_at": iso(now()),
        }

    def trainee_overview(self, trainee_id: str) -> dict:
        t = self.users.find_by_id(oid(trainee_id, "Trainee"))
        if not t or t["role"] != "TRAINEE":
            raise NotFound("Trainee not found")
        trainees, cohorts, plans, reports, members, plans_by_trainee, reports_by_trainee, grouped = self._snapshot()
        my_plans = plans_by_trainee.get(trainee_id, [])
        names = {str(c["_id"]): c["name"] for c in cohorts}
        plan_rows = []
        for p in my_plans:
            row = plan_progress(p, grouped.get((trainee_id, str(p["_id"])), []))
            row["assignee_name"] = names.get(p["assignee_id"], "Solo track") if p["assignee_type"] == "COHORT" \
                else "Solo track"
            row["description"] = p.get("description", "")
            plan_rows.append(row)
        mine = reports_by_trainee.get(trainee_id, [])
        notices = self.notice_service.list_for_trainee(trainee_id)
        user = clean(t)
        user["cohorts"] = [{"id": str(c["_id"]), "name": c["name"]} for c in cohorts
                           if trainee_id in c.get("trainee_ids", [])]
        return {
            "trainee": user,
            "status": trainee_status(plan_rows, my_plans, mine) if t["status"] == "ACTIVE" else "INACTIVE",
            "plans": plan_rows,
            "recent_reports": self.report_service.list_mine(trainee_id)[:8],
            "notices": notices[:6],
            "unread_notices": sum(1 for n in notices if not n["read"]),
            "report_count": len(mine),
        }
