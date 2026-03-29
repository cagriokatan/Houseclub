import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Department, DocumentStatus } from '@prisma/client'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Oturum açmanız gerekiyor' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '20')
  const department = searchParams.get('department') as Department | null
  const status = searchParams.get('status') as DocumentStatus | null
  const clientId = searchParams.get('clientId')
  const search = searchParams.get('search')
  const myDocs = searchParams.get('myDocs') === 'true'

  const where: any = {
    parentId: null, // Sadece kök dokümanları getir (versiyonları değil)
  }

  if (myDocs || session.user.role === 'USER') {
    where.authorId = session.user.id
  }

  if (department) where.department = department
  if (status) where.status = status
  if (clientId) where.clientId = clientId
  if (search) {
    where.title = { contains: search, mode: 'insensitive' }
  }

  const [documents, total] = await Promise.all([
    prisma.document.findMany({
      where,
      include: {
        author: { select: { id: true, name: true, email: true } },
        client: { select: { id: true, name: true, sector: true } },
        template: { select: { id: true, name: true } },
        _count: { select: { versions: true } },
      },
      orderBy: { updatedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.document.count({ where }),
  ])

  return NextResponse.json({
    documents,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Oturum açmanız gerekiyor' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { title, content, department, clientId, templateId, outputFormat, rawAIOutput, tokenUsage } = body

    if (!title || !department) {
      return NextResponse.json({ error: 'Başlık ve departman zorunludur' }, { status: 400 })
    }

    const document = await prisma.document.create({
      data: {
        title,
        content: content || '',
        rawAIOutput,
        department: department as Department,
        outputFormat: outputFormat || 'docx',
        authorId: session.user.id!,
        clientId: clientId || null,
        templateId: templateId || null,
        tokenUsage: tokenUsage || null,
      },
      include: {
        author: { select: { id: true, name: true, email: true } },
        client: { select: { id: true, name: true, sector: true } },
        template: { select: { id: true, name: true } },
      },
    })

    await prisma.activity.create({
      data: {
        type: 'document_created',
        userId: session.user.id!,
        documentId: document.id,
        metadata: { title, department },
      },
    })

    return NextResponse.json({ document }, { status: 201 })
  } catch (error) {
    console.error('Doküman oluşturma hatası:', error)
    return NextResponse.json(
      { error: 'Doküman kaydedilemedi, lütfen tekrar deneyin' },
      { status: 500 }
    )
  }
}
