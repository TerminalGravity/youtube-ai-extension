import { createLlm } from "@/utils/llm"
import type { ChatCompletionMessageParam, ChatCompletionSystemMessageParam, ChatCompletionUserMessageParam } from "openai/resources"

import type { PlasmoMessaging } from "@plasmohq/messaging"

function extractKeyMoments(transcript: string): string {
  // Simple extraction of first few sentences as key moments
  const sentences = transcript.split(/[.!?]+/).filter(s => s.trim().length > 0)
  const keyMoments = sentences.slice(0, 3).join('. ')
  return keyMoments || 'No key moments identified'
}

// const SYSTEM = "Given the transcript of a YouTube video along with relevant video metadata (such as video title, description), produce contextually relevant content as requested by the user. The output should be engaging and informative."

// Enhanced context template
const CONTEXT_TEMPLATE = `
Video Title: {title}
Video Length: {length}
Published: {date}
Key Moments:
{key_moments}

Transcript Analysis:
{transcript}

Task Requirements:
1. Maintain chain-of-thought reasoning
2. Cross-validate claims with transcript evidence
3. Flag unsupported assertions
4. Provide confidence estimates for key points`

async function createCompletion(model: string, prompt: string, context: any) {
  console.log("[Completion] Starting with model:", model)
  const llm = createLlm(context.openAIKey)

  if (!context?.transcript?.events) {
    console.error("[Completion] No transcript available")
    throw new Error("No transcript available")
  }

  const parsed = context.transcript.events
    .filter((x: { segs: any }) => x.segs)
    .map((x: { segs: any[] }) => x.segs.map((y: { utf8: any }) => y.utf8).join(" "))
    .join(" ")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\s+/g, " ")

  const contextMessage = CONTEXT_TEMPLATE
    .replace('{title}', context.metadata?.title || 'Unknown')
    .replace('{length}', context.metadata?.duration || 'Unknown')
    .replace('{date}', context.metadata?.date || 'Unknown')
    .replace('{key_moments}', extractKeyMoments(parsed))
    .replace('{transcript}', parsed)

  console.log("[Completion] Context and prompt prepared")

  // Different message format for o1-mini vs other models
  const messages: ChatCompletionMessageParam[] = model === "o1-mini" 
    ? [
        // o1-mini doesn't support system messages
        { role: "user", content: `${contextMessage}\n\n${prompt}` } as ChatCompletionUserMessageParam
      ]
    : [
        { role: "system", content: "You are a helpful AI assistant that summarizes video content." } as ChatCompletionSystemMessageParam,
        { role: "user", content: contextMessage } as ChatCompletionUserMessageParam,
        { role: "user", content: prompt } as ChatCompletionUserMessageParam
      ];

  console.log("[Completion] Using messages format:", JSON.stringify(messages, null, 2))

  try {
    return llm.beta.chat.completions.stream({
      messages,
      model,
      stream: true
    })
  } catch (error) {
    console.error("[Completion] OpenAI API error:", error)
    throw error
  }
}

const handler: PlasmoMessaging.PortHandler = async (req, res) => {
  let cumulativeDelta = ""

  const prompt = req.body.prompt
  const model = req.body.model
  const context = req.body.context

  console.log("[Handler] Received request:", { 
    model, 
    promptLength: prompt?.length,
    hasContext: !!context,
    hasTranscript: !!context?.transcript
  })

  if (!context?.openAIKey) {
    console.error("[Handler] Missing OpenAI key")
    res.send({ error: "OpenAI key is required", isEnd: true })
    return
  }

  try {
    const completion = await createCompletion(model, prompt, context)

    completion.on("content", (delta, snapshot) => {
      cumulativeDelta += delta
      res.send({ message: cumulativeDelta, error: null, isEnd: false })
    })

    completion.on("end", () => {
      console.log("[Handler] Completion finished successfully")
      res.send({ message: cumulativeDelta, error: null, isEnd: true })
    })

    completion.on("error", (error) => {
      console.error("[Handler] Stream error:", error)
      res.send({ 
        error: `OpenAI API Error: ${error.message}\nDetails: ${JSON.stringify(error, null, 2)}`, 
        isEnd: true 
      })
    })
  } catch (error) {
    console.error("[Handler] Request error:", error)
    res.send({ 
      error: `Handler Error: ${error.message}\nStack: ${error.stack}`, 
      isEnd: true 
    })
  }
}

export default handler
