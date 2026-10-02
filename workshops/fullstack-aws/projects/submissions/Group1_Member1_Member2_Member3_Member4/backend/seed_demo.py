"""Demo data: 2 managers, 2 cohorts, 12 trainees, plans, notices and reports spread over the last weeks.

Atlas:      python seed_demo.py            (adds demo data if it isn't there yet)
            python seed_demo.py --reset    (wipes the noticeboard collections first)
Mongomock:  set SEED_DEMO=true in .env and the API seeds itself on startup.

Demo logins (password for all: Demo1234):
  manager@noticeboard.dev (Maya Patel)   omar@noticeboard.dev (Omar Reyes)
  ana@noticeboard.dev (trainee)          ... see TRAINEES below
HR: BOOTSTRAP_HR_EMAIL / BOOTSTRAP_HR_PASSWORD from .env (default hr@noticeboard.dev / hrAdmin123)
"""
import sys
import uuid
from datetime import timedelta

from security import hash_password
from serializers import now
from services.auth_service import name_key

DEMO_PASSWORD = "Demo1234"

MANAGERS = [("Maya Patel", "manager@noticeboard.dev"), ("Omar Reyes", "omar@noticeboard.dev")]

# name, email, track, cohort (None = solo / unassigned)
TRAINEES = [
    ("Ana Lopez", "ana@noticeboard.dev", "Full Stack AWS", "Cloud Cohort A"),
    ("Ben Carter", "ben@noticeboard.dev", "Full Stack AWS", "Cloud Cohort A"),
    ("Chloe Nguyen", "chloe@noticeboard.dev", "Full Stack AWS", "Cloud Cohort A"),
    ("David Kim", "david@noticeboard.dev", "Full Stack AWS", "Cloud Cohort A"),
    ("Elena Rossi", "elena@noticeboard.dev", "Full Stack AWS", "Cloud Cohort A"),
    ("Farah Ali", "farah@noticeboard.dev", "Data Engineering", "Data Cohort B"),
    ("George Smith", "george@noticeboard.dev", "Data Engineering", "Data Cohort B"),
    ("Hana Sato", "hana@noticeboard.dev", "Data Engineering", "Data Cohort B"),
    ("Ivan Petrov", "ivan@noticeboard.dev", "Data Engineering", "Data Cohort B"),
    ("Jade Wilson", "jade@noticeboard.dev", "Security", None),  # solo track
    ("Kofi Mensah", "kofi@noticeboard.dev", "Full Stack AWS", None),  # onboarded, never assigned
    ("Lina Haddad", "lina@noticeboard.dev", "Data Engineering", None),  # onboarded, never assigned
]

SEED_COLLECTIONS = ["users", "cohorts", "plans", "notices", "notifications", "reports"]


def _tid() -> str:
    return uuid.uuid4().hex[:8]


