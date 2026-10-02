"""Quick check that we can reach MongoDB Atlas. Run: python test_mongo.py"""
import os

from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv()                          # reads backend/.env into environment variables
uri = os.environ["MONGODB_URI"]

client = MongoClient(uri, serverSelectionTimeoutMS=10000)
try:
    client.admin.command("ping")
    print("Connected successfully")
except Exception as e:
    print("Connection failed:", e)
finally:
    client.close()
