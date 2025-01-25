// For TypeScript in Jest environment
declare const jest: any;

export const mockO1Response = (promptType: string) => {
  const responses = {
    elon: `Innovation breakdown:\n1. First principles...`,
    academic: `Peer Review Summary:\n1. Abstract...`,
    analytic: `Analysis Summary:\n1. Key Points:\n- Main themes identified\n- Supporting evidence\n2. Confidence Level: High\n3. Recommendations...`
  }
  return Promise.resolve(responses[promptType] || responses.analytic)
}

// In test files
jest.mock("@/utils/llm", () => ({
  createLlm: () => ({
    beta: {
      chat: {
        completions: {
          stream: mockO1Response
        }
      }
    }
  })
})) 