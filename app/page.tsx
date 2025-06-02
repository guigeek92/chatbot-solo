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

export default function JuristBotPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [status, setStatus] = useState<"ready" | "streaming" | "error">("ready")
  const [isRecording, setIsRecording] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
const [isClient, setIsClient] = useState(false)

useEffect(() => {
  setIsClient(true)
}, [])

const [canRecord, setCanRecord] = useState(false)

useEffect(() => {
  if (typeof window !== "undefined" && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    setCanRecord(true)
  } else {
    console.warn("mediaDevices or getUserMedia is not available.")
  }
}, [])


  const generateId = () =>
    Date.now().toString(36) + Math.random().toString(36).slice(2, 8)

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    if (!input.trim() || status !== "ready") return

    const userMessage: Message = {
      id: generateId(),
      role: "user",
      content: input.trim(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setStatus("streaming")

    try {
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

      setMessages((prev) => [...prev, assistantMessage])
      setStatus("ready")
    } catch (error) {
      console.error("Erreur lors de la récupération de la réponse :", error)
      setStatus("error")
    }
  }
const startRecording = async () => {
  if (!isClient) {
    console.error("Recording not supported: running outside client.")
    return
  }

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    console.error("Recording not supported: mediaDevices or getUserMedia is undefined.")
    return
  }

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
}



  return (
    <div className="flex flex-col h-screen bg-secondary">
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

      {/* Conversation */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full overflow-y-auto px-4 py-6">
          <div className="max-w-4xl mx-auto">
            {messages.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Scale className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-primary mb-2">Commencez votre consultation</h3>
                <p className="text-gray-600 mb-6 max-w-md mx-auto">
                  Décrivez votre situation ou posez directement votre question juridique. Je suis là pour vous aider !
                </p>
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
                        inputRef.current?.focus()
                        setInput(suggestion)
                      }}
                      className="text-left p-3 bg-white border border-gray-200 rounded-lg hover:border-primary/30 hover:bg-primary/5 transition-colors text-sm"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {messages.map((message) => (
                  <MessageBubble key={message.id} message={message} />
                ))}
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
              </>
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
            <Button
              type="button"
              size="icon"
              onClick={isRecording ? stopRecording : startRecording}
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
            >
              <Send className="w-4 h-4" />
            </Button>
          </form>
          <p className="text-xs text-gray-500 mt-2 text-center">
            Vous pouvez aussi parler : votre message sera transcrit automatiquement.
          </p>
        </div>
      </div>
    </div>
  )
}
