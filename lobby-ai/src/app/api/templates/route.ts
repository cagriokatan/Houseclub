import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Department } from '@prisma/client'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Oturum açmanız gerekiyor' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const department = searchParams.get('department') as Department | null

  const templates = await prisma.template.findMany({
    where: {
      isActive: true,
      ...(department && { department }),
    },
    include: {
      _count: { select: { documents: true } },
    },
    orderBy: { name: 'asc' },
  })

  return NextResponse.json({ templates })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Oturum açmanız gerekiyor' }, { status: 401 })
  }

  if (!['ADMIN', 'COORDINATOR'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Bu işlem için yetkiniz yok' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { name, department, category, promptBody, variables, outputFormat } = body

    if (!name || !department || !category || !promptBody) {
      return NextResponse.json(
        { error: 'Ad, departman, kategori ve prompt içeriği zorunludur' },
        { status: 400 }
      )
    }

    const template = await prisma.template.create({
      data: {
        name,
        department: department as Department,
        category,
        promptBody,
        variables: variables || [],
        outputFormat: outputFormat || 'docx',
      },
    })

    return NextResponse.json({ template }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: 'Şablon kaydedilemedi, lütfen tekrar deneyin' },
      { status: 500 }
    )
  }
}
