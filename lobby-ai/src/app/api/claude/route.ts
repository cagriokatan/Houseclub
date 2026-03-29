import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { buildSystemPrompt, fillTemplate, calculateCost } from '@/lib/claude'
import { prisma } from '@/lib/prisma'
import Anthropic from '@anthropic-ai/sdk'
import { Department } from '@prisma/client'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const DEFAULT_MODEL = process.env.DEFAULT_AI_MODEL || 'claude-sonnet-4-6-20250514'
const MAX_DAILY_TOKENS = parseInt(process.env.MAX_DAILY_TOKENS_PER_USER || '500000')

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
      mode = 'chat', // 'chat' | 'generate' | 'refine'
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

    // Streaming response
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        let inputTokens = 0
        let outputTokens = 0
        let fullContent = ''

        try {
          const claudeStream = await anthropic.messages.create({
            model: DEFAULT_MODEL,
            max_tokens: 4096,
            system: systemPrompt,
            messages: messages.map((m: any) => ({
              role: m.role,
              content: m.content,
            })),
            stream: true,
          })

          for await (const event of claudeStream) {
            if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
              fullContent += event.delta.text
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: 'text', text: event.delta.text })}\n\n`)
              )
            } else if (event.type === 'message_start' && event.message.usage) {
              inputTokens = event.message.usage.input_tokens
            } else if (event.type === 'message_delta' && event.usage) {
              outputTokens = event.usage.output_tokens
            } else if (event.type === 'message_stop') {
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
                  metadata: {
                    mode,
                    department,
                    inputTokens,
                    outputTokens,
                    cost,
                  },
                },
              })

              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: 'done',
                    usage: { inputTokens, outputTokens, cost },
                    content: fullContent,
                  })}\n\n`
                )
              )
            }
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Claude API hatası'
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'error', error: message })}\n\n`)
          )
        } finally {
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (error) {
    console.error('Claude API route hatası:', error)
    return NextResponse.json(
      { error: 'Yapay zeka isteği işlenirken bir hata oluştu. Lütfen tekrar deneyin.' },
      { status: 500 }
    )
  }
}
