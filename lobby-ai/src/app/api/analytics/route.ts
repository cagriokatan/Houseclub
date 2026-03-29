import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Oturum açmanız gerekiyor' }, { status: 401 })
  }

  if (!['ADMIN', 'COORDINATOR'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Bu işlem için yetkiniz yok' }, { status: 403 })
  }

  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const weekStart = new Date(todayStart)
  weekStart.setDate(weekStart.getDate() - 7)
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  const [
    totalDocuments,
    documentsToday,
    documentsThisWeek,
    documentsThisMonth,
    activeUsers,
    aiSessions,
    departmentStats,
    topUsers,
    recentActivity,
  ] = await Promise.all([
    prisma.document.count({ where: { parentId: null } }),
    prisma.document.count({ where: { parentId: null, createdAt: { gte: todayStart } } }),
    prisma.document.count({ where: { parentId: null, createdAt: { gte: weekStart } } }),
    prisma.document.count({ where: { parentId: null, createdAt: { gte: monthStart } } }),
    prisma.user.count({ where: { isActive: true } }),
    prisma.aISession.aggregate({
      _sum: {
        totalInputTokens: true,
        totalOutputTokens: true,
        estimatedCost: true,
      },
      _count: true,
    }),
    prisma.document.groupBy({
      by: ['department'],
      _count: { id: true },
      where: { parentId: null },
    }),
    prisma.user.findMany({
      take: 10,
      select: {
        id: true,
        name: true,
        email: true,
        department: true,
        role: true,
        _count: { select: { documents: true, sessions: true } },
      },
      orderBy: {
        documents: { _count: 'desc' },
      },
    }),
    prisma.activity.findMany({
      take: 20,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { name: true, email: true } },
        document: { select: { title: true } },
      },
    }),
  ])

  // Token maliyet hesapla
  const totalInputTokens = aiSessions._sum.totalInputTokens || 0
  const totalOutputTokens = aiSessions._sum.totalOutputTokens || 0
  const totalCost = aiSessions._sum.estimatedCost || 0

  return NextResponse.json({
    stats: {
      totalDocuments,
      documentsToday,
      documentsThisWeek,
      documentsThisMonth,
      activeUsers,
      totalQueryCount: aiSessions._count,
      totalInputTokens,
      totalOutputTokens,
      totalTokens: totalInputTokens + totalOutputTokens,
      totalCost,
    },
    departmentStats: departmentStats.map((d) => ({
      department: d.department,
      count: d._count.id,
    })),
    topUsers,
    recentActivity,
  })
}
