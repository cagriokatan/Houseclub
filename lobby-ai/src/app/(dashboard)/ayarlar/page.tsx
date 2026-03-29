import { auth } from '@/lib/auth'
import { Header } from '@/components/dashboard/Header'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { DEPARTMENT_LABELS, ROLE_LABELS } from '@/lib/utils'

export default async function AyarlarPage() {
  const session = await auth()
  if (!session?.user) return null

  const initials = (session.user.name || 'K')
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <div className="flex flex-col h-full overflow-auto">
      <Header title="⚙️ Ayarlar" description="Hesap ve uygulama ayarları" />

      <div className="flex-1 p-6 space-y-6 max-w-2xl">
        {/* Profil */}
        <Card>
          <CardHeader>
            <CardTitle>Profil Bilgileri</CardTitle>
            <CardDescription>Hesap bilgileriniz</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-[#1B2A4A] rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-xl">{initials}</span>
              </div>
              <div>
                <p className="font-semibold text-gray-900">{session.user.name}</p>
                <p className="text-sm text-gray-500">{session.user.email}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Departman</p>
                <p className="text-sm text-gray-900 mt-1">
                  {DEPARTMENT_LABELS[session.user.department as keyof typeof DEPARTMENT_LABELS] || session.user.department}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Rol</p>
                <div className="mt-1">
                  <Badge variant={session.user.role === 'ADMIN' ? 'default' : 'secondary'}>
                    {ROLE_LABELS[session.user.role as keyof typeof ROLE_LABELS] || session.user.role}
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Uygulama bilgisi */}
        <Card>
          <CardHeader>
            <CardTitle>Uygulama Bilgisi</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Uygulama Versiyonu</span>
              <span className="text-sm font-medium text-gray-900">1.0.0</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">AI Modeli</span>
              <span className="text-sm font-medium text-gray-900">Claude Sonnet 4.6</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Desteklenen Departmanlar</span>
              <span className="text-sm font-medium text-gray-900">4</span>
            </div>
          </CardContent>
        </Card>

        {/* Güvenlik notu */}
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-6">
            <p className="text-sm text-amber-700">
              <strong>Güvenlik Notu:</strong> Bu uygulama sadece @lobby-pr.com e-posta adresleriyle
              erişilebilir. Claude API anahtarınız güvenli sunucu ortamında saklanmaktadır ve
              hiçbir zaman tarayıcınıza aktarılmaz.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
