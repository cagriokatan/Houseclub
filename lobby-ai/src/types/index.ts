import { Department, Role, DocumentStatus } from '@prisma/client'

export type { Department, Role, DocumentStatus }

export interface UserSession {
  id: string
  email: string
  name: string
  role: string
  department: string
  avatar?: string
}

export interface DocumentWithRelations {
  id: string
  title: string
  content: string
  rawAIOutput?: string | null
  status: DocumentStatus
  department: Department
  outputFormat: string
  version: number
  tokenUsage?: any
  createdAt: Date
  updatedAt: Date
  authorId: string
  author: {
    id: string
    name: string
    email: string
  }
  client?: {
    id: string
    name: string
    sector: string
  } | null
  template?: {
    id: string
    name: string
  } | null
  parentId?: string | null
}

export interface ClientWithStats {
  id: string
  name: string
  sector: string
  description?: string | null
  tone?: string | null
  terminology?: string | null
  avoidTerms?: string | null
  brandGuidelines?: string | null
  keyContacts?: string | null
  isActive: boolean
  createdAt: Date
  _count?: {
    documents: number
  }
}

export interface TemplateWithStats {
  id: string
  name: string
  department: Department
  category: string
  promptBody: string
  variables: string[]
  outputFormat: string
  isActive: boolean
  _count?: {
    documents: number
  }
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp?: Date
}

export interface TokenUsage {
  inputTokens: number
  outputTokens: number
  cost: number
}

export interface DashboardStats {
  totalDocuments: number
  documentsToday: number
  documentsThisWeek: number
  documentsThisMonth: number
  totalTokens: number
  totalCost: number
  activeUsers: number
}
