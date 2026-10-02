"""End-to-end API checks for every role."""
from datetime import date, timedelta

from tests.conftest import login, make_user


def _setup(client, hr):
    mgr_id, mgr = make_user(client, hr, "Maya Patel", "maya@test.dev", "MANAGER")
    a_id, a = make_user(client, hr, "Ana Lopez", "ana@test.dev")
    b_id, b = make_user(client, hr, "Ben Carter", "ben@test.dev")
    r = client.post("/api/cohorts", json={"name": "Cohort A"}, headers=mgr)
    assert r.status_code == 201, r.text
    cohort = r.json()
    assert cohort["manager"]["id"] == mgr_id  # a manager creating a cohort leads it
    r = client.post(f"/api/cohorts/{cohort['id']}/members", json={"trainee_ids": [a_id, b_id]}, headers=mgr)
    assert r.status_code == 200 and r.json()["trainee_count"] == 2
    return {"mgr": mgr, "mgr_id": mgr_id, "a": a, "a_id": a_id, "b": b, "b_id": b_id, "cohort": cohort["id"]}


def _plan(client, s, due_offsets=(5, 10)):
    tasks = [{"title": f"Task {i + 1}", "due_date": (date.today() + timedelta(days=o)).isoformat()}
             for i, o in enumerate(due_offsets)]
    r = client.post("/api/plans", json={"title": "AWS Basics", "assignee_type": "COHORT",
                                        "assignee_id": s["cohort"], "tasks": tasks}, headers=s["mgr"])
    assert r.status_code == 201, r.text
    return r.json()


# ---------- auth ----------
def test_health_and_bootstrap_login(client, hr):
    assert client.get("/api/health").json() == {"status": "ok"}
    me = client.get("/api/auth/me", headers=hr).json()
    assert me["role"] == "HR" and "password_hash" not in me


def test_wrong_password_and_no_token(client):
    r = client.post("/api/auth/login", json={"email": "hr@noticeboard.dev", "password": "nope"})
    assert r.status_code == 401 and r.json()["detail"] == "Wrong email or password"
    r = client.post("/api/auth/login", json={"email": "nobody@x.dev", "password": "nope"})
    assert r.json()["detail"] == "Wrong email or password"  # same message, no account probing
    assert client.get("/api/dashboard").status_code == 401


def test_login_rate_limit(client):
    for _ in range(10):
        client.post("/api/auth/login", json={"email": "hr@noticeboard.dev", "password": "bad"})
    r = client.post("/api/auth/login", json={"email": "hr@noticeboard.dev", "password": "hrAdmin123"})
    assert r.status_code == 429


def test_temp_password_must_be_changed(client, hr):
    r = client.post("/api/users", json={"name": "Tom New", "email": "tom@test.dev"}, headers=hr)
    temp = r.json()["temporary_password"]
    h = login(client, "tom@test.dev", temp)
    assert client.get("/api/auth/me", headers=h).json()["must_change_password"] is True
    assert client.get("/api/notices", headers=h).status_code == 403
    r = client.post("/api/auth/change-password", json={"current_password": temp, "new_password": "short"}, headers=h)
    assert r.status_code == 422
    r = client.post("/api/auth/change-password", json={"current_password": temp, "new_password": "Better123"},
                    headers=h)
    assert r.status_code == 200
    new_h = {"Authorization": f"Bearer {r.json()['access_token']}"}
    assert client.get("/api/notices", headers=new_h).status_code == 200
    assert client.get("/api/notices", headers=h).status_code == 401  # old token signed out


# ---------- onboarding / duplicates ----------
def test_duplicate_email_and_name(client, hr):
    make_user(client, hr, "Jane Doe", "jane@test.dev")
    r = client.post("/api/users", json={"name": "Someone", "email": "JANE@test.dev"}, headers=hr)
    assert r.status_code == 409 and r.json()["code"] == "EMAIL_EXISTS"
    r = client.post("/api/users", json={"name": "  jane   DOE ", "email": "jane2@test.dev"}, headers=hr)
    assert r.status_code == 409 and r.json()["code"] == "POSSIBLE_DUPLICATE"
    assert r.json()["matches"][0]["email"] == "jane@test.dev"
    r = client.post("/api/users", json={"name": "Jane Doe", "email": "jane2@test.dev", "force": True}, headers=hr)
    assert r.status_code == 201
    dups = client.get("/api/users/duplicates", headers=hr).json()
    assert len(dups) == 1 and len(dups[0]["people"]) == 2


