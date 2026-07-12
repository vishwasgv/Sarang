import { z } from 'zod'

const CellSchema = z.union([z.string(), z.number(), z.null()]).optional()

export const ExportToCsvSchema = z.object({
  filename: z.string().min(1, 'filename is required'),
  headers: z.array(z.string()),
  rows: z.array(z.array(CellSchema)),
})

export const ExportToExcelSchema = z.object({
  filename: z.string().min(1, 'filename is required'),
  sheets: z.array(z.object({
    name: z.string().min(1),
    headers: z.array(z.string()),
    rows: z.array(z.array(CellSchema)),
  })).min(1, 'At least one sheet is required'),
})

export const ExportToPdfSchema = z.object({
  html: z.string().min(1, 'html is required'),
  filename: z.string().min(1, 'filename is required'),
})

export const GenerateReportHtmlSchema = z.object({
  title: z.string().min(1, 'title is required'),
  subtitle: z.string().optional(),
  dateRange: z.string().optional(),
  summaryCards: z.array(z.object({ label: z.string(), value: z.string() })).optional(),
  charts: z.array(z.any()).optional(),
  tables: z.array(z.object({
    heading: z.string().optional(),
    headers: z.array(z.string()),
    rows: z.array(z.array(z.union([z.string(), z.number(), z.null()]))),
  })),
  currencySymbol: z.string().optional(),
  reportPermission: z.string().optional(),
})

export type ExportToCsvPayload = z.infer<typeof ExportToCsvSchema>
export type ExportToExcelPayload = z.infer<typeof ExportToExcelSchema>
export type ExportToPdfPayload = z.infer<typeof ExportToPdfSchema>
export type GenerateReportHtmlPayload = z.infer<typeof GenerateReportHtmlSchema>
