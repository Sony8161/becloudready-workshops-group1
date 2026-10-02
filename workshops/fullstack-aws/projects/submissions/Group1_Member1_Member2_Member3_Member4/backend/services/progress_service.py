"""Progress maths shared by plans, the dashboard and the trainee home page.

A task counts as done when the trainee has a DONE report for it.
Plan progress  = done tasks / all tasks.
Plan state     = COMPLETE | BLOCKED (latest report blocked) | BEHIND (overdue task) | ON_TRACK.
Trainee status = UNASSIGNED | COMPLETE | BLOCKED | NOT_REPORTING | BEHIND | ON_TRACK.
"""
from __future__ import annotations

from datetime import timedelta

import config
from serializers import iso, now, today_str

AT_RISK = {"BLOCKED", "NOT_REPORTING", "BEHIND"}


def plan_audience(plan: dict, cohort_members: dict[str, list[str]]) -> list[str]:
    if plan["assignee_type"] == "TRAINEE":
        return [plan["assignee_id"]]
    return list(cohort_members.get(plan["assignee_id"], []))


def group_reports(reports: list[dict]) -> dict[tuple[str, str], list[dict]]:
    """(trainee_id, plan_id) -> reports, newest first (input must be newest first)."""
    out: dict[tuple[str, str], list[dict]] = {}
    for r in reports:
        out.setdefault((r["trainee_id"], r["plan_id"]), []).append(r)
    return out


def plan_progress(plan: dict, reports: list[dict]) -> dict:
    today = today_str()
    tasks = plan.get("tasks", [])
    task_ids = {t["id"] for t in tasks}
    done = {r["task_id"] for r in reports if r["status"] == "DONE" and r.get("task_id") in task_ids}
    task_rows = []
    for t in tasks:
        is_done = t["id"] in done
        task_rows.append(
            {
                "id": t["id"],
                "title": t["title"],
                "due_date": t.get("due_date"),
                "done": is_done,
                "overdue": bool(t.get("due_date") and t["due_date"] < today and not is_done),
            }
        )
    latest = reports[0] if reports else None
    overdue = sum(1 for t in task_rows if t["overdue"])
    pct = round(100 * len(done) / len(tasks)) if tasks else 0
    if tasks and len(done) == len(tasks):
        state = "COMPLETE"
    elif latest and latest["status"] == "BLOCKED":
        state = "BLOCKED"
    elif overdue:
        state = "BEHIND"
    else:
        state = "ON_TRACK"
    next_task = next((t for t in task_rows if not t["done"]), None)
    return {
        "plan_id": str(plan["_id"]),
        "title": plan["title"],
        "assignee_type": plan["assignee_type"],
        "progress": pct,
        "done_count": len(done),
        "task_count": len(tasks),
        "overdue_count": overdue,
        "latest_status": latest["status"] if latest else None,
        "last_report_at": iso(latest["created_at"]) if latest else None,
        "state": state,
        "next_task": next_task,
        "tasks": task_rows,
    }


def trainee_status(plan_rows: list[dict], plans: list[dict], reports: list[dict]) -> str:
    """plan_rows: plan_progress() results; reports: all this trainee's reports, newest first."""
    if not plan_rows:
        return "UNASSIGNED"
    if all(p["state"] == "COMPLETE" for p in plan_rows):
        return "COMPLETE"
    if any(p["state"] == "BLOCKED" for p in plan_rows):
        return "BLOCKED"
    silent_since = now() - timedelta(days=config.SILENT_DAYS)
    last = reports[0]["created_at"] if reports else None
    if last is not None and last < silent_since:
        return "NOT_REPORTING"
    if last is None:
        oldest_plan = min(p["created_at"] for p in plans)
        if oldest_plan < silent_since:
            return "NOT_REPORTING"
    if any(p["state"] == "BEHIND" for p in plan_rows):
        return "BEHIND"
    return "ON_TRACK"
