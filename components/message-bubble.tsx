import { cn } from "@/lib/utils"
import { Bot, User } from "lucide-react"

type MessagePart = { type: string; text: string }

interface Message {
  id: string
  role: "user" | "assistant"
  parts: MessagePart[]
}

interface MessageBubbleProps {
  message: Message
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user"

  // Sécurité : si parts n'existe pas ou n'est pas un tableau, on met un tableau vide
const parts =
  Array.isArray(message.parts)
    ? message.parts
    : [{ type: "text", text: (message as any).content || "" }]


  return (
    <div className={cn("flex gap-3 mb-6", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div
          className="flex-shrink-0 w-8 h-8 bg-primary rounded-full flex items-center justify-center"
          aria-label="Assistant"
          role="img"
        >
          <Bot className="w-4 h-4 text-white" />
        </div>
      )}

      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-4 py-3 shadow-sm",
          isUser
            ? "bg-primary text-white rounded-br-md"
            : "bg-white border border-gray-200 rounded-bl-md"
        )}
      >
        {parts.map((part, index) => {
          if (part.type === "text") {
            return (
              <p
                key={`${message.id}-${index}`}
                className={cn(
                  "text-sm leading-relaxed whitespace-pre-wrap",
                  isUser ? "text-white" : "text-gray-800"
                )}
              >
                {part.text}
              </p>
            )
          }
          return null
        })}
      </div>

      {isUser && (
        <div
          className="flex-shrink-0 w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center"
          aria-label="Utilisateur"
          role="img"
        >
          <User className="w-4 h-4 text-gray-600" />
        </div>
      )}
    </div>
  )
}


