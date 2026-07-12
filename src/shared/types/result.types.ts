// Shared result type for all service functions
export interface ServiceResult<T = unknown> {
  success: boolean
  data?: T
  error?: { code: string; message: string; details?: unknown }
}

export function ok<T>(data: T): ServiceResult<T> {
  return { success: true, data }
}

export function fail(code: string, message: string, details?: unknown): ServiceResult<never> {
  return { success: false, error: { code, message, details } }
}
