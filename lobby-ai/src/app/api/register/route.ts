import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { Department } from '@prisma/client'

const ALLOWED_DOMAIN = process.env.ALLOWED_EMAIL_DOMAIN || 'lobby-pr.com'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, email, password, department } = body

    // Validasyon
    if (!name || !email || !password || !department) {
      return NextResponse.json(
        { error: 'Tüm alanlar zorunludur' },
        { status: 400 }
      )
    }

    if (!email.endsWith(`@${ALLOWED_DOMAIN}`)) {
      return NextResponse.json(
        { error: `Sadece @${ALLOWED_DOMAIN} e-posta adresleri kabul edilmektedir` },
        { status: 400 }
      )
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Şifre en az 8 karakter olmalıdır' },
        { status: 400 }
      )
    }

    if (!Object.values(Department).includes(department as Department)) {
      return NextResponse.json(
        { error: 'Geçersiz departman seçimi' },
        { status: 400 }
      )
    }

    // E-posta kontrolü
    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json(
        { error: 'Bu e-posta adresi zaten kayıtlıdır' },
        { status: 400 }
      )
    }

    // Kullanıcı oluştur
    const hashedPassword = await bcrypt.hash(password, 12)
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        department: department as Department,
      },
      select: {
        id: true,
        name: true,
        email: true,
        department: true,
        role: true,
      },
    })

    // Aktivite kaydı
    await prisma.activity.create({
      data: {
        type: 'user_registered',
        userId: user.id,
        metadata: { name, department },
      },
    })

    return NextResponse.json({ user }, { status: 201 })
  } catch (error) {
    console.error('Kayıt hatası:', error)
    return NextResponse.json(
      { error: 'Kayıt işlemi sırasında bir hata oluştu. Lütfen tekrar deneyin.' },
      { status: 500 }
    )
  }
}
