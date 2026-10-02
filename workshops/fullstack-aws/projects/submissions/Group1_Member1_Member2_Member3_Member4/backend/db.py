"""One shared MongoDB client (reused across Lambda invocations) plus index setup."""
from functools import lru_cache

from pymongo import ASCENDING, DESCENDING

import config


@lru_cache
def get_db():
    if config.MONGODB_URI.startswith("mongomock://"):
        import mongomock  # dev / tests only

        client = mongomock.MongoClient(tz_aware=True)
    else:
        from pymongo import MongoClient

        client = MongoClient(config.MONGODB_URI, tz_aware=True, serverSelectionTimeoutMS=5000)
    return client[config.MONGODB_DB]


def ensure_indexes(db) -> None:
    db.users.create_index([("email", ASCENDING)], unique=True)
    db.users.create_index([("role", ASCENDING), ("status", ASCENDING)])
    db.cohorts.create_index([("name_key", ASCENDING)], unique=True)
    db.cohorts.create_index([("trainee_ids", ASCENDING)])
    db.plans.create_index([("assignee_type", ASCENDING), ("assignee_id", ASCENDING)])
    db.notices.create_index([("created_at", DESCENDING)])
    db.notifications.create_index([("user_id", ASCENDING), ("created_at", DESCENDING)])
    db.reports.create_index([("trainee_id", ASCENDING), ("created_at", DESCENDING)])
    db.reports.create_index([("plan_id", ASCENDING)])
