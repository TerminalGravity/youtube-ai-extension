import { openAIKeyAtom } from "@/lib/atoms/openai"
import { models, prompts, type Model, type Prompt } from "@/lib/constants"
import { useAtomValue } from "jotai"
import * as React from "react"

import { usePort } from "@plasmohq/messaging/hook"

import { useExtension } from "./extension-context"
import { experimentalFeaturesAtom } from "@/lib/atoms/experimental-features"
import { FEATURES } from "@/lib/feature-flags"

interface SummaryContext {
  summaryModel: Model
  setSummaryModel: (model: Model) => void
  summaryPrompt: Prompt
  setSummaryPrompt: (prompt: Prompt) => void
  summaryContent: string | null
  setSummaryContent: (content: string | null) => void
  summaryIsError: boolean
  setSummaryIsError: (isError: boolean) => void
  summaryIsGenerating: boolean
  setSummaryIsGenerating: (isGenerating: boolean) => void
  generateSummary: (e: any) => void
}

const SummaryContext = React.createContext<SummaryContext | undefined>(undefined)

export function useSummary() {
  const context = React.useContext(SummaryContext)
  if (!context) {
    throw new Error("useSummary must be used within a SummaryProvider")
  }
  return context
}

interface SummaryProviderProps {
  children: React.ReactNode
}

export function SummaryProvider({ children }: SummaryProviderProps) {
  const port = usePort("completion")
  const openAIKey = useAtomValue(openAIKeyAtom)
  const enableExperimental = useAtomValue(experimentalFeaturesAtom)

  const [summaryModel, setSummaryModel] = React.useState<Model>(models[0])
  const [summaryPrompt, setSummaryPrompt] = React.useState<Prompt>(prompts[0])
  const [summaryContent, setSummaryContent] = React.useState<string | null>(null)
  const [summaryIsError, setSummaryIsError] = React.useState<boolean>(false)
  const [summaryIsGenerating, setSummaryIsGenerating] = React.useState<boolean>(false)

  const { extensionData, extensionLoading } = useExtension()

  // functions to be used in the context

  const MAX_CONTEXT_LENGTH = 4000; // tokens
  const summarizeContext = (text: string) => {
    if (text.length > MAX_CONTEXT_LENGTH) {
      return text.slice(0, MAX_CONTEXT_LENGTH) + 
        '\n[Context truncated. Full analysis available in detailed report]';
    }
    return text;
  };

  const generateSummary = async (e) => {
    e?.preventDefault()
    console.log("[Summary] Generating summary with model:", summaryModel.value)
    try {
      if(FEATURES.O1_MODEL.enabled && summaryModel.value === "o1-mini") {
        await generateAnalyticSummary()
      } else {
        await generateLegacySummary()
      }
    } catch (error) {
      console.error("[Summary] Generation failed:", error)
      setSummaryIsError(true)
      setSummaryIsGenerating(false)
      setSummaryContent(`Error: ${error.message}`)
    }
  }

  async function generateAnalyticSummary() {
    console.log("[Summary] Generating analytic summary")
    
    if (summaryContent !== null) {
      setSummaryContent(null)
    }

    if (!extensionData?.transcript) {
      const error = "No transcript available"
      console.error("[Summary]", error)
      setSummaryIsError(true)
      setSummaryContent(`Error: ${error}`)
      return
    }

    setSummaryIsGenerating(true)
    setSummaryIsError(false)

    const transcriptText = extensionData.transcript.events
      .filter((x: { segs: any }) => x.segs)
      .map((x: { segs: any[] }) => x.segs.map((y: { utf8: any }) => y.utf8).join(" "))
      .join(" ")
      .replace(/[\u200B-\u200D\uFEFF]/g, "")
      .replace(/\s+/g, " ");

    try {
      console.log("[Summary] Sending analytic summary request")
      port.send({
        prompt: summaryPrompt.content,
        model: "o1-mini",
        context: {
          ...extensionData,
          openAIKey
        }
      })
    } catch (error) {
      console.error("[Summary] Failed to send analytic summary request:", error)
      setSummaryIsError(true)
      setSummaryIsGenerating(false)
      setSummaryContent(`Error: ${error.message}`)
    }
  }

  async function generateLegacySummary() {
    console.log("Function That Generates Summary Called")

    if (summaryContent !== null) {
      setSummaryContent(null)
    }

    if (!extensionData?.transcript) {
      setSummaryIsError(true)
      return
    }

    setSummaryIsGenerating(true)
    setSummaryIsError(false)

    const transcriptText = extensionData.transcript.events
      .filter((x: { segs: any }) => x.segs)
      .map((x: { segs: any[] }) => x.segs.map((y: { utf8: any }) => y.utf8).join(" "))
      .join(" ")
      .replace(/[\u200B-\u200D\uFEFF]/g, "")
      .replace(/\s+/g, " ");

    const finalPrompt = `${summaryPrompt.content}\n\nTranscript:\n${summarizeContext(transcriptText)}`
    
    try {
      port.send({
        prompt: finalPrompt,
        model: summaryModel.value,
        context: {
          ...extensionData,
          openAIKey
        }
      })
    } catch (error) {
      setSummaryIsError(true)
      setSummaryIsGenerating(false)
    }
  }

  React.useEffect(() => {
    console.log("[Summary] Port data received:", port.data)
    if (!port.data) return;

    if (port.data.error) {
      console.error("[Summary] Error from port:", port.data.error)
      setSummaryIsError(true)
      setSummaryContent(`Error generating summary:\n\n${port.data.error}`)
      setSummaryIsGenerating(false)
      return
    }

    if (port.data.message !== undefined) {
      if (port.data.isEnd) {
        console.log("[Summary] Generation completed")
        setSummaryIsGenerating(false)
        if (port.data.message !== "END") {
          setSummaryContent(port.data.message)
        }
      } else {
        setSummaryContent(port.data.message)
      }
    }
  }, [port.data])

  React.useEffect(() => {
    setSummaryContent(null)
    setSummaryIsGenerating(false)
    setSummaryIsError(false)
  }, [extensionLoading])

  const value = {
    summaryModel,
    setSummaryModel,
    summaryPrompt,
    setSummaryPrompt,
    summaryContent,
    setSummaryContent,
    summaryIsError,
    setSummaryIsError,
    summaryIsGenerating,
    setSummaryIsGenerating,
    generateSummary
  }

  return <SummaryContext.Provider value={value}>{children}</SummaryContext.Provider>
}
