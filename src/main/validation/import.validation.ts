import { z } from 'zod'

export const ImportModuleSchema = z.enum(['products', 'customers', 'suppliers', 'inventory', 'openingBalances'])

export const ParseFileSchema = z.object({
  module: ImportModuleSchema,
})

export const ParseDroppedFileSchema = z.object({
  module: ImportModuleSchema,
  filePath: z.string().min(1, 'filePath is required'),
})

export const ValidatePreviewSchema = z.object({
  sessionId: z.string().min(1, 'sessionId is required'),
  mapping: z.record(z.string(), z.string()),
  module: ImportModuleSchema,
})

export const ExecuteImportSchema = z.object({
  sessionId: z.string().min(1, 'sessionId is required'),
  mapping: z.record(z.string(), z.string()),
  module: ImportModuleSchema,
})

export const DownloadTemplateSchema = z.object({
  module: ImportModuleSchema,
})

export const GetModuleFieldsSchema = z.object({
  module: ImportModuleSchema,
})

export type ParseFilePayload = z.infer<typeof ParseFileSchema>
export type ParseDroppedFilePayload = z.infer<typeof ParseDroppedFileSchema>
export type ValidatePreviewPayload = z.infer<typeof ValidatePreviewSchema>
export type ExecuteImportPayload = z.infer<typeof ExecuteImportSchema>
