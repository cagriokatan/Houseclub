'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { FileText, Clock, Search, Filter, Plus, ChevronRight } from 'lucide-react'
import { Header } from '@/components/dashboard/Header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DEPARTMENT_LABELS, DEPARTMENT_ICONS, STATUS_LABELS, STATUS_COLORS, formatRelativeTime } from '@/lib/utils'

interface Document {
  id: string
  title: string
  status: string
  department: string
  updatedAt: string
  author: { name: string }
  client?: { name: string } | null
  template?: { name: string } | null
}

export default function DokümanlarPage() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [department, setDepartment] = useState('__all__')
  const [status, setStatus] = useState('__all__')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  useEffect(() => {
    fetchDocuments()
  }, [search, department, status, page])

  async function fetchDocuments() {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({ page: page.toString(), limit: '20' })
      if (search) params.set('search', search)
      if (department && department !== '__all__') params.set('department', department)
      if (status && status !== '__all__') params.set('status', status)

      const res = await fetch(`/api/documents?${params}`)
      const data = await res.json()
      setDocuments(data.documents || [])
      setTotalPages(data.pagination?.pages || 1)
    } catch {
      // hata yönetimi
    } finally {
      setIsLoading(false)
    }
  }

  const departments = [
    { value: 'MEDYA_ILISKILERI', label: 'Medya İlişkileri' },
    { value: 'MUSTERI_ILISKILERI', label: 'Müşteri İlişkileri' },
    { value: 'ETKINLIK', label: 'Etkinlik' },
    { value: 'RAPORLAMA', label: 'Raporlama' },
  ]

  const statuses = [
    { value: 'DRAFT', label: 'Taslak' },
    { value: 'IN_REVIEW', label: 'İncelemede' },
    { value: 'APPROVED', label: 'Onaylandı' },
    { value: 'EXPORTED', label: 'Dışa Aktarıldı' },
  ]

  return (
    <div className="flex flex-col h-full overflow-auto">
      <Header title="📄 Dokümanlarım" description="Tüm oluşturduğunuz dokümanlar" />

      <div className="flex-1 p-6 space-y-4">
        {/* Filtreler */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Doküman ara..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              className="pl-9"
            />
          </div>
          <Select value={department} onValueChange={(v) => { setDepartment(v); setPage(1) }}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Tüm Departmanlar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Tüm Departmanlar</SelectItem>
              {departments.map((d) => (
                <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1) }}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Tüm Durumlar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Tüm Durumlar</SelectItem>
              {statuses.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Doküman listesi */}
        <Card>
          {isLoading ? (
            <div className="space-y-3 p-6">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-14 bg-gray-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : documents.length === 0 ? (
            <CardContent className="py-16 text-center">
              <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">Doküman bulunamadı</p>
            </CardContent>
          ) : (
            <div className="divide-y divide-gray-100">
              {documents.map((doc) => (
                <Link key={doc.id} href={`/dokuman/${doc.id}`}>
                  <div className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors group">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-lg shrink-0">
                        {DEPARTMENT_ICONS[doc.department as keyof typeof DEPARTMENT_ICONS] || '📄'}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate group-hover:text-[#1B2A4A]">
                          {doc.title}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-gray-400">
                            {DEPARTMENT_LABELS[doc.department as keyof typeof DEPARTMENT_LABELS]}
                          </span>
                          {doc.client && (
                            <>
                              <span className="text-gray-200">·</span>
                              <span className="text-xs text-gray-400">{doc.client.name}</span>
                            </>
                          )}
                          <span className="text-gray-200">·</span>
                          <span className="text-xs text-gray-400">{doc.author.name}</span>
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

        {/* Sayfalama */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Önceki
            </Button>
            <span className="text-sm text-gray-500">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              Sonraki
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
