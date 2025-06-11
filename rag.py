import os
from groq import Groq
from langchain.schema import Document
from langchain_community.vectorstores import FAISS
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_huggingface import HuggingFaceEmbeddings
import language_tool_python
import json

class RAGPipeline:
    def __init__(
        self,
        json_path: str,
        faiss_path: str,
        embedding_model: str = "sentence-transformers/all-MiniLM-L6-v2",
        groq_model: str = "mistral-saba-24b"
    ):
        self.embedder = HuggingFaceEmbeddings(model_name=embedding_model)

        if os.path.exists(faiss_path):
            print("[INFO] Chargement de la base FAISS existante")
            self.db = FAISS.load_local(faiss_path, self.embedder, allow_dangerous_deserialization=True)
        else:
            print("[INFO] Création de la base FAISS à partir du JSON")
            with open(json_path, "r", encoding="utf-8") as f:
                data = json.load(f)

            documents = [
                Document(page_content=entry.get("content") or entry.get("text") or "")
                for entry in data if (entry.get("content") or entry.get("text"))
            ]

            print(f"[INFO] Nombre de documents chargés depuis JSON : {len(documents)}")
            splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
            chunks = splitter.split_documents(documents)
            print(f"[INFO] Nombre de chunks créés : {len(chunks)}")

            self.db = FAISS.from_documents(chunks, self.embedder)
            self.db.save_local(faiss_path)
            print("[INFO] Base FAISS sauvegardée localement")

        self.retriever = self.db.as_retriever(search_kwargs={"k": 5})

        self.client = Groq()
        self.groq_model = groq_model
        self.language_tool = language_tool_python.LanguageTool('fr')

    def improve_text(self, text: str) -> str:
        matches = self.language_tool.check(text)
        return language_tool_python.utils.correct(text, matches)

    def truncate_context(self, context: str, max_chars: int = 2000) -> str:
        return context[:max_chars]

    def call_groq(self, prompt: str) -> str:
        completion = self.client.chat.completions.create(
            model=self.groq_model,
            messages=[
                {"role": "system", "content": "Tu es un assistant expert en droit spécialisé en Junior-Entreprise."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.0,
            max_tokens=1024
        )
        return completion.choices[0].message.content.strip()

    def answer_question(self, question: str) -> str:
        try:
            docs = self.retriever.invoke(question)
        except AttributeError:
            docs = self.retriever.get_relevant_documents(question)

        if not docs:
            return "Désolé, je n'ai trouvé aucun extrait pertinent dans le document."

        context = "\n\n".join(doc.page_content for doc in docs)
        context = self.truncate_context(context)

        print("[DEBUG] Prompt envoyé (500 premiers caractères) :")
        prompt = (
            "En te basant uniquement sur les informations suivantes, réponds précisément à la question.\n"
            f"Contexte :\n{context}\n\n"
            f"Question : {question}\nRéponse :"
        )
        print(prompt[:500])

        result = self.call_groq(prompt)

        print("\n[DEBUG] Réponse brute générée :")
        print(result)

        if result.endswith(("afin de", "pour", "et", "de", "ou", ",")):
            print("⚠️ Réponse possiblement incomplète. Vérifie la taille du contexte ou la formulation du prompt.")

        improved = self.improve_text(result)
        return improved

if __name__ == "__main__":
    rag = RAGPipeline(
        json_path="data/data.json",
        faiss_path="db/faiss_index",
        groq_model="mistral-saba-24b"
    )

    question = "Quelles sont les grandes lois ou règles encadrant les Junior-Entreprises ?"
    answer = rag.answer_question(question)
    print("\nRéponse générée améliorée :\n", answer)
