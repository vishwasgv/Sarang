import {
  listProjects, getProject, createProject, updateProject, deleteProject,
  listProjectTasks, createProjectTask, updateProjectTask, deleteProjectTask
} from '../../services/project.service'
import { requirePermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'

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
    return createProject(payload as Parameters<typeof createProject>[0], getCurrentSession()?.userId)
  })

  handle('projects:update', async (payload) => {
    const deny = await requirePermission('sales.manage'); if (deny) return deny
    return updateProject(payload as Parameters<typeof updateProject>[0], getCurrentSession()?.userId)
  })

  handle('projects:delete', async (payload) => {
    const deny = await requirePermission('sales.manage'); if (deny) return deny
    const p = payload as { id: string }
    return deleteProject(p.id, getCurrentSession()?.userId)
  })

  // Tasks
  handle('projects:tasks:list', async (payload) => {
    const deny = await requirePermission('sales.view'); if (deny) return deny
    const p = payload as { projectId: string }
    return listProjectTasks(p.projectId)
  })

  handle('projects:tasks:create', async (payload) => {
    const deny = await requirePermission('sales.manage'); if (deny) return deny
    return createProjectTask(payload as Parameters<typeof createProjectTask>[0], getCurrentSession()?.userId)
  })

  handle('projects:tasks:update', async (payload) => {
    const deny = await requirePermission('sales.manage'); if (deny) return deny
    return updateProjectTask(payload as Parameters<typeof updateProjectTask>[0], getCurrentSession()?.userId)
  })

  handle('projects:tasks:delete', async (payload) => {
    const deny = await requirePermission('sales.manage'); if (deny) return deny
    const p = payload as { id: string }
    return deleteProjectTask(p.id, getCurrentSession()?.userId)
  })
}
