import { z } from "zod"

const ModelConfigSchema = z.object({
  value: z.string(),
  label: z.string(),
  content: z.string().optional(),
  icon: z.any().optional()
})

export const validateModels = (models: unknown) => {
  return z.array(ModelConfigSchema).parse(models)
} 