'use client'

import { useState, useEffect } from 'react'
import { Building2, Plus, Search, FileText, Edit2, X, Loader2, CheckCircle2 } from 'lucide-react'
import { Header } from '@/components/dashboard/Header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface Client {
  id: string
  name: string
  sector: string
  description?: string
  tone?: string
  terminology?: string
  avoidTerms?: string
  brandGuidelines?: string
  keyContacts?: string
  isActive: boolean
  _count?: { documents: number }
}

function ClientModal({
  client,
  onClose,
  onSaved,
}: {
  client?: Client | null
  onClose: () => void
  onSaved: () => void
}) {
  const [formData, setFormData] = useState({
    name: client?.name || '',
    sector: client?.sector || '',
    description: client?.description || '',
    tone: client?.tone || '',
    terminology: client?.terminology || '',
    avoidTerms: client?.avoidTerms || '',
    brandGuidelines: client?.brandGuidelines || '',
    keyContacts: client?.keyContacts || '',
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const res = await fetch(client ? `/api/clients/${client.id}` : '/api/clients', {
        method: client ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Kaydedilemedi')
      } else {
        onSaved()
      }
    } catch {
      setError('Bir hata oluştu')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-lg font-bold">
            {client ? 'Müşteriyi Düzenle' : 'Yeni Müşteri Ekle'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Şirket Adı *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="TÜPRAŞ, Anadolu Sigorta..."
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Sektör *</Label>
              <Input
                value={formData.sector}
                onChange={(e) => setFormData({ ...formData, sector: e.target.value })}
                placeholder="Enerji, Finans, Teknoloji..."
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Şirket Hakkında</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Şirketin kısa tanıtımı, faaliyet alanları..."
              rows={2}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Kurumsal Ton</Label>
            <Input
              value={formData.tone}
              onChange={(e) => setFormData({ ...formData, tone: e.target.value })}
              placeholder='Örn: "Kurumsal, güven veren, teknik uzmanlığı ön plana çıkaran"'
            />
          </div>

          <div className="space-y-1.5">
            <Label>Kullanılacak Terminoloji</Label>
            <Textarea
              value={formData.terminology}
              onChange={(e) => setFormData({ ...formData, terminology: e.target.value })}
              placeholder='Örn: "sürdürülebilirlik, enerji dönüşümü, yeşil dönüşüm"'
              rows={2}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Kaçınılacak İfadeler</Label>
            <Textarea
              value={formData.avoidTerms}
              onChange={(e) => setFormData({ ...formData, avoidTerms: e.target.value })}
              placeholder='Örn: "en büyük, lider (kanıtlanmamışsa), rakip isimler"'
              rows={2}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Marka Kullanım Kuralları</Label>
            <Textarea
              value={formData.brandGuidelines}
              onChange={(e) => setFormData({ ...formData, brandGuidelines: e.target.value })}
              placeholder="Logo kullanımı, renk kodları, yazım kuralları..."
              rows={2}
            />
          </div>

          <div className="space-y-1.5">
            <Label>İletişim Kişileri</Label>
            <Input
              value={formData.keyContacts}
              onChange={(e) => setFormData({ ...formData, keyContacts: e.target.value })}
              placeholder="Ayşe Kaya (İK Müdürü), Mehmet Demir (CEO)..."
            />
          </div>
        </form>

        <div className="p-6 border-t flex items-center justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>İptal</Button>
          <Button variant="orange" onClick={handleSubmit as any} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Kaydediliyor...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                {client ? 'Güncelle' : 'Müşteri Ekle'}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}

export default function MusterilerPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingClient, setEditingClient] = useState<Client | null>(null)

  useEffect(() => {
    fetchClients()
  }, [])

  async function fetchClients() {
    setIsLoading(true)
    try {
      const res = await fetch('/api/clients')
      const data = await res.json()
      setClients(data.clients || [])
    } catch {
      // hata
    } finally {
      setIsLoading(false)
    }
  }

  const filteredClients = clients.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.sector.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="flex flex-col h-full overflow-auto">
      <Header
        title="🏢 Müşteriler"
        description="Müşteri profilleri ve kurumsal ton bilgileri"
        actions={
          <Button variant="orange" onClick={() => { setEditingClient(null); setShowModal(true) }}>
            <Plus className="w-4 h-4" />
            Yeni Müşteri
          </Button>
        }
      />

      <div className="flex-1 p-6 space-y-4">
        {/* Arama */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Müşteri ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Müşteri kartları */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-48 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : filteredClients.length === 0 ? (
          <div className="text-center py-16">
            <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">Müşteri bulunamadı</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredClients.map((client) => (
              <Card key={client.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base">{client.name}</CardTitle>
                      <Badge variant="secondary" className="mt-1 text-xs">
                        {client.sector}
                      </Badge>
                    </div>
                    <button
                      onClick={() => { setEditingClient(client); setShowModal(true) }}
                      className="text-gray-400 hover:text-gray-600 p-1 rounded"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {client.description && (
                    <p className="text-xs text-gray-500 line-clamp-2">{client.description}</p>
                  )}
                  {client.tone && (
                    <div>
                      <p className="text-xs font-medium text-gray-700">Ton:</p>
                      <p className="text-xs text-gray-500 line-clamp-1">{client.tone}</p>
                    </div>
                  )}
                  {client.terminology && (
                    <div>
                      <p className="text-xs font-medium text-gray-700">Terminoloji:</p>
                      <p className="text-xs text-gray-500 line-clamp-1">{client.terminology}</p>
                    </div>
                  )}
                  <div className="flex items-center gap-1 pt-2 border-t border-gray-100">
                    <FileText className="w-3.5 h-3.5 text-gray-400" />
                    <span className="text-xs text-gray-400">
                      {client._count?.documents || 0} doküman
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <ClientModal
          client={editingClient}
          onClose={() => setShowModal(false)}
          onSaved={() => {
            setShowModal(false)
            fetchClients()
          }}
        />
      )}
    </div>
  )
}
