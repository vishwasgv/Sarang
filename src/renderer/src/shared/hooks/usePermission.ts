import { useAuthStore } from '@app/store/auth.store'

export function usePermission(permissionKey: string): boolean {
  return useAuthStore((s) => s.hasPermission(permissionKey))
}

export function usePermissions(keys: string[]): Record<string, boolean> {
  const permissions = useAuthStore((s) => s.permissions)
  return Object.fromEntries(keys.map((k) => [k, permissions.has(k)]))
}
