"""MongoDB connection. The only file that knows HOW to reach the database."""
import os
from decimal import Decimal

from bson.codec_options import CodecOptions, TypeCodec, TypeRegistry
from bson.decimal128 import Decimal128
from dotenv import load_dotenv
from pymongo import MongoClient, ReturnDocument
from pymongo.database import Database

load_dotenv()   # reads backend/.env into environment variables


class DecimalCodec(TypeCodec):
    """Mongo stores exact money as Decimal128; Python uses Decimal. Converts both ways,
    so the rest of the app never has to think about it."""
    python_type = Decimal
    bson_type = Decimal128

    def transform_python(self, value: Decimal) -> Decimal128:   # Python -> Mongo
        return Decimal128(value)

    def transform_bson(self, value: Decimal128) -> Decimal:     # Mongo -> Python
        return value.to_decimal()


# tz_aware=True: timestamps come back as UTC-aware datetimes
_options = CodecOptions(type_registry=TypeRegistry([DecimalCodec()]), tz_aware=True)

client = MongoClient(os.environ["MONGODB_URI"])
db: Database = client.get_database(os.getenv("MONGODB_DB", "banking"), codec_options=_options)


def next_id(db: Database, name: str) -> int:
    """Mongo has no AUTO_INCREMENT, so we keep one counter per collection, e.g.
    counters: {"_id": "customers", "seq": 3}. $inc is atomic: two requests never get the same id."""
    counter = db.counters.find_one_and_update(
        {"_id": name}, {"$inc": {"seq": 1}}, upsert=True, return_document=ReturnDocument.AFTER
    )
    return counter["seq"]


def from_doc(model_cls, doc: dict | None):
    """Mongo document -> Pydantic model (or None). Mongo names the id "_id"; our models say "id"."""
    if doc is None:
        return None
    data = dict(doc)
    data["id"] = data.pop("_id")
    return model_cls(**data)
