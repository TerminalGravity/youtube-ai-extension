export const isFeatureEnabled = (feature: string, userId: string) => {
  const hash = simpleHash(userId)
  return {
    'o1-mini': hash % 100 < 10, // 10% rollout
    'personas': hash % 100 < 30 // 30% rollout
  }[feature]
} 