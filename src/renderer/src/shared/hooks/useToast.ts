import { useNotificationStore } from '@app/store/notification.store'

export function useToast() {
  const { success, error, warning, info } = useNotificationStore()
  return { success, error, warning, info }
}
