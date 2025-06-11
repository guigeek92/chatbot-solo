from pymongo import MongoClient
from dotenv import load_dotenv
import os

load_dotenv()
client = MongoClient(os.getenv("MONGO_URI"))

# Test
db = client["chatbot"]
collection = db["logs"]
collection.insert_one({"test": "connexion réussie"})

print("✅ Connexion MongoDB réussie et document inséré.")
