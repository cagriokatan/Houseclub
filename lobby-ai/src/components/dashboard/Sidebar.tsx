'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import {
  Home,
  Newspaper,
  Handshake,
  PartyPopper,
  BarChart3,
  FileText,
  Building2,
  MessageSquare,
  Settings,
  Shield,
  LogOut,
  ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

interface SidebarProps {
  user: {
    name: string
    email: string
    role: string
    department: string
    avatar?: string
  }
}

const mainNavItems = [
  { href: '/', label: 'Ana Sayfa', icon: Home },
  { href: '/medya', label: 'Medya İlişkileri', icon: Newspaper },
  { href: '/musteri', label: 'Müşteri İlişkileri', icon: Handshake },
  { href: '/etkinlik', label: 'Etkinlik', icon: PartyPopper },
  { href: '/raporlama', label: 'Raporlama', icon: BarChart3 },
]

const secondaryNavItems = [
  { href: '/dokuman', label: 'Dokümanlarım', icon: FileText },
  { href: '/musteriler', label: 'Müşteriler', icon: Building2 },
  { href: '/asistan', label: 'AI Asistan', icon: MessageSquare },
]

const bottomNavItems = [
  { href: '/ayarlar', label: 'Ayarlar', icon: Settings },
]

function NavItem({ href, label, icon: Icon }: { href: string; label: string; icon: any }) {
  const pathname = usePathname()
  const isActive = pathname === href || (href !== '/' && pathname.startsWith(href))

  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group',
        isActive
          ? 'bg-[#E87722] text-white shadow-sm'
          : 'text-gray-300 hover:bg-white/10 hover:text-white'
      )}
    >
      <Icon className="w-4 h-4 shrink-0" />
      <span>{label}</span>
      {isActive && <ChevronRight className="w-3 h-3 ml-auto" />}
    </Link>
  )
}

export function Sidebar({ user }: SidebarProps) {
  const initials = user.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <aside className="w-64 bg-[#1B2A4A] flex flex-col h-full">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[#E87722] rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">L</span>
          </div>
          <div>
            <p className="text-white font-bold text-sm leading-none">LOBBY</p>
            <p className="text-white/50 text-xs">AI Asistan</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {/* Ana menü */}
        <div className="space-y-1">
          {mainNavItems.map((item) => (
            <NavItem key={item.href} {...item} />
          ))}
        </div>

        {/* Ayraç */}
        <div className="my-3 border-t border-white/10" />

        {/* İkincil menü */}
        <div className="space-y-1">
          {secondaryNavItems.map((item) => (
            <NavItem key={item.href} {...item} />
          ))}
        </div>

        {/* Ayraç */}
        <div className="my-3 border-t border-white/10" />

        {/* Alt menü */}
        <div className="space-y-1">
          {bottomNavItems.map((item) => (
            <NavItem key={item.href} {...item} />
          ))}
          {(user.role === 'ADMIN' || user.role === 'COORDINATOR') && (
            <NavItem href="/admin" label="Admin Paneli" icon={Shield} />
          )}
        </div>
      </nav>

      {/* Kullanıcı profili */}
      <div className="px-3 py-4 border-t border-white/10">
        <div className="flex items-center gap-3 px-2 py-2 rounded-lg">
          <Avatar className="w-8 h-8">
            {user.avatar && <AvatarImage src={user.avatar} alt={user.name} />}
            <AvatarFallback className="text-xs bg-[#E87722]">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium truncate">{user.name}</p>
            <p className="text-white/50 text-xs truncate">{user.email}</p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="text-white/50 hover:text-white transition-colors p-1 rounded"
            title="Çıkış Yap"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  )
}
