import { createLlm } from "@/utils/llm"
import type { ChatCompletionMessageParam, ChatCompletionUserMessageParam } from "openai/resources"

import type { PlasmoMessaging } from "@plasmohq/messaging"

const SYSTEM = `
You are an AI research assistant. Follow these steps:

1. Problem Decomposition: Break questions into sub-problems
2. Evidence Mapping: Link claims to transcript timestamps
3. Counterfactual Analysis: Consider alternative perspectives
4. Uncertainty Calibration: Rate confidence 1-5
5. Synthesis: Integrate findings into coherent answer

Format: 
- Thought Process: [Logical steps]
- Evidence: [Timestamped sources]
- Confidence: [X/5]
- Answer: [Concise response]`;

async function createChatCompletion(
  model: string,
  messages: ChatCompletionMessageParam[],
  context: any
) {
  const llm = createLlm(context.openAIKey)
  console.log("[Chat] Creating completion with model:", model)

  if (!context?.transcript?.events) {
    console.error("[Chat] No transcript available")
    throw new Error("No transcript available")
  }

  const parsed = context.transcript.events
    .filter((x: { segs: any }) => x.segs)
    .map((x: { segs: any[] }) => x.segs.map((y: { utf8: any }) => y.utf8).join(" "))
    .join(" ")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\s+/g, " ")

  // For o1-mini, we need to combine everything into a single message
  if (model === "o1-mini") {
    const lastUserMessage = messages[messages.length - 1]
    const contextInfo = `Video Title: ${context.metadata?.title || 'Unknown'}\nTranscript:\n${parsed}\n\n${SYSTEM}\n\nQuestion: ${lastUserMessage.content}`
    
    console.log("[Chat] Using o1-mini format")
    return llm.beta.chat.completions.stream({
      messages: [
        { 
          role: "user", 
          content: contextInfo 
        } as ChatCompletionUserMessageParam
      ],
      model,
      stream: true
    })
  }

  // For other models, use the standard format
  const SYSTEM_WITH_CONTEXT = SYSTEM.replace("{title}", context.metadata?.title || 'Unknown')
    .replace("{transcript}", parsed)
  
  messages.unshift({ role: "system", content: SYSTEM_WITH_CONTEXT })

  console.log("[Chat] Using standard format")
  return llm.beta.chat.completions.stream({
    messages,
    model: model || "gpt-3.5-turbo",
    stream: true
  })
}

const handler: PlasmoMessaging.PortHandler = async (req, res) => {
  let cumulativeDelta = ""

  const model = req.body.model
  const messages = req.body.messages
  const context = req.body.context

  console.log("[Chat] Request received:", { 
    model, 
    messageCount: messages?.length,
    hasContext: !!context,
    hasTranscript: !!context?.transcript
  })

  if (!context?.openAIKey) {
    console.error("[Chat] Missing OpenAI key")
    res.send({ error: "OpenAI key is required", isEnd: true })
    return
  }

  try {
    const completion = await createChatCompletion(model, messages, context)

    completion.on("content", (delta, snapshot) => {
      cumulativeDelta += delta
      res.send({ message: cumulativeDelta, error: null, isEnd: false })
    })

    completion.on("end", () => {
      console.log("[Chat] Completion finished successfully")
      res.send({ message: cumulativeDelta, error: null, isEnd: true })
    })

    completion.on("error", (error) => {
      console.error("[Chat] Stream error:", error)
      res.send({ 
        error: `OpenAI API Error: ${error.message}\nDetails: ${JSON.stringify(error, null, 2)}`, 
        isEnd: true 
      })
    })
  } catch (error) {
    console.error("[Chat] Request error:", error)
    res.send({ 
      error: `Handler Error: ${error.message}\nStack: ${error.stack}`, 
      isEnd: true 
    })
  }
}

export default handler
