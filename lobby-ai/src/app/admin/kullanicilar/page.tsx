import { prisma } from '@/lib/prisma'
import { Header } from '@/components/dashboard/Header'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { DEPARTMENT_LABELS, ROLE_LABELS, formatDateTime } from '@/lib/utils'

async function getUsers() {
  return prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { documents: true, sessions: true } },
    },
  })
}

export default async function KullanicilarPage() {
  const users = await getUsers()

  return (
    <div className="flex flex-col h-full overflow-auto">
      <Header title="👥 Kullanıcı Yönetimi" description={`${users.length} kayıtlı kullanıcı`} />

      <div className="flex-1 p-6">
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase">Kullanıcı</th>
                  <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase">Departman</th>
                  <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase">Rol</th>
                  <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase">Durum</th>
                  <th className="text-right py-3 px-6 text-xs font-medium text-gray-500 uppercase">Doküman</th>
                  <th className="text-right py-3 px-6 text-xs font-medium text-gray-500 uppercase">AI Sorgusu</th>
                  <th className="text-right py-3 px-6 text-xs font-medium text-gray-500 uppercase">Kayıt Tarihi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="py-4 px-6">
                      <div>
                        <p className="font-medium text-gray-900">{user.name}</p>
                        <p className="text-xs text-gray-400">{user.email}</p>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-gray-600">
                      {DEPARTMENT_LABELS[user.department as keyof typeof DEPARTMENT_LABELS]}
                    </td>
                    <td className="py-4 px-6">
                      <Badge
                        variant={user.role === 'ADMIN' ? 'default' : user.role === 'COORDINATOR' ? 'purple' : 'secondary'}
                        className="text-xs"
                      >
                        {ROLE_LABELS[user.role as keyof typeof ROLE_LABELS]}
                      </Badge>
                    </td>
                    <td className="py-4 px-6">
                      <Badge variant={user.isActive ? 'success' : 'destructive'} className="text-xs">
                        {user.isActive ? 'Aktif' : 'Pasif'}
                      </Badge>
                    </td>
                    <td className="py-4 px-6 text-right font-medium">{user._count.documents}</td>
                    <td className="py-4 px-6 text-right text-gray-600">{user._count.sessions}</td>
                    <td className="py-4 px-6 text-right text-xs text-gray-400">
                      {formatDateTime(user.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  )
}