def test_only_hr_onboards(client, hr):
    s = _setup(client, hr)
    for h in (s["mgr"], s["a"]):
        r = client.post("/api/users", json={"name": "X Y", "email": "x@test.dev"}, headers=h)
        assert r.status_code == 403
    assert client.get("/api/users", headers=s["mgr"]).status_code == 200  # managers can read
    assert client.get("/api/users", headers=s["a"]).status_code == 403


def test_bulk_import_preview_and_create(client, hr):
    make_user(client, hr, "Old Timer", "old@test.dev")
    client.post("/api/cohorts", json={"name": "Data B"}, headers=hr)
    rows = [
        {"name": "New One", "email": "new1@test.dev", "cohort": "data b"},
        {"name": "Old Copy", "email": "OLD@test.dev"},
        {"name": "New Two", "email": "new1@test.dev"},
        {"name": "Old Timer", "email": "other@test.dev"},
        {"name": "", "email": "bad"},
        {"name": "Ghost", "email": "ghost@test.dev", "cohort": "Nope"},
        {"name": "Dated", "email": "dated@test.dev", "start_date": "2026-13-01"},
    ]
    r = client.post("/api/users/import/preview", json={"rows": rows}, headers=hr)
    statuses = [x["status"] for x in r.json()["rows"]]
    assert statuses == ["NEW", "EXISTS", "DUPLICATE_IN_FILE", "POSSIBLE_DUPLICATE", "INVALID", "INVALID", "INVALID"]
    r = client.post("/api/users/import", json={"rows": rows}, headers=hr)
    assert r.status_code == 201
    created = r.json()["created"]
    assert [c["email"] for c in created] == ["new1@test.dev"] and created[0]["temporary_password"]
    assert created[0]["cohort"] == "Data B"
    r = client.post("/api/users/import", json={"rows": rows, "include_possible_duplicates": True}, headers=hr)
    assert [c["email"] for c in r.json()["created"]] == ["other@test.dev"]


def test_deactivate_signs_out_and_blocks_login(client, hr):
    uid, h = make_user(client, hr, "Gone Soon", "gone@test.dev")
    r = client.post(f"/api/users/{uid}/deactivate", headers=hr)
    assert r.json()["status"] == "INACTIVE"
    assert client.get("/api/notices", headers=h).status_code == 401
    r = client.post("/api/auth/login", json={"email": "gone@test.dev", "password": "Passw0rd1"})
    assert r.status_code == 401
    client.post(f"/api/users/{uid}/reactivate", headers=hr)
    login(client, "gone@test.dev", "Passw0rd1")


def test_reset_password(client, hr):
    uid, _ = make_user(client, hr, "Forgetful", "forget@test.dev")
    r = client.post(f"/api/users/{uid}/reset-password", headers=hr)
    temp = r.json()["temporary_password"]
    h = login(client, "forget@test.dev", temp)
    assert client.get("/api/auth/me", headers=h).json()["must_change_password"] is True


def test_bad_ids_are_404(client, hr):
    assert client.get("/api/users/not-an-id", headers=hr).status_code == 404
    assert client.get("/api/cohorts/123", headers=hr).status_code == 404


