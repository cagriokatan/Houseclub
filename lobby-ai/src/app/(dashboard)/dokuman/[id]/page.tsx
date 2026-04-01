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
  PanelRight,
  Paperclip,
  Send,
  X,
  Sparkles,
} from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DocumentPreview } from '@/components/document/DocumentPreview'
import {
  STATUS_LABELS,
  STATUS_COLORS,
  formatRelativeTime,
  formatDate,
  getDepartmentPath,
} from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'

// ─── Types ────────────────────────────────────────────────────────────────────

interface DocRecord {
  id: string
  title: string
  content: string
  status: string
  department: string
  outputFormat: string
  version: number
  tokenUsage: unknown
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

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  attachments?: AttachedFile[]
}

interface AttachedFile {
  name: string
  type: 'text' | 'image'
  textContent?: string
  imageData?: string   // base64
  imageType?: string   // 'image/jpeg' etc
}

// ─── Markdown → HTML ──────────────────────────────────────────────────────────

function markdownToHtml(markdown: string): string {
  let html = markdown

  // Tables (process first)
  html = html.replace(
    /^(\|.+\|)\n(\|[-:\s|]+\|)\n((?:\|.+\|\n?)*)/gm,
    (_match, header: string, _sep: string, body: string) => {
      const headerCells = header
        .split('|')
        .filter((c: string) => c.trim())
        .map(
          (c: string) =>
            `<th style="padding:8px 12px;background:#1B2A4A;color:white;font-weight:600;text-align:left;border:1px solid #e5e7eb">${c.trim()}</th>`,
        )
      const rows = body
        .trim()
        .split('\n')
        .map((row: string) => {
          const cells = row
            .split('|')
            .filter((c: string) => c.trim())
            .map(
              (c: string) =>
                `<td style="padding:8px 12px;border:1px solid #e5e7eb">${c.trim()}</td>`,
            )
          return `<tr>${cells.join('')}</tr>`
        })
      return `<table style="width:100%;border-collapse:collapse;margin:16px 0"><thead><tr>${headerCells.join('')}</tr></thead><tbody>${rows.join('')}</tbody></table>`
    },
  )

  // Headings
  html = html.replace(/^### (.*)/gm, '<h3>$1</h3>')
  html = html.replace(/^## (.*)/gm, '<h2>$1</h2>')
  html = html.replace(/^# (.*)/gm, '<h1>$1</h1>')

  // Bold and italic
  html = html.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>')
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>')

  // Horizontal rule
  html = html.replace(/^---$/gm, '<hr>')

  // Ordered list
  html = html.replace(/^(\d+)\. (.*)/gm, '<ol-item>$2</ol-item>')
  html = html.replace(/((?:<ol-item>.*<\/ol-item>\n?)+)/g, (_match, items: string) => {
    const lis = items.replace(/<ol-item>(.*?)<\/ol-item>/g, '<li>$1</li>')
    return `<ol>${lis}</ol>`
  })

  // Unordered list
  html = html.replace(/^[-*] (.*)/gm, '<ul-item>$1</ul-item>')
  html = html.replace(/((?:<ul-item>.*<\/ul-item>\n?)+)/g, (_match, items: string) => {
    const lis = items.replace(/<ul-item>(.*?)<\/ul-item>/g, '<li>$1</li>')
    return `<ul>${lis}</ul>`
  })

  // Paragraphs — wrap text blocks separated by blank lines
  const blocks = html.split(/\n\n+/)
  html = blocks
    .map((block) => {
      const trimmed = block.trim()
      if (!trimmed) return ''
      if (
        trimmed.startsWith('<h') ||
        trimmed.startsWith('<table') ||
        trimmed.startsWith('<ul') ||
        trimmed.startsWith('<ol') ||
        trimmed.startsWith('<hr')
      ) {
        return trimmed
      }
      return `<p>${trimmed.replace(/\n/g, '<br>')}</p>`
    })
    .filter(Boolean)
    .join('\n')

  return html
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DocumentEditorPage() {
  const params = useParams()
  const router = useRouter()
  const docId = params.id as string

  const [doc, setDoc] = useState<DocRecord | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [content, setContent] = useState('')
  const [title, setTitle] = useState('')
  const [previewOpen, setPreviewOpen] = useState(false)
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([])
  const [initData, setInitData] = useState<unknown>(null)

  const [pageLoading, setPageLoading] = useState(true)
  const [pageError, setPageError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [editingTitle, setEditingTitle] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const autoSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasAutoGenerated = useRef(false)

  const wordCount = content.replace(/<[^>]*>/g, ' ').split(/\s+/).filter(Boolean).length

  // ── Load document & session storage on mount ──
  useEffect(() => {
    fetchDocument()
    const stored = sessionStorage.getItem(`doc-${docId}-init`)
    if (stored) {
      try {
        setInitData(JSON.parse(stored))
        sessionStorage.removeItem(`doc-${docId}-init`)
      } catch {
        // ignore parse errors
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docId])

  // ── Auto-generate on mount if configured ──
  useEffect(() => {
    const data = initData as { autoGenerate?: boolean } | null
    if (data?.autoGenerate && doc && !hasAutoGenerated.current) {
      hasAutoGenerated.current = true
      const timer = setTimeout(() => {
        sendMessage(`Lütfen bu dokümanı oluştur: ${doc.title}`)
      }, 500)
      return () => clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initData, doc])

  // ── Auto-save every 30 seconds when content changes ──
  useEffect(() => {
    if (autoSaveRef.current) clearTimeout(autoSaveRef.current)
    autoSaveRef.current = setTimeout(() => {
      if (doc && (title !== doc.title || content !== doc.content)) {
        saveDocument()
      }
    }, 30000)
    return () => {
      if (autoSaveRef.current) clearTimeout(autoSaveRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, content])

  // ── Scroll to latest message ──
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  // ── Auto-grow textarea ──
  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 160) + 'px'
  }, [input])

  // ─── API calls ─────────────────────────────────────────────────────────────

  async function fetchDocument() {
    try {
      const res = await fetch(`/api/documents/${docId}`)
      if (!res.ok) {
        setPageError('Doküman bulunamadı')
        return
      }
      const data = await res.json()
      setDoc(data.document)
      setTitle(data.document.title)
      setContent(data.document.content)
    } catch {
      setPageError('Doküman yüklenemedi')
    } finally {
      setPageLoading(false)
    }
  }

  async function saveDocument() {
    if (!doc) return
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
        setDoc((prev) => (prev ? { ...prev, ...data.document } : null))
      }
    } catch {
      // silent
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
      setDoc((prev) => (prev ? { ...prev, status: data.document.status } : null))
    }
  }

  async function createNewVersion() {
    const res = await fetch('/api/documents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: `${title} (v${(doc?.version || 1) + 1})`,
        content,
        department: doc?.department,
        clientId: doc?.client?.id,
        templateId: doc?.template?.id,
        parentId: docId,
        version: (doc?.version || 1) + 1,
      }),
    })
    if (res.ok) {
      const data = await res.json()
      router.push(`/dokuman/${data.document.id}`)
    }
  }

  async function exportDocument(format: string) {
    if (format === 'pdf') {
      window.print()
      return
    }
    if (format === 'copy') {
      navigator.clipboard.writeText(content.replace(/<[^>]*>/g, ' ').trim())
      return
    }
    if (['docx', 'pptx', 'xlsx'].includes(format)) {
      const res = await fetch('/api/documents/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: docId, format }),
      })
      if (res.ok) {
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = window.document.createElement('a')
        a.href = url
        a.download = `${title}.${format}`
        a.click()
        URL.revokeObjectURL(url)
      }
    }
  }

  // ─── File upload ───────────────────────────────────────────────────────────

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    for (const file of files) {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader()
        reader.onload = () => {
          const base64 = (reader.result as string).split(',')[1]
          setAttachedFiles((prev) => [
            ...prev,
            { name: file.name, type: 'image', imageData: base64, imageType: file.type },
          ])
        }
        reader.readAsDataURL(file)
      } else {
        const text = await file.text()
        setAttachedFiles((prev) => [
          ...prev,
          { name: file.name, type: 'text', textContent: text.slice(0, 5000) },
        ])
      }
    }
    // reset input so same file can be re-attached
    e.target.value = ''
  }

  // ─── Send message ──────────────────────────────────────────────────────────

  const sendMessage = useCallback(
    async (overrideContent?: string) => {
      const messageContent = overrideContent ?? input.trim()
      if (!messageContent || isLoading || !doc) return

      const currentFiles = [...attachedFiles]

      const userMsg: Message = {
        id: crypto.randomUUID(),
        role: 'user',
        content: messageContent,
        timestamp: new Date(),
        attachments: currentFiles.length > 0 ? currentFiles : undefined,
      }

      const newMessages = [...messages, userMsg]
      setMessages(newMessages)
      setInput('')
      setAttachedFiles([])
      setIsLoading(true)

      try {
        // Build text content with file attachments
        let messageText = messageContent
        currentFiles.forEach((f) => {
          if (f.type === 'text') {
            messageText += `\n\n[Ek Dosya: ${f.name}]\n${f.textContent}`
          }
        })

        // Include current doc content as context for revisions
        if (content && messages.length > 0) {
          messageText = `[Mevcut Doküman İçeriği]:\n${content
            .replace(/<[^>]*>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 2000)}\n\n[Talep]: ${messageText}`
        }

        const apiMessages = messages.map((m) => ({ role: m.role, content: m.content }))
        apiMessages.push({ role: 'user', content: messageText })

        const imageAttachments = currentFiles
          .filter((f) => f.type === 'image')
          .map((f) => ({ data: f.imageData, mediaType: f.imageType }))

        const res = await fetch('/api/claude', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: apiMessages,
            department: doc.department,
            clientId: doc.client?.id || null,
            templateId: doc.template?.id || null,
            documentId: doc.id,
            mode: doc.template ? 'generate' : 'chat',
            imageAttachments: imageAttachments.length > 0 ? imageAttachments : undefined,
          }),
        })

        const data = await res.json()

        if (!res.ok) {
          throw new Error(data.error || 'API isteği başarısız')
        }

        const assistantMsg: Message = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: data.content,
          timestamp: new Date(),
        }
        setMessages((prev) => [...prev, assistantMsg])

        // Detect full document response
        const isDocument =
          data.content.length > 200 ||
          /^#{1,3} /m.test(data.content) ||
          data.content.includes('\n\n')

        if (isDocument) {
          const html = markdownToHtml(data.content)
          setContent(html)
          setPreviewOpen(true)
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : 'Bir hata oluştu'
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: `Hata: ${errMsg}`,
            timestamp: new Date(),
          },
        ])
      } finally {
        setIsLoading(false)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [input, isLoading, doc, attachedFiles, messages, content],
  )

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  // ─── Loading / Error states ────────────────────────────────────────────────

  if (pageLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-[#E87722]" />
      </div>
    )
  }

  if (pageError || !doc) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <FileText className="w-12 h-12 text-gray-300" />
        <p className="text-gray-500">{pageError || 'Doküman bulunamadı'}</p>
        <Link href="/">
          <Button variant="outline">Ana Sayfaya Dön</Button>
        </Link>
      </div>
    )
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full">
      {/* ── Header ── */}
      <div className="bg-white border-b border-gray-200 px-4 py-2.5 flex items-center gap-3">
        <Link href={getDepartmentPath(doc.department as Parameters<typeof getDepartmentPath>[0])}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Geri
          </Button>
        </Link>

        {/* Editable title */}
        {editingTitle ? (
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => setEditingTitle(false)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') setEditingTitle(false)
            }}
            className="flex-1 border-none outline-none shadow-none text-base font-semibold text-gray-900 bg-transparent px-2 min-w-0"
          />
        ) : (
          <button
            className="flex-1 text-left text-base font-semibold text-gray-900 px-2 truncate hover:text-[#1B2A4A] min-w-0"
            onClick={() => setEditingTitle(true)}
            title="Başlığı düzenle"
          >
            {title || 'Doküman başlığı'}
          </button>
        )}

        <div className="flex items-center gap-2 shrink-0">
          {/* Status dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button>
                <Badge
                  className={`${STATUS_COLORS[doc.status]} cursor-pointer hover:opacity-80 flex items-center gap-1`}
                  variant="outline"
                >
                  {STATUS_LABELS[doc.status]}
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

          {/* Save */}
          <Button variant="outline" size="sm" onClick={() => saveDocument()} disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            Kaydet
          </Button>

          {/* Export */}
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
                Word (.docx) olarak indir
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportDocument('pptx')}>
                PowerPoint (.pptx) olarak indir
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportDocument('xlsx')}>
                Excel (.xlsx) olarak indir
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportDocument('pdf')}>
                PDF olarak yazdır
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportDocument('copy')}>
                Panoya kopyala (düz metin)
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={createNewVersion}>
                <Layers className="w-4 h-4 mr-2" />
                Yeni Versiyon Oluştur
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Toggle preview */}
          <Button
            variant={previewOpen ? 'default' : 'outline'}
            size="sm"
            onClick={() => setPreviewOpen((v) => !v)}
            title={previewOpen ? 'Önizlemeyi kapat' : 'Doküman önizlemesini aç'}
          >
            <PanelRight className="w-3.5 h-3.5" />
            {previewOpen ? 'Önizlemeyi Kapat' : 'Önizle'}
          </Button>
        </div>
      </div>

      {/* ── Main area ── */}
      <div className="flex-1 flex overflow-hidden">
        {/* ── Chat panel ── */}
        <div
          className="flex flex-col bg-[#F7F7F8] transition-all duration-300"
          style={{ width: previewOpen ? '55%' : '100%' }}
        >
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {messages.length === 0 && !isLoading && (
              <div className="flex flex-col items-center justify-center h-full py-20 text-center">
                <div className="w-14 h-14 bg-[#E87722]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Sparkles className="w-7 h-7 text-[#E87722]" />
                </div>
                <p className="text-gray-700 font-semibold text-base">Lobby AI Asistan</p>
                <p className="text-gray-400 text-sm mt-1.5 max-w-xs">
                  Dokümanınızı oluşturmak için ne yazmamı istersiniz?
                </p>
              </div>
            )}

            {messages.map((message) => (
              <div key={message.id} className="w-full">
                {message.role === 'user' ? (
                  /* User bubble — right aligned */
                  <div className="flex justify-end">
                    <div className="bg-white border border-gray-200 rounded-2xl rounded-br-sm px-4 py-3 max-w-[75%] shadow-sm">
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{message.content}</p>
                      {message.attachments && message.attachments.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {message.attachments.map((f, i) => (
                            <span
                              key={i}
                              className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full"
                            >
                              {f.type === 'image' ? '🖼' : '📄'} {f.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  /* AI message — left aligned, no bubble */
                  <div className="flex gap-3 items-start">
                    <div className="w-7 h-7 rounded-full bg-[#E87722] flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-white text-xs font-bold">L</span>
                    </div>
                    <div
                      className="flex-1 chat-ai-content text-sm text-gray-700 leading-relaxed min-w-0"
                      dangerouslySetInnerHTML={{ __html: markdownToHtml(message.content) }}
                    />
                  </div>
                )}
              </div>
            ))}

            {/* Loading indicator */}
            {isLoading && (
              <div className="flex gap-3 items-start">
                <div className="w-7 h-7 rounded-full bg-[#E87722] flex items-center justify-center shrink-0">
                  <span className="text-white text-xs font-bold">L</span>
                </div>
                <div className="flex items-center gap-1.5 py-2">
                  <span
                    className="w-2 h-2 rounded-full bg-[#E87722] animate-bounce"
                    style={{ animationDelay: '0ms' }}
                  />
                  <span
                    className="w-2 h-2 rounded-full bg-[#E87722] animate-bounce"
                    style={{ animationDelay: '150ms' }}
                  />
                  <span
                    className="w-2 h-2 rounded-full bg-[#E87722] animate-bounce"
                    style={{ animationDelay: '300ms' }}
                  />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* ── Input area ── */}
          <div className="px-4 py-3 shrink-0">
            {/* Attached file chips */}
            {attachedFiles.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {attachedFiles.map((f, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-1 text-xs bg-white border border-gray-200 text-gray-600 px-2.5 py-1 rounded-full shadow-sm"
                  >
                    <span>{f.type === 'image' ? '🖼' : '📄'}</span>
                    <span className="max-w-[120px] truncate">{f.name}</span>
                    <button
                      onClick={() => setAttachedFiles((prev) => prev.filter((_, idx) => idx !== i))}
                      className="ml-0.5 text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm px-3 py-2.5 flex items-end gap-2">
              {/* File attach */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-gray-400 hover:text-[#E87722] transition-colors shrink-0 pb-0.5"
                title="Dosya ekle"
              >
                <Paperclip className="w-4.5 h-4.5" style={{ width: '18px', height: '18px' }} />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.md,image/jpeg,image/png,image/gif,image/webp"
                multiple
                className="hidden"
                onChange={handleFileUpload}
              />

              {/* Textarea */}
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isLoading}
                placeholder="Mesaj yazın... (Shift+Enter yeni satır)"
                rows={1}
                className="flex-1 resize-none bg-transparent text-sm text-gray-800 placeholder-gray-400 outline-none leading-relaxed"
                style={{ minHeight: '24px', maxHeight: '160px' }}
              />

              {/* Send button */}
              <button
                onClick={() => sendMessage()}
                disabled={isLoading || (!input.trim() && attachedFiles.length === 0)}
                className="w-8 h-8 rounded-full bg-[#E87722] hover:bg-[#d06a1a] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors shrink-0"
              >
                <Send className="w-3.5 h-3.5 text-white" />
              </button>
            </div>
          </div>
        </div>

        {/* ── Document preview panel (slides in) ── */}
        <div
          className="border-l border-gray-200 flex flex-col overflow-hidden transition-all duration-300"
          style={{ width: previewOpen ? '45%' : '0%', opacity: previewOpen ? 1 : 0 }}
        >
          {previewOpen && (
            <DocumentPreview
              title={title}
              content={content}
              clientName={doc.client?.name}
              authorName={doc.author.name}
              documentId={docId}
              onExport={exportDocument}
              onClose={() => setPreviewOpen(false)}
            />
          )}
        </div>
      </div>

      {/* ── Footer ── */}
      <div className="bg-white border-t border-gray-200 px-4 py-2 flex items-center justify-between text-xs text-gray-400">
        <div className="flex items-center gap-4">
          <span>Versiyon: v{doc.version}</span>
          {doc.client && <span>Müşteri: {doc.client.name}</span>}
          {doc.template && <span>Şablon: {doc.template.name}</span>}
        </div>
        <div className="flex items-center gap-4">
          <span>{wordCount} kelime</span>
          <div className="flex items-center gap-1">
            <User className="w-3 h-3" />
            {doc.author.name}
          </div>
          {lastSaved ? (
            <div className="flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-green-500" />
              {formatRelativeTime(lastSaved)} kaydedildi
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatRelativeTime(doc.updatedAt)}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