def seed(db, reset: bool = False) -> bool:
    """Returns True if demo data was added."""
    if reset:
        for name in SEED_COLLECTIONS:
            db[name].delete_many({"role": {"$ne": "HR"}} if name == "users" else {})
    if db.users.find_one({"email": MANAGERS[0][1]}):
        return False

    t0 = now()
    day = timedelta(days=1)
    pw = hash_password(DEMO_PASSWORD)
    hr = db.users.find_one({"role": "HR"})
    hr_id = str(hr["_id"]) if hr else None

    def user(name, email, role, track=None, start_offset=-30):
        doc = {
            "name": name, "name_key": name_key(name), "email": email, "role": role, "status": "ACTIVE",
            "track": track, "phone": None, "start_date": (t0 + start_offset * day).date().isoformat(),
            "password_hash": pw, "must_change_password": False, "token_version": 0,
            "created_at": t0 + start_offset * day, "created_by": hr_id,
        }
        return str(db.users.insert_one(doc).inserted_id)

    maya = user(*MANAGERS[0], "MANAGER")
    omar = user(*MANAGERS[1], "MANAGER")
    ids = {email: user(name, email, "TRAINEE", track, -21 if cohort else -10)
           for name, email, track, cohort in TRAINEES}

    def cohort(name, desc, manager, members, start, end):
        doc = {"name": name, "name_key": name_key(name), "description": desc, "manager_id": manager,
               "trainee_ids": [ids[m] for m in members], "start_date": (t0 + start * day).date().isoformat(),
               "end_date": (t0 + end * day).date().isoformat(), "created_at": t0 - 22 * day,
               "created_by": manager}
        return str(db.cohorts.insert_one(doc).inserted_id)

    a_members = [t[1] for t in TRAINEES if t[3] == "Cloud Cohort A"]
    b_members = [t[1] for t in TRAINEES if t[3] == "Data Cohort B"]
    cohort_a = cohort("Cloud Cohort A", "Full stack on AWS: React, FastAPI, Lambda, S3.", maya, a_members, -21, 35)
    cohort_b = cohort("Data Cohort B", "Python, SQL, Spark and Databricks.", omar, b_members, -14, 42)

    def d(offset):
        return (t0 + offset * day).date().isoformat()

    def plan(title, desc, a_type, a_id, tasks, owner, created_offset):
        doc = {"title": title, "description": desc, "assignee_type": a_type, "assignee_id": a_id,
               "tasks": [{"id": _tid(), "title": t, "due_date": d(off)} for t, off in tasks],
               "status": "ACTIVE", "created_by": owner, "created_at": t0 + created_offset * day}
        doc["_id"] = db.plans.insert_one(doc).inserted_id
        return doc

    p_aws = plan("AWS Fundamentals", "Core services you will use in every project.", "COHORT", cohort_a,
                 [("IAM users, roles and policies", -12), ("S3 static website", -8), ("Lambda + API Gateway", -3),
                  ("MongoDB Atlas connection", 4), ("Deploy the Notice Board", 11)], maya, -20)
    p_react = plan("React Basics", "Components, props, state and fetching data.", "COHORT", cohort_a,
                   [("Components and props", -10), ("State and events", -5), ("Fetch from an API", 3)], maya, -18)
    p_sql = plan("SQL and Data Modeling", "From SELECT to window functions.", "COHORT", cohort_b,
                 [("Joins and aggregates", -9), ("Window functions", -2), ("Model the trainee data", 6)], omar, -13)
    p_spark = plan("Spark on Databricks", "DataFrames, Delta tables and jobs.", "COHORT", cohort_b,
                   [("DataFrame basics", 2), ("Delta tables", 9), ("Scheduled job", 16)], omar, -6)
    p_sec = plan("Security Solo Track", "One-to-one track for the security role.", "TRAINEE", ids["jade@noticeboard.dev"],
                 [("OWASP Top 10 notes", -6), ("Threat model the Notice Board", 1), ("CMMC Level 1 checklist", 8)],
                 maya, -9)

    def report(email, p, task_index, status, summary, days_ago, blockers="", hours=None, feedback=None):
        task = p["tasks"][task_index] if task_index is not None else None
        db.reports.insert_one({
            "trainee_id": ids[email], "plan_id": str(p["_id"]), "task_id": task["id"] if task else None,
            "status": status, "summary": summary, "blockers": blockers, "hours": hours,
            "feedback": feedback, "reviewed": bool(feedback) or days_ago >= 4,
            "created_at": t0 - days_ago * day - timedelta(hours=days_ago % 5),
        })

    def fb(text, by, by_name, days_ago):
        return {"text": text, "by": by, "by_name": by_name, "at": t0 - days_ago * day}

    # Ana: on track, almost done
    for i, ago in [(0, 13), (1, 9), (2, 4)]:
        report("ana@noticeboard.dev", p_aws, i, "DONE", f"Finished: {p_aws['tasks'][i]['title']}.", ago, hours=6,
               feedback=fb("Nice work, keep it up.", maya, "Maya Patel", ago - 1) if i == 0 else None)
    for i, ago in [(0, 11), (1, 6)]:
        report("ana@noticeboard.dev", p_react, i, "DONE", "Done and pushed to GitHub.", ago, hours=4)
    report("ana@noticeboard.dev", p_aws, 3, "IN_PROGRESS", "Cluster created, testing the connection string.", 1, hours=2)
    # Ben: blocked
    report("ben@noticeboard.dev", p_aws, 0, "DONE", "IAM roles done.", 12, hours=5)
    report("ben@noticeboard.dev", p_aws, 1, "DONE", "Bucket website works.", 7, hours=3)
    report("ben@noticeboard.dev", p_react, 0, "DONE", "Components done.", 9, hours=3)
    report("ben@noticeboard.dev", p_aws, 2, "BLOCKED", "Lambda returns 502 from API Gateway.", 0,
           blockers="pymongo layer import error on Lambda, tried two layer ARNs.", hours=4)
    # Chloe: behind (overdue tasks, still reporting)
    report("chloe@noticeboard.dev", p_aws, 0, "DONE", "IAM done.", 10, hours=6)
    report("chloe@noticeboard.dev", p_react, None, "IN_PROGRESS", "Catching up on React after being sick.", 2, hours=3)
    # David: not reporting (last report 12 days ago)
    report("david@noticeboard.dev", p_aws, 0, "IN_PROGRESS", "Started IAM.", 12, hours=2)
    # Elena: complete on React, on track on AWS
    for i, ago in [(0, 12), (1, 8), (2, 5)]:
        report("elena@noticeboard.dev", p_aws, i, "DONE", "Done.", ago, hours=5)
    for i, ago in [(0, 10), (1, 5), (2, 2)]:
        report("elena@noticeboard.dev", p_react, i, "DONE", "Done.", ago, hours=3)
    # Data cohort
    report("farah@noticeboard.dev", p_sql, 0, "DONE", "Joins practice set complete.", 8, hours=5,
           feedback=fb("Great queries. Try the bonus set too.", omar, "Omar Reyes", 7))
    report("farah@noticeboard.dev", p_sql, 1, "DONE", "Window functions done.", 3, hours=4)
    report("farah@noticeboard.dev", p_spark, None, "IN_PROGRESS", "Reading the Databricks intro.", 1, hours=2)
    report("george@noticeboard.dev", p_sql, 0, "DONE", "Joins done.", 6, hours=4)
    report("george@noticeboard.dev", p_sql, 1, "IN_PROGRESS", "Stuck on ROW_NUMBER vs RANK, reading docs.", 1, hours=2)
    report("hana@noticeboard.dev", p_sql, 0, "BLOCKED", "Can't connect to the practice database.", 3,
           blockers="VPN blocks port 5432 at home.", hours=1)
    # Ivan: no reports at all (plan assigned 13 days ago) -> not reporting
    # Jade: solo track
    report("jade@noticeboard.dev", p_sec, 0, "DONE", "OWASP notes in my repo.", 5, hours=6)
    report("jade@noticeboard.dev", p_sec, 1, "IN_PROGRESS", "Drawing the data flow diagram.", 0, hours=2)

    def notice(title, body, priority, a_type, a_id, author, days_ago, pinned=False, readers=()):
        db.notices.insert_one({
            "title": title, "body": body, "priority": priority, "audience_type": a_type, "audience_id": a_id,
            "pinned": pinned, "read_by": [ids[r] for r in readers], "created_by": author,
            "created_at": t0 - days_ago * day,
        })

    notice("Welcome to the new Notice Board",
           "All training updates now live here instead of chat and email. Submit your progress reports every week.",
           "IMPORTANT", "ALL", None, hr_id or maya, 14, pinned=True,
           readers=[t[1] for t in TRAINEES[:8]])
    notice("Friday demo day", "Each cohort demos their app this Friday at 3 PM. Keep it to 5 minutes.",
           "NORMAL", "COHORT", cohort_a, maya, 2, readers=["ana@noticeboard.dev", "elena@noticeboard.dev"])
    notice("AWS lab accounts reset tonight", "Save your work. Lab accounts reset at 11 PM.", "URGENT", "COHORT",
           cohort_a, maya, 0)
    notice("Databricks workspace access", "Your workspace invites went out. Check your email and accept today.",
           "IMPORTANT", "COHORT", cohort_b, omar, 1, readers=["farah@noticeboard.dev"])

    def notify(email_or_id, type_, title, days_ago, read=False):
        uid = ids.get(email_or_id, email_or_id)
        db.notifications.insert_one({"user_id": uid, "type": type_, "title": title, "message": "", "link": "",
                                     "read": read, "created_at": t0 - days_ago * day})

    notify(maya, "BLOCKED", "Ben Carter is blocked on 'Lambda + API Gateway'", 0)
    notify(maya, "REPORT", "Ana Lopez sent a progress report on 'MongoDB Atlas connection'", 1)
    notify(omar, "BLOCKED", "Hana Sato is blocked on 'Joins and aggregates'", 3)
    notify("ana@noticeboard.dev", "NOTICE", "Urgent notice: AWS lab accounts reset tonight", 0)
    notify("ana@noticeboard.dev", "FEEDBACK", "Maya Patel replied to your report", 12, read=True)
    return True


if __name__ == "__main__":
    from db import ensure_indexes, get_db
    from dependencies import get_container

    database = get_db()
    ensure_indexes(database)
    get_container().auth.bootstrap_hr()
    added = seed(database, reset="--reset" in sys.argv)
    print("Demo data added." if added else "Demo data already there (use --reset to start over).")
