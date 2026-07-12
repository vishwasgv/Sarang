import { requirePermission } from '../permission-guard'
import { listStudents, getStudent, createStudent, updateStudent, deleteStudent } from '../../services/student-profile.service'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('student:list', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const payload = (raw ?? {}) as { isActive?: boolean; search?: string }
    return listStudents(payload)
  })

  handle('student:get', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const payload = raw as { id: string }
    return getStudent(payload.id)
  })

  handle('student:create', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const payload = raw as {
      customerName: string; phone?: string; email?: string; address?: string
      rollNumber?: string; classOrGrade: string; schoolName?: string; parentPhone?: string; enrollmentDate?: string
    }
    return createStudent(payload)
  })

  handle('student:update', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const payload = raw as {
      id: string; customerName?: string; phone?: string | null; email?: string | null
      rollNumber?: string | null; classOrGrade?: string; schoolName?: string | null
      parentPhone?: string | null; isActive?: boolean
    }
    return updateStudent(payload)
  })

  handle('student:delete', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const payload = raw as { id: string }
    return deleteStudent(payload.id)
  })
}
