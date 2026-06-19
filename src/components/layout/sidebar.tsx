'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { authStorage } from '@/lib/auth'
import { authApi } from '@/lib/api'
import {
  LayoutDashboard, Map, FileText, Users, Shield,
  LogOut, ChevronRight, Building2,
} from 'lucide-react'

const navItems = [
  { href: '/', label: 'Хяналтын самбар', icon: LayoutDashboard },
  { href: '/land', label: 'Газар чөлөөлөлт', icon: FileText },
  { href: '/map', label: 'Газрын зураг', icon: Map },
  { href: '/users', label: 'Хэрэглэгчид', icon: Users },
  { href: '/roles', label: 'Эрх & Роль', icon: Shield },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()

  const handleLogout = async () => {
    try { await authApi.logout() } catch {}
    authStorage.clear()
    router.push('/login')
  }

  return (
    <aside className="flex h-screen w-64 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
      <div className="flex items-center gap-3 px-6 py-5 border-b border-sidebar-border">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary">
          <Building2 className="h-5 w-5 text-sidebar-primary-foreground" />
        </div>
        <div>
          <p className="text-sm font-semibold leading-tight">Газрын Систем</p>
          <p className="text-xs text-sidebar-foreground/60">Удирдлагын самбар</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href)
          return (
            <Link key={href} href={href} className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
              active
                ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
            )}>
              <Icon className="h-4 w-4 shrink-0" />
              <span className="flex-1">{label}</span>
              {active && <ChevronRight className="h-3.5 w-3.5 opacity-60" />}
            </Link>
          )
        })}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <button onClick={handleLogout} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors">
          <LogOut className="h-4 w-4" />
          <span>Гарах</span>
        </button>
      </div>
    </aside>
  )
}
