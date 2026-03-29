import Anthropic from '@anthropic-ai/sdk'
import { Department } from '@prisma/client'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const DEFAULT_MODEL = process.env.DEFAULT_AI_MODEL || 'claude-sonnet-4-6-20250514'

// Token maliyet hesaplama (Sonnet 4.6: $3/MTok input, $15/MTok output)
export function calculateCost(inputTokens: number, outputTokens: number): number {
  const inputCost = (inputTokens / 1_000_000) * 3
  const outputCost = (outputTokens / 1_000_000) * 15
  return inputCost + outputCost
}

// Departmana özel sistem prompt bileşenleri
function getDepartmentInstructions(department: Department): string {
  const instructions: Record<Department, string> = {
    MEDYA_ILISKILERI: `
Medya İlişkileri departmanı uzmanısın. Görevin:
- Gazetecilik standartlarında basın bültenleri ve medya materyalleri hazırlamak
- Medya yansımalarını analiz etmek ve raporlamak
- Kriz iletişimi dokümanları oluşturmak
- Her zaman tarafsız, olgusal ve profesyonel bir dil kullan
- AP Style veya benzeri basın yazarlığı standartlarına uy`,

    MUSTERI_ILISKILERI: `
Müşteri İlişkileri departmanı uzmanısın. Görevin:
- Müşteri iletişimini güçlendirecek stratejik dokümanlar hazırlamak
- İkna edici teklifler ve sunum materyalleri oluşturmak
- Periyodik müşteri raporları ve faaliyet özetleri hazırlamak
- Müşteri memnuniyetini ve ilişki sürekliliğini ön planda tut`,

    ETKINLIK: `
Event Factory departmanı uzmanısın. Görevin:
- Etkinlik planlaması ve organizasyonu dokümanları hazırlamak
- Yaratıcı etkinlik konseptleri ve sunumlar oluşturmak
- Davetiye metinleri ve etkinlik sonrası raporlar hazırlamak
- Detaylara dikkat et, lojistik ve zamanlama konularında titiz ol`,

    RAPORLAMA: `
Raporlama departmanı uzmanısın. Görevin:
- Veri odaklı analiz raporları hazırlamak
- KPI'ları ve performans metriklerini yorumlamak
- Görsel anlatımı destekleyecek tablo ve liste formatları kullanmak
- Her zaman veriyle desteklenen, nesnel değerlendirmeler yap`,
  }

  return instructions[department] || ''
}

// Müşteri profili enjeksiyonu
function buildClientContext(client?: {
  name: string
  sector: string
  tone?: string | null
  terminology?: string | null
  avoidTerms?: string | null
  brandGuidelines?: string | null
}): string {
  if (!client) return ''

  return `
MÜŞTERİ PROFİLİ:
- Şirket Adı: ${client.name}
- Sektör: ${client.sector}
${client.tone ? `- Kurumsal Ton: ${client.tone}` : ''}
${client.terminology ? `- Kullanılacak Terminoloji: ${client.terminology}` : ''}
${client.avoidTerms ? `- Kaçınılacak İfadeler: ${client.avoidTerms}` : ''}
${client.brandGuidelines ? `- Marka Kullanım Kuralları: ${client.brandGuidelines}` : ''}
`
}

// Sistem prompt oluşturma
export function buildSystemPrompt(
  department: Department,
  client?: Parameters<typeof buildClientContext>[0]
): string {
  return `Sen, Türkiye'nin köklü PR ve kurumsal iletişim ajansı Lobby İletişim'de çalışan deneyimli bir iletişim uzmanısın. 35 yıllık sektör deneyimine sahip bu ajans, kurumsal iletişim, medya ilişkileri ve etkinlik yönetimi alanlarında faaliyet göstermektedir.

TEMEL KURALLAR:
1. Her zaman Türkçe yaz (kayda değer bir neden olmadıkça)
2. Profesyonel, akıcı ve etkileyici bir dil kullan
3. Türk dil kurallarına titizlikle uy
4. Kanıtlanmamış üstünlük ifadelerinden kaçın ("en büyük", "lider" gibi — somut veriyle desteklenmediği sürece)
5. İçeriği belirtilen formata tam uygun şekilde hazırla
6. Müşteri gizliliğini koru — diğer müşteri adlarını metne ekleme

DEPARTMAN UZMANLIĞI:
${getDepartmentInstructions(department)}
${buildClientContext(client)}
ÇIKTI KURALLARI:
- Yanıtını doğrudan doküman içeriğiyle başlat
- Meta-yorumlar ekleme ("İşte yazdığım basın bülteni:" gibi ifadeler kullanma)
- Doldurulacak alanları [ALAN ADI] formatında belirt
- Profesyonel doküman yapısını koru`
}

// Template değişkenlerini doldurma
export function fillTemplate(promptBody: string, variables: Record<string, string>): string {
  let filled = promptBody
  for (const [key, value] of Object.entries(variables)) {
    filled = filled.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value || `[${key}]`)
  }
  return filled
}

// Streaming API isteği
export async function streamClaude(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  systemPrompt: string,
  onChunk: (text: string) => void,
  onComplete: (usage: { inputTokens: number; outputTokens: number; cost: number }) => void,
  onError: (error: Error) => void
) {
  try {
    const stream = await anthropic.messages.create({
      model: DEFAULT_MODEL,
      max_tokens: 4096,
      system: systemPrompt,
      messages,
      stream: true,
    })

    let inputTokens = 0
    let outputTokens = 0

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        onChunk(event.delta.text)
      } else if (event.type === 'message_delta' && event.usage) {
        outputTokens = event.usage.output_tokens
      } else if (event.type === 'message_start' && event.message.usage) {
        inputTokens = event.message.usage.input_tokens
      }
    }

    const cost = calculateCost(inputTokens, outputTokens)
    onComplete({ inputTokens, outputTokens, cost })
  } catch (error) {
    onError(error instanceof Error ? error : new Error('Claude API hatası'))
  }
}

// Non-streaming API isteği
export async function callClaude(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  systemPrompt: string,
  maxTokens = 4096
): Promise<{
  content: string
  inputTokens: number
  outputTokens: number
  cost: number
}> {
  const response = await anthropic.messages.create({
    model: DEFAULT_MODEL,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages,
  })

  const content = response.content
    .filter((block) => block.type === 'text')
    .map((block) => (block as { type: 'text'; text: string }).text)
    .join('')

  const inputTokens = response.usage.input_tokens
  const outputTokens = response.usage.output_tokens
  const cost = calculateCost(inputTokens, outputTokens)

  return { content, inputTokens, outputTokens, cost }
}

export { anthropic, DEFAULT_MODEL }
