import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Header } from '@/components/dashboard/Header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { DEPARTMENT_LABELS, ROLE_LABELS, formatCost, formatTokens, formatDateTime } from '@/lib/utils'
import {
  FileText,
  Users,
  MessageSquare,
  DollarSign,
  TrendingUp,
  Activity,
} from 'lucide-react'
import Link from 'next/link'

async function getAdminStats() {
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  const [
    totalDocs,
    docsToday,
    docsThisMonth,
    activeUsers,
    aiSessions,
    departmentStats,
    topUsers,
    recentActivities,
  ] = await Promise.all([
    prisma.document.count({ where: { parentId: null } }),
    prisma.document.count({ where: { parentId: null, createdAt: { gte: todayStart } } }),
    prisma.document.count({ where: { parentId: null, createdAt: { gte: monthStart } } }),
    prisma.user.count({ where: { isActive: true } }),
    prisma.aISession.aggregate({
      _sum: { totalInputTokens: true, totalOutputTokens: true, estimatedCost: true },
      _count: true,
    }),
    prisma.document.groupBy({
      by: ['department'],
      _count: { id: true },
      where: { parentId: null },
      orderBy: { _count: { id: 'desc' } },
    }),
    prisma.user.findMany({
      take: 10,
      include: {
        _count: { select: { documents: true, sessions: true } },
      },
      orderBy: { documents: { _count: 'desc' } },
    }),
    prisma.activity.findMany({
      take: 15,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { name: true } },
        document: { select: { title: true } },
      },
    }),
  ])

  const totalTokens =
    (aiSessions._sum.totalInputTokens || 0) + (aiSessions._sum.totalOutputTokens || 0)

  return {
    totalDocs,
    docsToday,
    docsThisMonth,
    activeUsers,
    totalQueryCount: aiSessions._count,
    totalTokens,
    totalCost: aiSessions._sum.estimatedCost || 0,
    departmentStats,
    topUsers,
    recentActivities,
  }
}

const ACTIVITY_LABELS: Record<string, string> = {
  document_created: 'Doküman oluşturdu',
  document_updated: 'Doküman güncelledi',
  document_exported: 'Doküman dışa aktardı',
  ai_query: 'AI sorgusu yaptı',
  user_registered: 'Sisteme kayıt oldu',
  login: 'Giriş yaptı',
}

export default async function AdminPage() {
  const stats = await getAdminStats()

  return (
    <div className="flex flex-col h-full overflow-auto">
      <Header
        title="🔑 Admin Paneli"
        description="Sistem performansı ve kullanım istatistikleri"
      />

      <div className="flex-1 p-6 space-y-6">
        {/* Üst istatistikler */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Toplam Doküman</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{stats.totalDocs}</p>
                  <p className="text-xs text-gray-400 mt-0.5">Bugün: +{stats.docsToday}</p>
                </div>
                <FileText className="w-8 h-8 text-blue-500 opacity-80" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Aktif Kullanıcı</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{stats.activeUsers}</p>
                  <p className="text-xs text-gray-400 mt-0.5">Sistemde kayıtlı</p>
                </div>
                <Users className="w-8 h-8 text-green-500 opacity-80" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">AI Sorgusu</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{stats.totalQueryCount}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{formatTokens(stats.totalTokens)} token</p>
                </div>
                <MessageSquare className="w-8 h-8 text-purple-500 opacity-80" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Toplam Maliyet</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{formatCost(stats.totalCost)}</p>
                  <p className="text-xs text-gray-400 mt-0.5">Tüm zamanlar</p>
                </div>
                <DollarSign className="w-8 h-8 text-orange-500 opacity-80" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Departman istatistikleri */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Departman Bazlı Doküman Üretimi</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stats.departmentStats.map((dept) => {
                  const percentage = stats.totalDocs > 0
                    ? Math.round((dept._count.id / stats.totalDocs) * 100)
                    : 0
                  return (
                    <div key={dept.department}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-gray-700">
                          {DEPARTMENT_LABELS[dept.department as keyof typeof DEPARTMENT_LABELS]}
                        </span>
                        <span className="text-sm font-medium text-gray-900">
                          {dept._count.id} ({percentage}%)
                        </span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#E87722] rounded-full transition-all"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
                {stats.departmentStats.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-4">Henüz veri yok</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Son aktiviteler */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Son Aktiviteler</CardTitle>
                <Activity className="w-4 h-4 text-gray-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {stats.recentActivities.map((activity) => (
                  <div key={activity.id} className="flex items-start gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#E87722] mt-2 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm text-gray-700">
                        <span className="font-medium">{activity.user.name}</span>{' '}
                        {ACTIVITY_LABELS[activity.type] || activity.type}
                        {activity.document && (
                          <span className="text-gray-500"> — {activity.document.title}</span>
                        )}
                      </p>
                      <p className="text-xs text-gray-400">{formatDateTime(activity.createdAt)}</p>
                    </div>
                  </div>
                ))}
                {stats.recentActivities.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-4">Henüz aktivite yok</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Kullanıcı performansı */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Kullanıcı Performansı</CardTitle>
              <Link href="/admin/kullanicilar">
                <button className="text-sm text-[#E87722] hover:underline">Tümünü Yönet →</button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase">Kullanıcı</th>
                    <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase">Departman</th>
                    <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase">Rol</th>
                    <th className="text-right py-2 px-3 text-xs font-medium text-gray-500 uppercase">Doküman</th>
                    <th className="text-right py-2 px-3 text-xs font-medium text-gray-500 uppercase">AI Sorgusu</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {stats.topUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="py-3 px-3">
                        <div>
                          <p className="font-medium text-gray-900">{user.name}</p>
                          <p className="text-xs text-gray-400">{user.email}</p>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-gray-600">
                        {DEPARTMENT_LABELS[user.department as keyof typeof DEPARTMENT_LABELS]}
                      </td>
                      <td className="py-3 px-3">
                        <Badge variant={user.role === 'ADMIN' ? 'default' : 'secondary'} className="text-xs">
                          {ROLE_LABELS[user.role as keyof typeof ROLE_LABELS]}
                        </Badge>
                      </td>
                      <td className="py-3 px-3 text-right font-medium">{user._count.documents}</td>
                      <td className="py-3 px-3 text-right text-gray-600">{user._count.sessions}</td>
                    </tr>
                  ))}
                  {stats.topUsers.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-gray-400">Kullanıcı bulunamadı</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
