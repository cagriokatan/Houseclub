import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Oturum açmanız gerekiyor' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const activeOnly = searchParams.get('active') !== 'false'

  const clients = await prisma.client.findMany({
    where: activeOnly ? { isActive: true } : {},
    include: {
      _count: { select: { documents: true } },
    },
    orderBy: { name: 'asc' },
  })

  return NextResponse.json({ clients })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Oturum açmanız gerekiyor' }, { status: 401 })
  }

  if (session.user.role === 'USER') {
    return NextResponse.json({ error: 'Bu işlem için yetkiniz yok' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { name, sector, description, tone, terminology, avoidTerms, brandGuidelines, keyContacts } = body

    if (!name || !sector) {
      return NextResponse.json({ error: 'Müşteri adı ve sektör zorunludur' }, { status: 400 })
    }

    const client = await prisma.client.create({
      data: { name, sector, description, tone, terminology, avoidTerms, brandGuidelines, keyContacts },
    })

    return NextResponse.json({ client }, { status: 201 })
  } catch (error) {
    console.error('Müşteri oluşturma hatası:', error)
    return NextResponse.json(
      { error: 'Müşteri kaydedilemedi, lütfen tekrar deneyin' },
      { status: 500 }
    )
  }
}
