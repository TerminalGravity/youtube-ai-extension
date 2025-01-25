export const trackLLMPerf = (model: string) => {
  const start = performance.now()
  
  return {
    end: () => {
      const duration = performance.now() - start
      console.log(`[LLM Perf] ${model}: ${duration.toFixed(2)}ms`)
      analytics.track("llm_response", { model, duration })
    }
  }
}

// Usage in summary context
const perf = trackLLMPerf(summaryModel.value)
await generateSummary()
perf.end() 