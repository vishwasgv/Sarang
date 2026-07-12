import { z } from 'zod'

export const SetBackupDestinationSchema = z.object({
  path: z.string().max(1000).nullable().optional(),
})

export const BackupIdSchema = z.object({
  id: z.string().min(1, 'Backup ID is required'),
})

export const ValidateBackupSchema = z.object({
  backupId: z.string().min(1, 'Backup ID is required'),
})

export const RestoreBackupSchema = z.object({
  backupId: z.string().min(1, 'Backup ID is required'),
})

export type SetBackupDestinationPayload = z.infer<typeof SetBackupDestinationSchema>