# ---------- plans, reports, progress ----------
def test_plan_report_feedback_flow(client, hr):
    s = _setup(client, hr)
    plan = _plan(client, s)
    assert plan["trainee_count"] == 2 and plan["task_count"] == 2
    t1, t2 = [t["id"] for t in plan["tasks"]]

    # trainee was notified and sees the plan
    notes = client.get("/api/notifications", headers=s["a"]).json()
    assert any(n["type"] == "PLAN" for n in notes["items"])
    mine = client.get("/api/plans", headers=s["a"]).json()
    assert len(mine) == 1 and mine[0]["my_progress"]["progress"] == 0

    # validation rules
    r = client.post("/api/reports", json={"plan_id": plan["id"], "status": "DONE", "summary": "done"}, headers=s["a"])
    assert r.status_code == 400  # DONE needs a task
    r = client.post("/api/reports", json={"plan_id": plan["id"], "status": "BLOCKED", "summary": "stuck"},
                    headers=s["a"])
    assert r.status_code == 400  # BLOCKED needs blockers
    r = client.post("/api/reports", json={"plan_id": plan["id"], "task_id": "zzz", "summary": "hmm"}, headers=s["a"])
    assert r.status_code == 400
    assert client.post("/api/reports", json={"plan_id": plan["id"], "summary": "hi there"},
                       headers=s["mgr"]).status_code == 403

    r = client.post("/api/reports", json={"plan_id": plan["id"], "task_id": t1, "status": "DONE",
                                          "summary": "Finished task 1", "hours": 3}, headers=s["a"])
    assert r.status_code == 201
    report_id = r.json()["id"]
    assert r.json()["task_title"] == "Task 1"
    mgr_notes = client.get("/api/notifications", headers=s["mgr"]).json()
    assert mgr_notes["unread"] >= 1 and "Ana Lopez finished" in mgr_notes["items"][0]["title"]

    detail = client.get(f"/api/plans/{plan['id']}", headers=s["mgr"]).json()
    ana = next(t for t in detail["trainees"] if t["name"] == "Ana Lopez")
    assert ana["progress"] == 50 and detail["avg_progress"] == 25

    queue = client.get("/api/reports?awaiting_feedback=true", headers=s["mgr"]).json()
    assert [q["id"] for q in queue] == [report_id]
    r = client.post(f"/api/reports/{report_id}/feedback", json={"text": "Great job"}, headers=s["mgr"])
    assert r.json()["feedback"]["by_name"] == "Maya Patel"
    assert client.get("/api/reports?awaiting_feedback=true", headers=s["mgr"]).json() == []
    a_notes = client.get("/api/notifications?unread=true", headers=s["a"]).json()
    assert any(n["type"] == "FEEDBACK" for n in a_notes["items"])
    client.post("/api/notifications/read-all", headers=s["a"])
    assert client.get("/api/notifications", headers=s["a"]).json()["unread"] == 0

    # finishing the last task completes the plan
    client.post("/api/reports", json={"plan_id": plan["id"], "task_id": t2, "status": "DONE", "summary": "All done"},
                headers=s["a"])
    ov = client.get("/api/me/overview", headers=s["a"]).json()
    assert ov["plans"][0]["progress"] == 100 and ov["status"] == "COMPLETE"


def test_trainee_cannot_see_other_plans(client, hr):
    s = _setup(client, hr)
    c_id, c_h = make_user(client, hr, "Carl Solo", "carl@test.dev")
    r = client.post("/api/plans", json={"title": "Solo", "assignee_type": "TRAINEE", "assignee_id": c_id,
                                        "tasks": [{"title": "Only task"}]}, headers=s["mgr"])
    solo = r.json()
    assert client.get(f"/api/plans/{solo['id']}", headers=s["a"]).status_code == 403
    r = client.post("/api/reports", json={"plan_id": solo["id"], "summary": "sneaky"}, headers=s["a"])
    assert r.status_code == 403
    assert client.get(f"/api/plans/{solo['id']}", headers=c_h).status_code == 200


def test_only_managers_write_plans(client, hr):
    s = _setup(client, hr)
    body = {"title": "X plan", "assignee_type": "COHORT", "assignee_id": s["cohort"], "tasks": [{"title": "t one"}]}
    assert client.post("/api/plans", json=body, headers=hr).status_code == 403
    assert client.post("/api/plans", json=body, headers=s["a"]).status_code == 403


def test_plan_edit_keeps_task_ids_and_copy(client, hr):
    s = _setup(client, hr)
    plan = _plan(client, s)
    t1 = plan["tasks"][0]
    r = client.patch(f"/api/plans/{plan['id']}", json={"tasks": [
        {"id": t1["id"], "title": "Task 1 renamed"}, {"title": "Brand new"}]}, headers=s["mgr"])
    tasks = r.json()["tasks"]
    assert tasks[0]["id"] == t1["id"] and tasks[0]["title"] == "Task 1 renamed" and len(tasks) == 2
    r = client.post(f"/api/plans/{plan['id']}/copy", json={"assignee_type": "TRAINEE", "assignee_id": s["a_id"]},
                    headers=s["mgr"])
    assert r.status_code == 201 and r.json()["assignee_name"] == "Ana Lopez"
    assert r.json()["tasks"][0]["id"] != t1["id"]
    client.post(f"/api/plans/{plan['id']}/archive", headers=s["mgr"])
    assert len(client.get("/api/plans", headers=s["a"]).json()) == 1  # only the copy is active


