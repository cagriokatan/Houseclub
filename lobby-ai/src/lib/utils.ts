import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { Department, Role } from '@prisma/client'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const DEPARTMENT_LABELS: Record<Department, string> = {
  MEDYA_ILISKILERI: 'Medya İlişkileri',
  MUSTERI_ILISKILERI: 'Müşteri İlişkileri',
  ETKINLIK: 'Etkinlik',
  RAPORLAMA: 'Raporlama',
}

export const DEPARTMENT_ICONS: Record<Department, string> = {
  MEDYA_ILISKILERI: '📰',
  MUSTERI_ILISKILERI: '🤝',
  ETKINLIK: '🎪',
  RAPORLAMA: '📊',
}

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: 'Yönetici',
  COORDINATOR: 'Koordinatör',
  USER: 'Kullanıcı',
}

export const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Taslak',
  IN_REVIEW: 'İncelemede',
  APPROVED: 'Onaylandı',
  EXPORTED: 'Dışa Aktarıldı',
}

export const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  IN_REVIEW: 'bg-yellow-100 text-yellow-700',
  APPROVED: 'bg-green-100 text-green-700',
  EXPORTED: 'bg-blue-100 text-blue-700',
}

export function formatDate(date: Date | string): string {
  const d = new Date(date)
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(d)
}

export function formatDateTime(date: Date | string): string {
  const d = new Date(date)
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

export function formatRelativeTime(date: Date | string): string {
  const d = new Date(date)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)

  if (diffSec < 60) return 'Az önce'
  if (diffMin < 60) return `${diffMin} dakika önce`
  if (diffHour < 24) return `${diffHour} saat önce`
  if (diffDay < 7) return `${diffDay} gün önce`
  return formatDate(d)
}

export function formatCost(cost: number): string {
  return `$${cost.toFixed(4)}`
}

export function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}K`
  return tokens.toString()
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str
  return str.slice(0, length) + '...'
}

export function getDepartmentPath(department: Department): string {
  const paths: Record<Department, string> = {
    MEDYA_ILISKILERI: '/medya',
    MUSTERI_ILISKILERI: '/musteri',
    ETKINLIK: '/etkinlik',
    RAPORLAMA: '/raporlama',
  }
  return paths[department]
}
