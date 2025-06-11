"use client"

import React, { useState, useEffect, useRef } from "react"
import { Send, User, Scale, Mic, MicOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { MessageBubble } from "@/components/message-bubble"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
}

interface Conversation {
  _id: string
  _rev?: string
  messages: Message[]
}

export default function JuristBotPage() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [input, setInput] = useState("")
  const [status, setStatus] = useState<"ready" | "streaming" | "error">("ready")
  const [isRecording, setIsRecording] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [isClient, setIsClient] = useState(false)
  const [db, setDb] = useState<any>(null)

  useEffect(() => {
    setIsClient(true)
    import("pouchdb-browser").then((PouchDBModule) => {
      const dbInstance = new PouchDBModule.default("juristbot-conversations")
      setDb(dbInstance)
    })
  }, [])

  useEffect(() => {
    if (!db) return
    const loadConversations = async () => {
      try {
        const result = await db.allDocs({ include_docs: true, descending: false })
        const loadedConvs = result.rows
          .map((row: any) => row.doc as Conversation)
          .filter((doc) => doc && Array.isArray(doc.messages))
        setConversations(loadedConvs)
        if (loadedConvs.length > 0) setActiveConversationId(loadedConvs[0]._id)
      } catch (err) {
        console.error("Erreur chargement conversations PouchDB :", err)
      }
    }
    loadConversations()
  }, [db])

 useEffect(() => {
  const saved = localStorage.getItem("conversations");
  if (saved) {
    setConversations(JSON.parse(saved));
  }
}, []);



  const generateId = () =>
    Date.now().toString(36) + Math.random().toString(36).slice(2, 8)

  const saveConversation = async (conv: Conversation) => {
    if (!db) return
    try {
      if (conv._rev) {
        await db.put(conv)
      } else {
        await db.put({ ...conv, _id: conv._id })
      }
    } catch (err: any) {
      if (err.status === 409) {
        // conflit, recharger _rev et réessayer
        const fresh = await db.get(conv._id)
        conv._rev = fresh._rev
        await db.put(conv)
      } else {
        console.error("Erreur sauvegarde conversation:", err)
      }
    }
  }

  // Créer une nouvelle conversation vide
  const createNewConversation = async () => {
    const newConv: Conversation = { _id: generateId(), messages: [] }
    const updatedConvs = [...conversations, newConv]
    setConversations(updatedConvs)
    setActiveConversationId(newConv._id)
    setInput("")
    await saveConversation(newConv)
  }
async function deleteConversation(id: string) {
  if (!db) return;

  try {
    // Récupérer le doc à supprimer
    const docToDelete = await db.get(id);
    // Supprimer le doc (avec _rev)
    await db.remove(docToDelete);

    // Mettre à jour l'état local
    setConversations((prev) => {
      const updated = prev.filter((conv) => conv._id !== id);
      return updated;
    });

    // Si conversation active, la désactiver
    if (id === activeConversationId) {
      setActiveConversationId(null);
    }
  } catch (error) {
    console.error("Erreur suppression conversation dans PouchDB :", error);
  }
}




  // Récupérer la conversation active
  const activeConversation = conversations.find((c) => c._id === activeConversationId) || null

  // Soumettre message utilisateur
