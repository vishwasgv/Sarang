export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
    details?: unknown
  }
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface Permission {
  id: string
  permissionKey: string
  permissionName: string
}

export interface Role {
  id: string
  roleName: string
  description?: string
}

export interface User {
  id: string
  fullName: string
  username: string
  email?: string
  phone?: string
  role: { id: string; name: string }
  permissions?: string[]
  isActive: boolean
  lastLogin?: string
}

export interface BusinessProfile {
  id: string
  businessName: string
  businessType: string
  ownerName?: string
  email?: string
  phone?: string
  address?: string
  city?: string
  state?: string
  country: string
  postalCode?: string
  currencyCode: string
  currencySymbol: string
  taxModel: string
  taxNumber?: string
  upiId?: string
  website?: string
  logoPath?: string
  showLogoOnDashboard?: boolean
  enableDocumentWatermark?: boolean
  timezone: string
  clinicSpecialty?: string | null
}

export type IndustryTemplate = 'RESTAURANT' | 'RETAIL' | 'HARDWARE' | 'DISTRIBUTOR' | 'GENERAL'
