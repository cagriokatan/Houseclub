'use client'

import { useState, useEffect } from 'react'
import { Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Department } from '@prisma/client'

interface Template {
  id: string
  name: string
  variables: string[]
  outputFormat: string
}

interface Client {
  id: string
  name: string
  sector: string
}

interface NewDocumentModalProps {
  department: Department
  template?: { id: string; name: string } | null
  onClose: () => void
  onCreated: (docId: string) => void
}

const VARIABLE_LABELS: Record<string, string> = {
  müşteri_adı: 'Müşteri Adı',
  konu: 'Konu',
  tarih: 'Tarih',
  ek_bilgi: 'Ek Bilgi',
  dönem: 'Dönem',
  haber_sayısı: 'Haber Sayısı',
  yayın_listesi: 'Yayın Listesi',
  kriz_konusu: 'Kriz Konusu',
  durum_özeti: 'Durum Özeti',
  hizmet_türü: 'Hizmet Türü',
  bütçe_aralığı: 'Bütçe Aralığı',
  süre: 'Süre',
  tamamlanan_işler: 'Tamamlanan İşler',
  hedefler: 'Dönem Hedefleri',
  etkinlik_adı: 'Etkinlik Adı',
  yer: 'Yer',
  katılımcı_sayısı: 'Beklenen Katılımcı Sayısı',
  saat: 'Saat',
  davetli_profili: 'Davetli Profili',
  ay: 'Ay',
  yıl: 'Yıl',
  toplam_haber: 'Toplam Haber Sayısı',
  medya_değeri: 'Tahmini Medya Değeri',
  öne_çıkan_haberler: 'Öne Çıkan Haberler',
}

export function NewDocumentModal({ department, template: initialTemplate, onClose, onCreated }: NewDocumentModalProps) {
  const [templates, setTemplates] = useState<Template[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState(initialTemplate?.id || '__none__')
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
  const [selectedClientId, setSelectedClientId] = useState('__none__')
  const [title, setTitle] = useState(initialTemplate?.name ? `${initialTemplate.name} — ` : '')
  const [variables, setVariables] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    if (selectedTemplateId && selectedTemplateId !== '__none__') {
      const tmpl = templates.find((t) => t.id === selectedTemplateId)
      setSelectedTemplate(tmpl || null)
    } else {
      setSelectedTemplate(null)
    }
  }, [selectedTemplateId, templates])

  async function fetchData() {
    setIsLoading(true)
    try {
      const [templatesRes, clientsRes] = await Promise.all([
        fetch(`/api/templates?department=${department}`),
        fetch('/api/clients?active=true'),
      ])
      const templatesData = await templatesRes.json()
      const clientsData = await clientsRes.json()
      setTemplates(templatesData.templates || [])
      setClients(clientsData.clients || [])

      if (initialTemplate?.id) {
        const tmpl = (templatesData.templates || []).find((t: Template) => t.id === initialTemplate.id)
        setSelectedTemplate(tmpl || null)
      }
    } catch (err) {
      console.error('Veri yüklenemedi:', err)
    } finally {
      setIsLoading(false)
    }
  }

  async function handleCreate() {
    if (!title.trim()) {
      setError('Doküman başlığı zorunludur')
      return
    }

    setError('')
    setIsCreating(true)

    try {
      const docRes = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          department,
          clientId: selectedClientId !== '__none__' ? selectedClientId : null,
          templateId: selectedTemplateId !== '__none__' ? selectedTemplateId : null,
          templateVariables: variables,
          content: '',
        }),
      })

      const docData = await docRes.json()
      if (!docRes.ok) {
        setError(docData.error || 'Doküman oluşturulamadı')
        return
      }

      // Şablon ve müşteri bilgilerini session storage'a yaz (editör sayfası okuyacak)
      if (selectedTemplateId !== '__none__' && Object.keys(variables).length > 0) {
        sessionStorage.setItem(`doc-${docData.document.id}-init`, JSON.stringify({
          templateId: selectedTemplateId,
          clientId: selectedClientId !== '__none__' ? selectedClientId : null,
          variables,
          autoGenerate: true,
        }))
      }

      onCreated(docData.document.id)
    } catch {
      setError('Doküman oluşturulurken bir hata oluştu')
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Yeni Doküman</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Başlık</Label>
            <Input
              placeholder="Doküman başlığı"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Şablon (opsiyonel)</Label>
            <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
              <SelectTrigger>
                <SelectValue placeholder="Şablon seçin veya serbest oluşturun" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Şablonsuz (Serbest)</SelectItem>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Müşteri (opsiyonel)</Label>
            <Select value={selectedClientId} onValueChange={setSelectedClientId}>
              <SelectTrigger>
                <SelectValue placeholder="Müşteri seçin" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Müşterisiz</SelectItem>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name} — {c.sector}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Şablon değişkenleri */}
          {selectedTemplate && selectedTemplate.variables.length > 0 && (
            <div className="space-y-3 p-4 bg-gray-50 rounded-xl">
              <p className="text-sm font-medium text-gray-700">Şablon Alanları</p>
              {selectedTemplate.variables.map((variable) => {
                const label = VARIABLE_LABELS[variable] || variable
                const isLong = ['ek_bilgi', 'durum_özeti', 'yayın_listesi', 'tamamlanan_işler', 'hedefler', 'öne_çıkan_haberler'].includes(variable)
                return (
                  <div key={variable} className="space-y-1">
                    <Label className="text-xs">{label}</Label>
                    {isLong ? (
                      <Textarea
                        placeholder={label}
                        value={variables[variable] || ''}
                        onChange={(e) => setVariables({ ...variables, [variable]: e.target.value })}
                        className="text-sm"
                        rows={3}
                      />
                    ) : (
                      <Input
                        placeholder={label}
                        value={variables[variable] || ''}
                        onChange={(e) => setVariables({ ...variables, [variable]: e.target.value })}
                        className="text-sm"
                      />
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-100 flex items-center justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={isCreating}>
            İptal
          </Button>
          <Button variant="orange" onClick={handleCreate} disabled={isCreating || !title.trim()}>
            {isCreating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Oluşturuluyor...
              </>
            ) : selectedTemplateId !== '__none__' ? (
              'Oluştur ve AI Üret'
            ) : (
              'Doküman Oluştur'
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
