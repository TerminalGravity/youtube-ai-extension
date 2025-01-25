export const FEATURES = {
  O1_MODEL: {
    enabled: process.env.ENABLE_O1_FEATURE === "true",
    config: {
      maxContextLength: 16000,
      analyticMode: true
    }
  },
  PERSONA_PROMPTS: {
    enabled: true,
    experimental: ["elon", "academic"]
  }
} 