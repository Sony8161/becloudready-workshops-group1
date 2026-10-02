"""Turn Mongo documents into JSON-friendly dicts (ObjectId -> str, never leak hashes)."""
from datetime import date, datetime, timezone

from bson import ObjectId
from bson.errors import InvalidId

from errors import NotFound


def oid(value: str, what: str = "Item") -> ObjectId:
    """Parse an id from the URL/body; a bad id is a 404, not a 500."""
    try:
        return ObjectId(value)
    except (InvalidId, TypeError):
        raise NotFound(f"{what} not found")


def now() -> datetime:
    return datetime.now(timezone.utc)


def today_str() -> str:
    return now().date().isoformat()


def date_str(d) -> str | None:
    if d is None:
        return None
    if isinstance(d, (date, datetime)):
        return d.isoformat()[:10]
    return str(d)


def iso(dt) -> str | None:
    if dt is None:
        return None
    if isinstance(dt, datetime):
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.isoformat()
    return str(dt)


def clean(doc: dict | None) -> dict | None:
    """Generic: _id -> id, ObjectIds and datetimes -> strings, drop secrets."""
    if doc is None:
        return None
    out = {}
    for k, v in doc.items():
        if k in ("password_hash", "token_version", "name_key"):
            continue
        key = "id" if k == "_id" else k
        out[key] = _value(v)
    return out


def _value(v):
    if isinstance(v, ObjectId):
        return str(v)
    if isinstance(v, datetime):
        return iso(v)
    if isinstance(v, list):
        return [_value(x) for x in v]
    if isinstance(v, dict):
        return {k: _value(x) for k, x in v.items()}
    return v
