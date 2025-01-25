import OpenAI from "openai"

export const createLlm = (apiKey: string) => {
  if (!apiKey) {
    throw new Error("OpenAI API key is required")
  }

  try {
    return new OpenAI({
      apiKey,
      dangerouslyAllowBrowser: true // Required for browser environment
    })
  } catch (error) {
    console.error("Failed to create OpenAI client:", error)
    throw error
  }
}
