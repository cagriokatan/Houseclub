import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Oturum açmanız gerekiyor' }, { status: 401 })
  }

  const { id } = await params

  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      documents: {
        where: { parentId: null },
        select: { id: true, title: true, status: true, createdAt: true, department: true },
        orderBy: { createdAt: 'desc' },
        take: 5,
      },
      _count: { select: { documents: true } },
    },
  })

  if (!client) {
    return NextResponse.json({ error: 'Müşteri bulunamadı' }, { status: 404 })
  }

  return NextResponse.json({ client })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Oturum açmanız gerekiyor' }, { status: 401 })
  }

  if (session.user.role === 'USER') {
    return NextResponse.json({ error: 'Bu işlem için yetkiniz yok' }, { status: 403 })
  }

  const { id } = await params

  try {
    const body = await req.json()
    const client = await prisma.client.update({
      where: { id },
      data: body,
    })
    return NextResponse.json({ client })
  } catch (error) {
    return NextResponse.json(
      { error: 'Müşteri güncellenemedi, lütfen tekrar deneyin' },
      { status: 500 }
    )
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Oturum açmanız gerekiyor' }, { status: 401 })
  }

  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Bu işlem için yetkiniz yok' }, { status: 403 })
  }

  const { id } = await params

  // Soft delete
  await prisma.client.update({
    where: { id },
    data: { isActive: false },
  })

  return NextResponse.json({ success: true })
}
