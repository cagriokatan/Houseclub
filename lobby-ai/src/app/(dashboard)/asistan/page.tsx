'use client'

import { useState } from 'react'
import { Header } from '@/components/dashboard/Header'
import { ChatPanel } from '@/components/chat/ChatPanel'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'

const departments = [
  { value: 'MEDYA_ILISKILERI', label: 'Medya İlişkileri' },
  { value: 'MUSTERI_ILISKILERI', label: 'Müşteri İlişkileri' },
  { value: 'ETKINLIK', label: 'Etkinlik' },
  { value: 'RAPORLAMA', label: 'Raporlama' },
]

export default function AsistanPage() {
  const [department, setDepartment] = useState('MEDYA_ILISKILERI')

  return (
    <div className="flex flex-col h-full">
      <Header
        title="💬 AI Asistan"
        description="Serbest sohbet modu — Claude ile doğrudan konuşun"
        actions={
          <div className="flex items-center gap-2">
            <Label className="text-sm text-gray-500 whitespace-nowrap">Bağlam:</Label>
            <Select value={department} onValueChange={setDepartment}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {departments.map((d) => (
                  <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
      />
      <div className="flex-1 overflow-hidden">
        <ChatPanel
          department={department}
          key={department} // Departman değişince sohbeti sıfırla
        />
      </div>
    </div>
  )
}
