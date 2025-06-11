from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from rag import RAGPipeline  # Assure-toi que ce module est bien accessible
import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()

# Config CORS — liste les origines autorisées (changer en prod)
origins = [
        "http://localhost:3000",
    "http://localhost:3001",
    "http://192.168.1.85:3000",
    "http://10.1.57.58:3000", 
    "http://10.1.57.10:3000",
    "http://10.1.57.170:3000", 
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,  # ou ["*"] en dev
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialisation du pipeline RAG avec tes fichiers
rag_pipeline = RAGPipeline(
    json_path="data/data.json",  # ou ton chemin vers un JSON valide
    faiss_path="db/faiss_index"
)


class QuestionRequest(BaseModel):
    question: str

@app.post("/chat")
async def chat(request: QuestionRequest):
    question = request.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Question vide")

    print("[API] Question reçue :", question)

    try:
        answer = rag_pipeline.answer_question(question)
    except Exception as e:
        print("[API] Erreur pipeline RAG :", e)
        raise HTTPException(status_code=500, detail="Erreur serveur lors du traitement")

    print("[API] Réponse envoyée :", answer)
    return {"question": question, "answer": answer}

@app.get("/")
def read_root():
    return {"message": "API RAG en français OK"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
    

