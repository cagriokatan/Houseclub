'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Plus, FileText, Clock, ChevronRight, Search, Filter } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Header } from '@/components/dashboard/Header'
import { NewDocumentModal } from '@/components/dashboard/NewDocumentModal'
import { STATUS_LABELS, STATUS_COLORS, formatRelativeTime } from '@/lib/utils'
import type { Department } from '@prisma/client'

interface Template {
  id: string
  name: string
  category: string
  outputFormat: string
}

interface Document {
  id: string
  title: string
  status: string
  updatedAt: string
  author: { name: string }
  client?: { name: string } | null
  template?: { name: string } | null
}

interface DepartmentWorkspaceProps {
  department: Department
  title: string
  icon: string
  description: string
}

export function DepartmentWorkspace({ department, title, icon, description }: DepartmentWorkspaceProps) {
  const [templates, setTemplates] = useState<Template[]>([])
  const [documents, setDocuments] = useState<Document[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showNewDocModal, setShowNewDocModal] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)

  useEffect(() => {
    fetchData()
  }, [department])

  async function fetchData() {
    setIsLoading(true)
    try {
      const [templatesRes, docsRes] = await Promise.all([
        fetch(`/api/templates?department=${department}`),
        fetch(`/api/documents?department=${department}&limit=10`),
      ])
      const templatesData = await templatesRes.json()
      const docsData = await docsRes.json()
      setTemplates(templatesData.templates || [])
      setDocuments(docsData.documents || [])
    } catch (err) {
      console.error('Veri yüklenemedi:', err)
    } finally {
      setIsLoading(false)
    }
  }

  function handleTemplateClick(template: Template) {
    setSelectedTemplate(template)
    setShowNewDocModal(true)
  }

  function handleNewDoc() {
    setSelectedTemplate(null)
    setShowNewDocModal(true)
  }

  const filteredDocs = documents.filter((doc) =>
    doc.title.toLowerCase().includes(search.toLowerCase())
  )

  const categoryIcons: Record<string, string> = {
    bülten: '📢',
    rapor: '📋',
    sunum: '📊',
    teklif: '💼',
    kriz: '🚨',
    davetiye: '✉️',
    default: '📄',
  }

  return (
    <div className="flex flex-col h-full overflow-auto">
      <Header
        title={`${icon} ${title}`}
        description={description}
        actions={
          <Button variant="orange" onClick={handleNewDoc}>
            <Plus className="w-4 h-4" />
            Yeni Doküman
          </Button>
        }
      />

      <div className="flex-1 p-6 space-y-6">
        {/* Şablonlar */}
        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-3">Şablonlar</h2>
          {isLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : templates.length === 0 ? (
            <p className="text-gray-400 text-sm">Bu departmana ait şablon bulunamadı</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {templates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => handleTemplateClick(template)}
                  className="p-4 bg-white rounded-xl border-2 border-gray-200 hover:border-[#E87722] hover:shadow-sm transition-all text-left group"
                >
                  <div className="text-xl mb-2">
                    {categoryIcons[template.category] || categoryIcons.default}
                  </div>
                  <p className="text-sm font-medium text-gray-700 group-hover:text-[#E87722]">
                    {template.name}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5 uppercase">{template.outputFormat}</p>
                </button>
              ))}
              {/* Serbest doküman */}
              <button
                onClick={handleNewDoc}
                className="p-4 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300 hover:border-[#1B2A4A] hover:bg-white transition-all text-left group"
              >
                <div className="text-xl mb-2">✏️</div>
                <p className="text-sm font-medium text-gray-500 group-hover:text-[#1B2A4A]">
                  Serbest Doküman
                </p>
                <p className="text-xs text-gray-400 mt-0.5">Şablonsuz oluştur</p>
              </button>
            </div>
          )}
        </div>

        {/* Son dokümanlar */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-gray-900">Son Dokümanlar</h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <Input
                placeholder="Ara..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8 text-sm w-48"
              />
            </div>
          </div>

          <Card>
            {isLoading ? (
              <div className="space-y-3 p-6">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : filteredDocs.length === 0 ? (
              <CardContent className="py-12 text-center">
                <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">
                  {search ? 'Arama sonucu bulunamadı' : 'Henüz doküman oluşturulmamış'}
                </p>
                {!search && (
                  <Button variant="outline" size="sm" className="mt-3" onClick={handleNewDoc}>
                    <Plus className="w-3 h-3 mr-1" />
                    İlk dokümanı oluştur
                  </Button>
                )}
              </CardContent>
            ) : (
              <div className="divide-y divide-gray-100">
                {filteredDocs.map((doc) => (
                  <Link key={doc.id} href={`/dokuman/${doc.id}`}>
                    <div className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <FileText className="w-4 h-4 text-gray-400 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{doc.title}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-gray-400">{doc.author.name}</span>
                            {doc.client && (
                              <>
                                <span className="text-gray-200">·</span>
                                <span className="text-xs text-gray-400">{doc.client.name}</span>
                              </>
                            )}
                            {doc.template && (
                              <>
                                <span className="text-gray-200">·</span>
                                <span className="text-xs text-gray-400">{doc.template.name}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 ml-4">
                        <Badge className={STATUS_COLORS[doc.status]} variant="outline">
                          {STATUS_LABELS[doc.status]}
                        </Badge>
                        <div className="flex items-center gap-1 text-xs text-gray-400">
                          <Clock className="w-3 h-3" />
                          {formatRelativeTime(doc.updatedAt)}
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-300" />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      {showNewDocModal && (
        <NewDocumentModal
          department={department}
          template={selectedTemplate}
          onClose={() => setShowNewDocModal(false)}
          onCreated={(docId) => {
            setShowNewDocModal(false)
            window.location.href = `/dokuman/${docId}`
          }}
        />
      )}
    </div>
  )
}