def test_cohort_rules(client, hr):
    s = _setup(client, hr)
    assert client.post("/api/cohorts", json={"name": "cohort a"}, headers=s["mgr"]).status_code == 409
    plan = _plan(client, s)
    assert client.delete(f"/api/cohorts/{s['cohort']}", headers=s["mgr"]).status_code == 409
    client.post(f"/api/plans/{plan['id']}/archive", headers=s["mgr"])
    r = client.post(f"/api/cohorts/{s['cohort']}/members", json={"trainee_ids": [s["mgr_id"]]}, headers=s["mgr"])
    assert r.status_code == 400  # managers can't be cohort members
    r = client.delete(f"/api/cohorts/{s['cohort']}/members/{s['b_id']}", headers=s["mgr"])
    assert r.json()["trainee_count"] == 1
    assert client.delete(f"/api/cohorts/{s['cohort']}", headers=s["mgr"]).status_code == 204
    r = client.patch("/api/cohorts/" + s["cohort"], json={"name": "x y"}, headers=s["mgr"])
    assert r.status_code == 404


# ---------- notices ----------
def test_notice_audience_and_read_tracking(client, hr):
    s = _setup(client, hr)
    o_id, o_h = make_user(client, hr, "Olga Outside", "olga@test.dev")
    r = client.post("/api/notices", json={"title": "Cohort only", "body": "Hello A", "audience_type": "COHORT",
                                          "audience_id": s["cohort"], "priority": "URGENT"}, headers=s["mgr"])
    assert r.status_code == 201 and r.json()["audience_size"] == 2
    nid = r.json()["id"]
    client.post("/api/notices", json={"title": "Everyone", "body": "Hi all"}, headers=hr)

    assert [n["title"] for n in client.get("/api/notices", headers=o_h).json()] == ["Everyone"]
    a_list = client.get("/api/notices", headers=s["a"]).json()
    assert {n["title"] for n in a_list} == {"Everyone", "Cohort only"} and not any(n["read"] for n in a_list)
    assert client.post(f"/api/notices/{nid}/read", headers=o_h).status_code == 403
    client.post(f"/api/notices/{nid}/read", headers=s["a"])
    detail = client.get(f"/api/notices/{nid}", headers=s["mgr"]).json()
    assert detail["read_by"] == ["Ana Lopez"] and detail["not_read_by"] == ["Ben Carter"]
    assert any("Urgent notice" in n["title"] for n in client.get("/api/notifications", headers=s["b"]).json()["items"])
    assert client.post("/api/notices", json={"title": "x x", "body": "y"}, headers=s["a"]).status_code == 403
    r = client.post("/api/notices", json={"title": "Bad", "body": "y", "audience_type": "COHORT"}, headers=hr)
    assert r.status_code == 400
    assert client.delete(f"/api/notices/{nid}", headers=s["mgr"]).status_code == 204


# ---------- dashboard ----------
def test_dashboard_statuses(client, hr):
    s = _setup(client, hr)
    make_user(client, hr, "Una Assigned", "una@test.dev")
    plan = _plan(client, s, due_offsets=(-2, 5))  # task 1 already overdue
    t1 = plan["tasks"][0]["id"]
    client.post("/api/reports", json={"plan_id": plan["id"], "task_id": t1, "status": "DONE", "summary": "done 1"},
                headers=s["a"])
    client.post("/api/reports", json={"plan_id": plan["id"], "status": "BLOCKED", "summary": "stuck here",
                                      "blockers": "no access"}, headers=s["b"])
    d = client.get("/api/dashboard", headers=s["mgr"]).json()
    status = {t["name"]: t["status"] for t in d["trainees"]}
    assert status == {"Ana Lopez": "ON_TRACK", "Ben Carter": "BLOCKED", "Una Assigned": "UNASSIGNED"}
    assert d["summary"]["at_risk"] == 1 and d["summary"]["unassigned"] == 1 and d["summary"]["reports_7d"] == 2
    assert d["summary"]["awaiting_feedback"] == 2 and len(d["activity"]) == 14
    assert d["cohorts"][0]["trainee_count"] == 2 and d["cohorts"][0]["at_risk"] == 1
    scoped = client.get(f"/api/dashboard?cohort_id={s['cohort']}", headers=s["mgr"]).json()
    assert {t["name"] for t in scoped["trainees"]} == {"Ana Lopez", "Ben Carter"}
    assert client.get("/api/dashboard", headers=s["a"]).status_code == 403
    detail = client.get(f"/api/dashboard/trainees/{s['b_id']}", headers=hr).json()
    assert detail["status"] == "BLOCKED" and detail["plans"][0]["state"] == "BLOCKED"


def test_seed_demo_runs(client):
    from db import get_db
    from seed_demo import seed

    assert seed(get_db()) is True
    assert seed(get_db()) is False  # second run does nothing
    h = login(client, "manager@noticeboard.dev", "Demo1234")
    d = client.get("/api/dashboard", headers=h).json()
    assert d["summary"]["active_trainees"] == 12 and d["summary"]["at_risk"] > 0
