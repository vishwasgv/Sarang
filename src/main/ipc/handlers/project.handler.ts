import {
  listProjects, getProject, createProject, updateProject, deleteProject,
  listProjectTasks, createProjectTask, updateProjectTask, deleteProjectTask
} from '../../services/project.service'
import { requirePermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'
import {
  CreateProjectSchema, UpdateProjectSchema, ProjectIdSchema,
  CreateProjectTaskSchema, UpdateProjectTaskSchema, ProjectTaskIdSchema
} from '../../validation/project.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('projects:list', async (payload) => {
    const deny = await requirePermission('sales.view'); if (deny) return deny
    return listProjects(payload as Parameters<typeof listProjects>[0])
  })

  handle('projects:get', async (payload) => {
    const deny = await requirePermission('sales.view'); if (deny) return deny
    const p = payload as { id: string }
    return getProject(p.id)
  })

  handle('projects:create', async (payload) => {
    const deny = await requirePermission('sales.manage'); if (deny) return deny
    const parsed = CreateProjectSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return createProject(parsed.data, getCurrentSession()?.userId)
  })

  handle('projects:update', async (payload) => {
    const deny = await requirePermission('sales.manage'); if (deny) return deny
    const parsed = UpdateProjectSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return updateProject(parsed.data, getCurrentSession()?.userId)
  })

  handle('projects:delete', async (payload) => {
    const deny = await requirePermission('sales.manage'); if (deny) return deny
    const parsed = ProjectIdSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return deleteProject(parsed.data.id, getCurrentSession()?.userId)
  })

  // Tasks
  handle('projects:tasks:list', async (payload) => {
    const deny = await requirePermission('sales.view'); if (deny) return deny
    const p = payload as { projectId: string }
    return listProjectTasks(p.projectId)
  })

  handle('projects:tasks:create', async (payload) => {
    const deny = await requirePermission('sales.manage'); if (deny) return deny
    const parsed = CreateProjectTaskSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return createProjectTask(parsed.data, getCurrentSession()?.userId)
  })

  handle('projects:tasks:update', async (payload) => {
    const deny = await requirePermission('sales.manage'); if (deny) return deny
    const parsed = UpdateProjectTaskSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return updateProjectTask(parsed.data, getCurrentSession()?.userId)
  })

  handle('projects:tasks:delete', async (payload) => {
    const deny = await requirePermission('sales.manage'); if (deny) return deny
    const parsed = ProjectTaskIdSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return deleteProjectTask(parsed.data.id, getCurrentSession()?.userId)
  })
}
