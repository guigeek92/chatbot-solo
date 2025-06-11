from pymongo import MongoClient
from datetime import datetime
import os

client = MongoClient(os.getenv("MONGO_URI"))
db = client["chatbot"]
collection = db["logs"]

def log_interaction(question, answer):
    collection.insert_one({
        "question": question,
        "answer": answer,
        "timestamp": datetime.utcnow()
    })
