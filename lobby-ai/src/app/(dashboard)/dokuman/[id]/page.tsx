'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Save,
  Download,
  ChevronDown,
  Clock,
  FileText,
  CheckCircle2,
  Loader2,
  Layers,
  User,
} from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { TiptapEditor } from '@/components/editor/TiptapEditor'
import { ChatPanel } from '@/components/chat/ChatPanel'
import { STATUS_LABELS, STATUS_COLORS, DEPARTMENT_LABELS, formatRelativeTime, formatDateTime } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'

interface Document {
  id: string
  title: string
  content: string
  status: string
  department: string
  outputFormat: string
  version: number
  tokenUsage: any
  updatedAt: string
  createdAt: string
  author: { id: string; name: string; email: string }
  client?: { id: string; name: string; sector: string; tone?: string } | null
  template?: { id: string; name: string; category: string } | null
  versions: Array<{
    id: string
    title: string
    version: number
    status: string
    createdAt: string
    author: { name: string }
  }>
  parent?: { id: string; title: string; version: number } | null
}

export default function DocumentEditorPage() {
  const params = useParams()
  const router = useRouter()
  const docId = params.id as string

  const [document, setDocument] = useState<Document | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [error, setError] = useState('')
  const [initData, setInitData] = useState<any>(null)
  const autoSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wordCount = content.replace(/<[^>]*>/g, ' ').split(/\s+/).filter(Boolean).length

  useEffect(() => {
    fetchDocument()

    // Session storage'dan init data'yı oku
    const stored = sessionStorage.getItem(`doc-${docId}-init`)
    if (stored) {
      try {
        setInitData(JSON.parse(stored))
        sessionStorage.removeItem(`doc-${docId}-init`)
      } catch {}
    }
  }, [docId])

  // Otomatik kayıt — 30 saniyede bir
  useEffect(() => {
    if (autoSaveRef.current) clearTimeout(autoSaveRef.current)
    autoSaveRef.current = setTimeout(() => {
      if (document && (title !== document.title || content !== document.content)) {
        saveDocument()
      }
    }, 30000)

    return () => {
      if (autoSaveRef.current) clearTimeout(autoSaveRef.current)
    }
  }, [title, content])

  async function fetchDocument() {
    try {
      const res = await fetch(`/api/documents/${docId}`)
      if (!res.ok) {
        setError('Doküman bulunamadı')
        return
      }
      const data = await res.json()
      setDocument(data.document)
      setTitle(data.document.title)
      setContent(data.document.content)
    } catch {
      setError('Doküman yüklenemedi')
    } finally {
      setIsLoading(false)
    }
  }

  async function saveDocument(showFeedback = false) {
    if (!document) return
    setIsSaving(true)

    try {
      const res = await fetch(`/api/documents/${docId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content }),
      })

      if (res.ok) {
        setLastSaved(new Date())
        const data = await res.json()
        setDocument((prev) => prev ? { ...prev, ...data.document } : null)
      }
    } catch {
      // Sessiz hata
    } finally {
      setIsSaving(false)
    }
  }

  async function updateStatus(status: string) {
    const res = await fetch(`/api/documents/${docId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (res.ok) {
      const data = await res.json()
      setDocument((prev) => prev ? { ...prev, status: data.document.status } : null)
    }
  }

  async function createNewVersion() {
    const res = await fetch('/api/documents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: `${title} (v${(document?.version || 1) + 1})`,
        content,
        department: document?.department,
        clientId: document?.client?.id,
        templateId: document?.template?.id,
        parentId: docId,
        version: (document?.version || 1) + 1,
      }),
    })

    if (res.ok) {
      const data = await res.json()
      router.push(`/dokuman/${data.document.id}`)
    }
  }

  async function exportDocument(format: string) {
    if (format === 'copy') {
      const text = content.replace(/<[^>]*>/g, ' ').trim()
      navigator.clipboard.writeText(text)
      return
    }

    // DOCX export
    if (format === 'docx') {
      const res = await fetch('/api/documents/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: docId, format: 'docx' }),
      })
      if (res.ok) {
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = window.document.createElement('a')
        a.href = url
        a.download = `${title}.docx`
        a.click()
        URL.revokeObjectURL(url)
      }
    }
  }

  const handleContentGenerated = useCallback((html: string) => {
    setContent(html)
  }, [])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-[#E87722]" />
      </div>
    )
  }

  if (error || !document) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <FileText className="w-12 h-12 text-gray-300" />
        <p className="text-gray-500">{error || 'Doküman bulunamadı'}</p>
        <Link href="/">
          <Button variant="outline">Ana Sayfaya Dön</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <Link href={`/${document.department.toLowerCase().replace('_iliskileri', '').replace('_', '')}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Geri
          </Button>
        </Link>

        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="flex-1 border-none shadow-none focus-visible:ring-0 text-base font-semibold text-gray-900 px-2"
          placeholder="Doküman başlığı"
        />

        <div className="flex items-center gap-2 shrink-0">
          {/* Durum */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button>
                <Badge
                  className={`${STATUS_COLORS[document.status]} cursor-pointer hover:opacity-80 flex items-center gap-1`}
                  variant="outline"
                >
                  {STATUS_LABELS[document.status]}
                  <ChevronDown className="w-3 h-3" />
                </Badge>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel className="text-xs">Durumu Değiştir</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {['DRAFT', 'IN_REVIEW', 'APPROVED'].map((s) => (
                <DropdownMenuItem key={s} onClick={() => updateStatus(s)}>
                  <span className={`inline-block w-2 h-2 rounded-full mr-2 ${STATUS_COLORS[s]}`} />
                  {STATUS_LABELS[s]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Kaydet */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => saveDocument(true)}
            disabled={isSaving}
          >
            {isSaving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            Kaydet
          </Button>

          {/* Dışa Aktar */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="default" size="sm">
                <Download className="w-3.5 h-3.5" />
                Dışa Aktar
                <ChevronDown className="w-3.5 h-3.5 ml-0.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => exportDocument('docx')}>
                📄 Word (.docx) olarak indir
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportDocument('copy')}>
                📋 Panoya kopyala (düz metin)
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={createNewVersion}>
                <Layers className="w-4 h-4 mr-2" />
                Yeni Versiyon Oluştur
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Ana içerik */}
      <div className="flex-1 flex overflow-hidden">
        {/* Chat panel */}
        <div className="w-72 border-r border-gray-200 flex flex-col">
          <ChatPanel
            department={document.department}
            clientId={document.client?.id}
            templateId={document.template?.id}
            documentId={docId}
            onContentGenerated={handleContentGenerated}
            initialGenerate={!!initData?.autoGenerate}
            initialPrompt={
              initData?.autoGenerate
                ? `Lütfen bu dokümanı oluştur: ${document.title}`
                : undefined
            }
          />
        </div>

        {/* Editor */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <TiptapEditor
            content={content}
            onChange={setContent}
            placeholder="AI içeriği burada görünecek veya yazmaya başlayın..."
          />
        </div>
      </div>

      {/* Footer */}
      <div className="bg-white border-t border-gray-200 px-4 py-2 flex items-center justify-between text-xs text-gray-400">
        <div className="flex items-center gap-4">
          <span>Versiyon: v{document.version}</span>
          {document.client && <span>Müşteri: {document.client.name}</span>}
          {document.template && <span>Şablon: {document.template.name}</span>}
        </div>
        <div className="flex items-center gap-4">
          <span>{wordCount} kelime</span>
          <div className="flex items-center gap-1">
            <User className="w-3 h-3" />
            {document.author.name}
          </div>
          {lastSaved ? (
            <div className="flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-green-500" />
              {formatRelativeTime(lastSaved)} kaydedildi
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatRelativeTime(document.updatedAt)}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
