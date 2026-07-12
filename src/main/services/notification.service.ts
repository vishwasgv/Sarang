import { getPrisma } from '../database/db'
import { BrowserWindow } from 'electron'
import type { ApiResponse } from '../ipc/channels'

export async function createNotification(params: {
  title: string
  message: string
  notificationType: 'INFO' | 'WARNING' | 'ERROR' | 'SUCCESS'
}): Promise<void> {
  try {
    const db = getPrisma()
    const notification = await db.notification.create({
      data: {
        title: params.title,
        message: params.message,
        notificationType: params.notificationType
      }
    })
    // R15: Push real-time event to renderer so notification badge updates immediately
    const win = BrowserWindow.getAllWindows()[0]
    win?.webContents.send('notifications:new', { id: notification.id, title: notification.title, notificationType: notification.notificationType })
  } catch {
    // Notification failures must not crash the app
  }
}

export async function getNotifications(): Promise<ApiResponse> {
  try {
    const db = getPrisma()
    const notifications = await db.notification.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50
    })
    return { success: true, data: notifications }
  } catch {
    return { success: false, error: { code: 'SYS-001', message: 'Something unexpected happened. Please try again.' } }
  }
}

export async function getUnreadCount(): Promise<ApiResponse<number>> {
  try {
    const db = getPrisma()
    const count = await db.notification.count({ where: { isRead: false } })
    return { success: true, data: count }
  } catch {
    return { success: true, data: 0 }
  }
}

export async function markRead(id: string): Promise<ApiResponse> {
  try {
    const db = getPrisma()
    await db.notification.update({ where: { id }, data: { isRead: true } })
    return { success: true }
  } catch {
    return { success: false, error: { code: 'SYS-001', message: 'Something unexpected happened. Please try again.' } }
  }
}

export async function markAllRead(): Promise<ApiResponse> {
  try {
    const db = getPrisma()
    await db.notification.updateMany({ data: { isRead: true } })
    return { success: true }
  } catch {
    return { success: false, error: { code: 'SYS-001', message: 'Something unexpected happened. Please try again.' } }
  }
}
