import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { buildSystemPrompt, fillTemplate, calculateCost } from '@/lib/claude'
import { prisma } from '@/lib/prisma'
import Anthropic from '@anthropic-ai/sdk'
import { Department } from '@prisma/client'
import { webSearch } from '@/lib/search'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const DEFAULT_MODEL = 'claude-sonnet-4-6'
const MAX_DAILY_TOKENS = 500000

// ─── Web search tool definition ───────────────────────────────────────────────

const WEB_SEARCH_TOOL: Anthropic.Tool = {
  name: 'web_search',
  description:
    'İnternette güncel haber ve bilgi arar. Kullanıcı son haberler, güncel olaylar, medya kapsama, sosyal medya trendleri veya son dönemde değişmiş olabilecek bilgiler hakkında soru sorduğunda bu aracı kullan. Özellikle basın bülteni, medya tarama raporu veya güncel haber özeti hazırlanırken aktif olarak kullan.',
  input_schema: {
    type: 'object' as const,
    properties: {
      query: {
        type: 'string',
        description:
          'Arama sorgusu. Türkçe haberler için Türkçe anahtar kelimeler kullan. İngilizce kaynaklara da bakmak için İngilizce sorgular ekleyebilirsin.',
      },
      search_type: {
        type: 'string',
        enum: ['web', 'news'],
        description:
          "Arama türü: 'news' son haberler ve gazete haberleri için, 'web' genel web araması için",
      },
    },
    required: ['query'],
  },
}

// ─── Simple single-call (no tools) ────────────────────────────────────────────

async function callSimple(
  messages: Anthropic.MessageParam[],
  systemPrompt: string,
): Promise<{ content: string; inputTokens: number; outputTokens: number }> {
  const response = await anthropic.messages.create({
    model: DEFAULT_MODEL,
    max_tokens: 4096,
    system: systemPrompt,
    messages,
  })
  const content = response.content
    .filter((b) => b.type === 'text')
    .map((b) => (b as Anthropic.TextBlock).text)
    .join('')
  return {
    content,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  }
}

// ─── Agentic loop with web search tool ────────────────────────────────────────

async function runAgenticLoop(
  initialMessages: Anthropic.MessageParam[],
  systemPrompt: string,
): Promise<{ content: string; inputTokens: number; outputTokens: number }> {
  const messages: Anthropic.MessageParam[] = [...initialMessages]
  let totalInputTokens = 0
  let totalOutputTokens = 0
  const maxIterations = 8

  for (let i = 0; i < maxIterations; i++) {
    const response = await anthropic.messages.create({
      model: DEFAULT_MODEL,
      max_tokens: 4096,
      system: systemPrompt,
      messages,
      tools: [WEB_SEARCH_TOOL],
      tool_choice: { type: 'auto' },
    })

    totalInputTokens += response.usage.input_tokens
    totalOutputTokens += response.usage.output_tokens

    // Final text response
    if (response.stop_reason === 'end_turn' || response.stop_reason === 'max_tokens') {
      const content = response.content
        .filter((b) => b.type === 'text')
        .map((b) => (b as Anthropic.TextBlock).text)
        .join('')
      return { content, inputTokens: totalInputTokens, outputTokens: totalOutputTokens }
    }

    // Tool use requested
    if (response.stop_reason === 'tool_use') {
      messages.push({ role: 'assistant', content: response.content })

      const toolResults: Anthropic.ToolResultBlockParam[] = []
      for (const block of response.content) {
        if (block.type !== 'tool_use') continue

        const input = block.input as { query: string; search_type?: 'web' | 'news' }

        try {
          const results = await webSearch(input.query, input.search_type ?? 'news')
          const resultText =
            results.length === 0
              ? 'Bu sorgu için sonuç bulunamadı.'
              : results
                  .map((r) => {
                    const lines = [`**${r.title}**`]
                    if (r.source) lines.push(`Kaynak: ${r.source}`)
                    if (r.date) lines.push(`Tarih: ${r.date}`)
                    lines.push(r.snippet)
                    lines.push(`URL: ${r.link}`)
                    return lines.join('\n')
                  })
                  .join('\n\n---\n\n')

          toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: resultText })
        } catch (err) {
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: `Arama hatası: ${err instanceof Error ? err.message : 'Bilinmeyen hata'}`,
            is_error: true,
          })
        }
      }

      messages.push({ role: 'user', content: toolResults })
      continue
    }

    // Any other stop reason — extract text and return
    const content = response.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as Anthropic.TextBlock).text)
      .join('')
    return { content, inputTokens: totalInputTokens, outputTokens: totalOutputTokens }
  }

  // Max iterations reached — return any text accumulated so far
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]
    if (msg.role === 'assistant' && Array.isArray(msg.content)) {
      const text = msg.content
        .filter((b) => (b as Anthropic.TextBlock).type === 'text')
        .map((b) => (b as Anthropic.TextBlock).text)
        .join('')
      if (text) return { content: text, inputTokens: totalInputTokens, outputTokens: totalOutputTokens }
    }
  }
  return { content: '', inputTokens: totalInputTokens, outputTokens: totalOutputTokens }
}

