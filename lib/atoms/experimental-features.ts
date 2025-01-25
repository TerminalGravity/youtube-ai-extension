import { atomWithPlasmoStorage } from "./atom-with-plasmo-storage"

export const experimentalFeaturesAtom = atomWithPlasmoStorage<Record<string, boolean>>(
  "experimentalFeatures",
  {
    "o1-mini": false,
    "persona-prompts": false
  }
) 