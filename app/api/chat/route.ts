import { openai } from "@ai-sdk/openai"
import { streamText } from "ai"

export const maxDuration = 30

export async function POST(req: Request) {
  const { messages } = await req.json()

  const result = streamText({
    model: openai("gpt-4o"),
    system: `Tu es JuristBot JE, un assistant juridique spécialisé dans les Junior-Entreprises françaises. 
    Tu aides les étudiants et les responsables de Junior-Entreprises avec :
    - La création et les démarches administratives
    - La gestion juridique et réglementaire
    - Le fonctionnement quotidien
    - Les questions de statuts et de gouvernance
    - Les aspects fiscaux et comptables
    - Les relations avec les clients et prestataires
    
    Réponds de manière claire, précise et professionnelle. Cite les textes de référence quand c'est pertinent.
    Si tu n'es pas sûr d'une information, recommande de consulter un professionnel du droit.`,
    messages,
  })

  return result.toDataStreamResponse()
}