// ─── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Oturum açmanız gerekiyor' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const {
      messages,
      department,
      clientId,
      templateId,
      templateVariables,
      documentId,
      mode = 'chat',
      imageAttachments,
    } = body

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'Mesaj listesi gereklidir' }, { status: 400 })
    }

    // Müşteri profili
    let client = null
    if (clientId) {
      client = await prisma.client.findUnique({
        where: { id: clientId },
        select: {
          name: true,
          sector: true,
          tone: true,
          terminology: true,
          avoidTerms: true,
          brandGuidelines: true,
        },
      })
    }

    // Sistem prompt
    let systemPrompt: string
    if (templateId && templateVariables) {
      const template = await prisma.template.findUnique({
        where: { id: templateId },
        select: { promptBody: true },
      })
      if (template) {
        const filledPrompt = fillTemplate(template.promptBody, {
          ...templateVariables,
          müşteri_adı: client?.name || templateVariables.müşteri_adı || '',
          müşteri_sektör: client?.sector || '',
          müşteri_ton: client?.tone || '',
          müşteri_terminoloji: client?.terminology || '',
          'müşteri_kaçınılacak': client?.avoidTerms || '',
        })
        systemPrompt =
          buildSystemPrompt(department as Department, client || undefined) +
          '\n\n' +
          filledPrompt
      } else {
        systemPrompt = buildSystemPrompt(department as Department, client || undefined)
      }
    } else {
      systemPrompt = buildSystemPrompt(department as Department, client || undefined)
    }

    // Build messages array — inject image attachments into last user message
    const formattedMessages: Anthropic.MessageParam[] = (
      messages as Array<{ role: string; content: string }>
    ).map((m, idx) => {
      if (
        idx === messages.length - 1 &&
        m.role === 'user' &&
        Array.isArray(imageAttachments) &&
        imageAttachments.length > 0
      ) {
        return {
          role: 'user' as const,
          content: [
            ...imageAttachments.map((img: { data: string; mediaType: string }) => ({
              type: 'image' as const,
              source: {
                type: 'base64' as const,
                media_type: img.mediaType as
                  | 'image/jpeg'
                  | 'image/png'
                  | 'image/gif'
                  | 'image/webp',
                data: img.data,
              },
            })),
            { type: 'text' as const, text: m.content },
          ],
        }
      }
      return { role: m.role as 'user' | 'assistant', content: m.content }
    })

    // Use agentic loop with web search if SERPER_API_KEY is configured, otherwise simple call
    const { content, inputTokens, outputTokens } = process.env.SERPER_API_KEY
      ? await runAgenticLoop(formattedMessages, systemPrompt)
      : await callSimple(formattedMessages, systemPrompt)

    const cost = calculateCost(inputTokens, outputTokens)

    // Token kullanımını kaydet
    await prisma.aISession.create({
      data: {
        userId: session.user.id!,
        messages: messages,
        totalInputTokens: inputTokens,
        totalOutputTokens: outputTokens,
        estimatedCost: cost,
        model: DEFAULT_MODEL,
      },
    })

    // Aktivite kaydı
    await prisma.activity.create({
      data: {
        type: 'ai_query',
        userId: session.user.id!,
        documentId: documentId || null,
        metadata: { mode, department, inputTokens, outputTokens, cost, webSearch: useSearch },
      },
    })

    return NextResponse.json({
      content,
      usage: { inputTokens, outputTokens, cost },
    })
  } catch (error) {
    console.error('Claude API route hatası:', error)
    const message = error instanceof Error ? error.message : 'Bilinmeyen hata'
    return NextResponse.json(
      { error: `Yapay zeka isteği başarısız: ${message}` },
      { status: 500 },
    )
  }
}
