import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { buildSystemPrompt, fillTemplate, calculateCost } from '@/lib/claude'
import { prisma } from '@/lib/prisma'
import Anthropic from '@anthropic-ai/sdk'
import { Department } from '@prisma/client'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const DEFAULT_MODEL = 'claude-sonnet-4-6'
const MAX_DAILY_TOKENS = 500000

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

    // Şablon prompt
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
        systemPrompt = buildSystemPrompt(department as Department, client || undefined) + '\n\n' + filledPrompt
      } else {
        systemPrompt = buildSystemPrompt(department as Department, client || undefined)
      }
    } else {
      systemPrompt = buildSystemPrompt(department as Department, client || undefined)
    }

    // Build messages array, injecting image attachments into last user message
    const formattedMessages = (messages as Array<{ role: string; content: string }>).map(
      (m, idx) => {
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
                  media_type: img.mediaType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
                  data: img.data,
                },
              })),
              { type: 'text' as const, text: m.content },
            ],
          }
        }
        return { role: m.role as 'user' | 'assistant', content: m.content }
      },
    )

    // Claude API çağrısı (streaming olmadan)
    const message = await anthropic.messages.create({
      model: DEFAULT_MODEL,
      max_tokens: 4096,
      system: systemPrompt,
      messages: formattedMessages,
    })

    const content = message.content[0]?.type === 'text' ? message.content[0].text : ''
    const inputTokens = message.usage.input_tokens
    const outputTokens = message.usage.output_tokens
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
        metadata: { mode, department, inputTokens, outputTokens, cost },
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
      { status: 500 }
    )
  }
}
