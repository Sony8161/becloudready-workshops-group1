"""Tests run against the in-memory mongomock database. Run from backend/:  python -m pytest -q"""
import os
import sys

os.environ["MONGODB_URI"] = "mongomock://"
os.environ["MONGODB_DB"] = "noticeboard_test"
os.environ["SEED_DEMO"] = "false"
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

import main  # noqa: E402
from controllers import auth_controller  # noqa: E402
from db import get_db  # noqa: E402


@pytest.fixture()
def client():
    db = get_db()
    for name in db.list_collection_names():
        db[name].delete_many({})
    auth_controller._attempts.clear()
    main._ready = False
    with TestClient(main.app) as c:
        yield c


def login(client, email, password):
    r = client.post("/api/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.fixture()
def hr(client):
    return login(client, "hr@noticeboard.dev", "hrAdmin123")


def make_user(client, hr_headers, name, email, role="TRAINEE", **extra):
    """Create a user as HR, then set a real password so they can use the API."""
    r = client.post("/api/users", json={"name": name, "email": email, "role": role, **extra}, headers=hr_headers)
    assert r.status_code == 201, r.text
    temp = r.json()["temporary_password"]
    h = login(client, email, temp)
    r2 = client.post("/api/auth/change-password", json={"current_password": temp, "new_password": "Passw0rd1"},
                     headers=h)
    assert r2.status_code == 200, r2.text
    return r.json()["user"]["id"], {"Authorization": f"Bearer {r2.json()['access_token']}"}
