import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Oturum açmanız gerekiyor' }, { status: 401 })
  }

  const { id } = await params

  const document = await prisma.document.findUnique({
    where: { id },
    include: {
      author: { select: { id: true, name: true, email: true } },
      client: { select: { id: true, name: true, sector: true, tone: true } },
      template: { select: { id: true, name: true, category: true } },
      versions: {
        select: {
          id: true,
          title: true,
          version: true,
          status: true,
          createdAt: true,
          author: { select: { name: true } },
        },
        orderBy: { version: 'desc' },
      },
      parent: {
        select: { id: true, title: true, version: true },
      },
    },
  })

  if (!document) {
    return NextResponse.json({ error: 'Doküman bulunamadı' }, { status: 404 })
  }

  // Yetki kontrolü: USER sadece kendi dokümanlarını görebilir
  if (session.user.role === 'USER' && document.authorId !== session.user.id) {
    return NextResponse.json({ error: 'Bu dokümanı görüntüleme yetkiniz yok' }, { status: 403 })
  }

  return NextResponse.json({ document })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Oturum açmanız gerekiyor' }, { status: 401 })
  }

  const { id } = await params

  try {
    const body = await req.json()
    const { title, content, status, tokenUsage } = body

    const existing = await prisma.document.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Doküman bulunamadı' }, { status: 404 })
    }

    if (session.user.role === 'USER' && existing.authorId !== session.user.id) {
      return NextResponse.json({ error: 'Bu dokümanı düzenleme yetkiniz yok' }, { status: 403 })
    }

    const document = await prisma.document.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(content !== undefined && { content }),
        ...(status !== undefined && { status }),
        ...(tokenUsage !== undefined && { tokenUsage }),
      },
      include: {
        author: { select: { id: true, name: true, email: true } },
        client: { select: { id: true, name: true, sector: true } },
        template: { select: { id: true, name: true } },
      },
    })

    await prisma.activity.create({
      data: {
        type: 'document_updated',
        userId: session.user.id!,
        documentId: id,
        metadata: { changes: Object.keys(body) },
      },
    })

    return NextResponse.json({ document })
  } catch (error) {
    console.error('Doküman güncelleme hatası:', error)
    return NextResponse.json(
      { error: 'Doküman güncellenemedi, lütfen tekrar deneyin' },
      { status: 500 }
    )
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Oturum açmanız gerekiyor' }, { status: 401 })
  }

  const { id } = await params

  const existing = await prisma.document.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: 'Doküman bulunamadı' }, { status: 404 })
  }

  if (session.user.role === 'USER' && existing.authorId !== session.user.id) {
    return NextResponse.json({ error: 'Bu dokümanı silme yetkiniz yok' }, { status: 403 })
  }

  await prisma.document.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
