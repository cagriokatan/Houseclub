import { prisma } from '@/lib/prisma'
import { Header } from '@/components/dashboard/Header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { DEPARTMENT_LABELS } from '@/lib/utils'

async function getTemplates() {
  return prisma.template.findMany({
    orderBy: [{ department: 'asc' }, { name: 'asc' }],
    include: {
      _count: { select: { documents: true } },
    },
  })
}

export default async function SablonlarPage() {
  const templates = await getTemplates()

  const byDepartment = templates.reduce(
    (acc, t) => {
      if (!acc[t.department]) acc[t.department] = []
      acc[t.department].push(t)
      return acc
    },
    {} as Record<string, typeof templates>
  )

  return (
    <div className="flex flex-col h-full overflow-auto">
      <Header title="📋 Şablon Yönetimi" description={`${templates.length} aktif şablon`} />

      <div className="flex-1 p-6 space-y-6">
        {Object.entries(byDepartment).map(([dept, deptTemplates]) => (
          <div key={dept}>
            <h2 className="text-base font-semibold text-gray-900 mb-3">
              {DEPARTMENT_LABELS[dept as keyof typeof DEPARTMENT_LABELS]}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {deptTemplates.map((template) => (
                <Card key={template.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm">{template.name}</CardTitle>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">
                          {template.outputFormat.toUpperCase()}
                        </Badge>
                        <Badge variant={template.isActive ? 'success' : 'destructive'} className="text-xs">
                          {template.isActive ? 'Aktif' : 'Pasif'}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div>
                        <p className="text-xs font-medium text-gray-500">Kategori</p>
                        <p className="text-xs text-gray-700 capitalize">{template.category}</p>
                      </div>
                      {template.variables.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-gray-500">Değişkenler</p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {template.variables.map((v) => (
                              <span key={v} className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                                {'{{'}{v}{'}}'}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                        <span className="text-xs text-gray-400">
                          {template._count.documents} kez kullanıldı
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}

        {templates.length === 0 && (
          <div className="text-center py-16 text-gray-400">Şablon bulunamadı</div>
        )}
      </div>
    </div>
  )
}