const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
  e.preventDefault()
  if (!input.trim() || status !== "ready") return

  let activeId = activeConversationId

  // Création automatique de la conversation si aucune active
  if (!activeId) {
    const newConv: Conversation = { _id: generateId(), messages: [] }
    setConversations([newConv])
    setActiveConversationId(newConv._id)
    await saveConversation(newConv)
    activeId = newConv._id
  }

  const userMessage: Message = {
    id: generateId(),
    role: "user",
    content: input.trim(),
  }

  // Mise à jour ou création de la conversation localement
  let updatedConvs = conversations.map((conv) =>
    conv._id === activeId ? { ...conv, messages: [...conv.messages, userMessage] } : conv
  )
  if (!updatedConvs.find((c) => c._id === activeId)) {
    updatedConvs = [...updatedConvs, { _id: activeId, messages: [userMessage] }]
  }

  setConversations(updatedConvs)
  setInput("")
  setStatus("streaming")

  // Sauvegarde dans la base
  const convToSave = updatedConvs.find((c) => c._id === activeId)!
  await saveConversation(convToSave)

  try {
    // Envoi de la requête POST
    const response = await fetch("http://127.0.0.1:8000/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: userMessage.content }),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      throw new Error(`Erreur réseau: ${response.status} ${errorBody}`)
    }

    const data = await response.json()
    const assistantMessage: Message = {
      id: generateId(),
      role: "assistant",
      content: data.answer || "Réponse vide",
    }

    // Ajouter réponse assistant à la conversation
    const updatedConvs2 = updatedConvs.map((conv) =>
      conv._id === activeId ? { ...conv, messages: [...conv.messages, assistantMessage] } : conv
    )
    setConversations(updatedConvs2)
    await saveConversation(updatedConvs2.find((c) => c._id === activeId)!)
    setStatus("ready")
  } catch (error) {
    console.error("Erreur lors de la récupération de la réponse :", error)
    setStatus("error")
  }
}


  return (
    <div className="flex h-screen bg-secondary">
      {/* Sidebar historique des conversations */}
      <aside className="w-72 bg-white border-r border-gray-200 overflow-y-auto p-4 flex flex-col">
        <h2 className="text-lg font-bold mb-4 flex justify-between items-center">
          Historique des conversations
          <Button size="sm" variant="outline" onClick={createNewConversation}>
            + Nouvelle
          </Button>
        </h2>

        {conversations.length === 0 && (
          <p className="text-gray-500">Aucune conversation, créez-en une nouvelle.</p>
        )}

        <ul className="flex-1 overflow-y-auto">
          {conversations.map((conv) => {
            const firstUserMessage = conv.messages.find((m) => m.role === "user")
            const isActive = conv._id === activeConversationId
            return (
        <li
  key={conv._id}
  className={`p-3 mb-2 rounded cursor-pointer flex justify-between items-center ${
    isActive ? "bg-primary/30 font-semibold" : "hover:bg-gray-100"
  }`}
  title={firstUserMessage?.content || "Conversation vide"}
  onClick={() => setActiveConversationId(conv._id)}
>
  <span className="flex-1 truncate">{firstUserMessage ? firstUserMessage.content : <em>Conversation vide</em>}</span>

  <button
    onClick={(e) => {
      e.stopPropagation()
      deleteConversation(conv._id)
    }}
    className="text-red-500 hover:text-red-700 ml-2 flex-shrink-0"
    title="Supprimer la conversation"
  >
    &#10005;
  </button>
</li>



            )
          })}
        </ul>
      </aside>

      {/* Zone principale */}
      <div className="flex flex-col flex-1">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-4 py-4 shadow-sm">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                <Scale className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-primary">JuristBot JE</h1>
                <p className="text-sm text-gray-600">Assistant juridique spécialisé</p>
              </div>
            </div>
            <Button variant="outline" size="sm" className="gap-2">
              <User className="w-4 h-4" />
              Profil
            </Button>
          </div>
        </header>

        {/* Introduction */}
        {!activeConversation || activeConversation.messages.length === 0 ? (
          <div className="bg-white border-b border-gray-200 px-4 py-6">
            <div className="max-w-4xl mx-auto text-center">
              <h2 className="text-lg font-semibold text-primary mb-2">
                Votre expert juridique pour les Junior-Entreprises
              </h2>
              <p className="text-gray-600 max-w-2xl mx-auto">
                Posez vos questions juridiques sur la création, la gestion ou le fonctionnement d'une Junior-Entreprise.
              </p>
            </div>
          </div>
        ) : null}

        {/* Conversation */}
      <div className="flex-1 overflow-hidden">
  <div className="h-full overflow-y-auto px-4 py-6">
    <div className="max-w-4xl mx-auto">

      {/* Si pas de conversation active ou pas de messages, afficher les questions exemples */}
      {(!activeConversation || activeConversation.messages.length === 0) ? (
        <div className="text-center py-12 text-gray-500">
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-primary mb-4">Questions exemples</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl mx-auto">
              {[
                "Comment créer une Junior-Entreprise ?",
                "Quelles sont les obligations comptables ?",
                "Comment rédiger un contrat client ?",
                "Quelle gouvernance adopter ?",
              ].map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => {
                    setInput(suggestion);
                    inputRef.current?.focus();
                  }}
                  className="text-left p-3 bg-white border border-gray-200 rounded-lg hover:border-primary/30 hover:bg-primary/5 transition-colors text-sm"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
          <p>Commencez la conversation en posant une question ou en choisissant un exemple.</p>
        </div>
      ) : (
        <>
          {activeConversation.messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}
        </>
      )}

      {status === "streaming" && (
        <div className="flex gap-3 mb-6">
          <div className="flex-shrink-0 w-8 h-8 bg-primary rounded-full flex items-center justify-center">
            <Scale className="w-4 h-4 text-white" />
          </div>
          <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-md px-4 py-3">
            <div className="flex gap-1">
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100"></div>
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200"></div>
            </div>
          </div>
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>
  </div>
</div>


        {/* Zone de saisie */}
        <div className="bg-white border-t border-gray-200 px-4 py-4">
          <div className="max-w-4xl mx-auto">
            <form onSubmit={onSubmit} className="flex gap-2">
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Posez votre question juridique..."
                className="flex-1 border-gray-300 focus:border-primary focus:ring-primary"
                disabled={status !== "ready"}
              />
              {/* Bouton micro inchangé */}
              <Button
                type="button"
                size="icon"
                onClick={isRecording
                  ? () => {
                      mediaRecorderRef.current?.stop()
                      setIsRecording(false)
                    }
                  : async () => {
                      if (!isClient) return
                      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return
                      try {
                        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
                        const mediaRecorder = new MediaRecorder(stream)
                        mediaRecorderRef.current = mediaRecorder
                        audioChunksRef.current = []

                        mediaRecorder.ondataavailable = (event) => {
                          audioChunksRef.current.push(event.data)
                        }

                        mediaRecorder.onstop = async () => {
                          const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" })
                          const formData = new FormData()
                          formData.append("file", audioBlob, "audio.webm")

                          try {
                            const res = await fetch("http://127.0.0.1:8000/transcribe", {
                              method: "POST",
                              body: formData,
                            })

                            const data = await res.json()
                            if (data.text) {
                              setInput(data.text)
                              onSubmit(new Event("submit") as unknown as React.FormEvent<HTMLFormElement>)
                            }
                          } catch (err) {
                            console.error("Erreur transcription :", err)
                          }
                        }

                        mediaRecorder.start()
                        setIsRecording(true)
                      } catch (err) {
                        console.error("Erreur lors du démarrage de l'enregistrement :", err)
                      }
                    }}
                className={isRecording ? "bg-red-500 hover:bg-red-600" : "bg-primary hover:bg-primary/90"}
                title={isRecording ? "Arrêter l'enregistrement" : "Démarrer un enregistrement vocal"}
              >
                {isRecording ? <MicOff className="w-4 h-4 text-white" /> : <Mic className="w-4 h-4 text-white" />}
              </Button>
              <Button
                type="submit"
                size="icon"
                disabled={!input.trim() || status !== "ready"}
                className="bg-primary hover:bg-primary/90"
                title="Envoyer la question"
              >
                <Send className="w-4 h-4 text-white" />
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

