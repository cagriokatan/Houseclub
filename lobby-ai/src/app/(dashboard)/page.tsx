import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Header } from '@/components/dashboard/Header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  FileText,
  MessageSquare,
  TrendingUp,
  Clock,
  Plus,
  ArrowRight,
} from 'lucide-react'
import Link from 'next/link'
import { DEPARTMENT_LABELS, DEPARTMENT_ICONS, STATUS_LABELS, STATUS_COLORS, formatRelativeTime, formatCost } from '@/lib/utils'

async function getDashboardData(userId: string, role: string) {
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  const [recentDocuments, myStats, aiStats] = await Promise.all([
    prisma.document.findMany({
      where: {
        ...(role === 'USER' ? { authorId: userId } : {}),
        parentId: null,
      },
      include: {
        author: { select: { name: true } },
        client: { select: { name: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 5,
    }),
    prisma.document.count({
      where: {
        authorId: userId,
        parentId: null,
        createdAt: { gte: monthStart },
      },
    }),
    prisma.aISession.aggregate({
      where: { userId, createdAt: { gte: monthStart } },
      _sum: { totalInputTokens: true, totalOutputTokens: true, estimatedCost: true },
      _count: true,
    }),
  ])

  return { recentDocuments, myStats, aiStats }
}

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user) return null

  const { recentDocuments, myStats, aiStats } = await getDashboardData(
    session.user.id!,
    session.user.role
  )

  const totalTokens = (aiStats._sum.totalInputTokens || 0) + (aiStats._sum.totalOutputTokens || 0)
  const totalCost = aiStats._sum.estimatedCost || 0

  const quickLinks = [
    { href: '/medya', label: 'Medya İlişkileri', icon: '📰', color: 'bg-blue-50 hover:bg-blue-100 border-blue-200' },
    { href: '/musteri', label: 'Müşteri İlişkileri', icon: '🤝', color: 'bg-green-50 hover:bg-green-100 border-green-200' },
    { href: '/etkinlik', label: 'Etkinlik', icon: '🎪', color: 'bg-purple-50 hover:bg-purple-100 border-purple-200' },
    { href: '/raporlama', label: 'Raporlama', icon: '📊', color: 'bg-orange-50 hover:bg-orange-100 border-orange-200' },
  ]

  return (
    <div className="flex flex-col h-full overflow-auto">
      <Header
        title={`Merhaba, ${session.user.name?.split(' ')[0]} 👋`}
        description="Bugün ne üretmek istersiniz?"
        actions={
          <Link href="/asistan">
            <Button variant="orange">
              <MessageSquare className="w-4 h-4" />
              AI Asistan
            </Button>
          </Link>
        }
      />

      <div className="flex-1 p-6 space-y-6">
        {/* İstatistik kartları */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Bu Ay Doküman</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">{myStats}</p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                  <FileText className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">AI Sorgusu</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">{aiStats._count}</p>
                </div>
                <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                  <MessageSquare className="w-6 h-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Bu Ay Maliyet</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">{formatCost(totalCost)}</p>
                </div>
                <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Hızlı erişim */}
        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-3">Çalışma Alanları</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {quickLinks.map((link) => (
              <Link key={link.href} href={link.href}>
                <div className={`p-4 rounded-xl border-2 transition-colors cursor-pointer ${link.color}`}>
                  <div className="text-2xl mb-2">{link.icon}</div>
                  <p className="text-sm font-medium text-gray-700">{link.label}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Son dokümanlar */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-gray-900">Son Dokümanlar</h2>
            <Link href="/dokuman">
              <Button variant="ghost" size="sm">
                Tümünü Gör <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </Link>
          </div>

          <Card>
            {recentDocuments.length === 0 ? (
              <CardContent className="py-12 text-center">
                <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">Henüz doküman oluşturulmamış</p>
                <p className="text-gray-400 text-xs mt-1">Bir departman çalışma alanından başlayın</p>
              </CardContent>
            ) : (
              <div className="divide-y divide-gray-100">
                {recentDocuments.map((doc) => (
                  <Link key={doc.id} href={`/dokuman/${doc.id}`}>
                    <div className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-lg">{DEPARTMENT_ICONS[doc.department]}</span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{doc.title}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-gray-400">{doc.author.name}</span>
                            {doc.client && (
                              <>
                                <span className="text-gray-200">·</span>
                                <span className="text-xs text-gray-400">{doc.client.name}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 ml-4">
                        <Badge
                          className={STATUS_COLORS[doc.status]}
                          variant="outline"
                        >
                          {STATUS_LABELS[doc.status]}
                        </Badge>
                        <div className="flex items-center gap-1 text-xs text-gray-400">
                          <Clock className="w-3 h-3" />
                          {formatRelativeTime(doc.updatedAt)}
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
