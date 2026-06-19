'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { authStorage } from '@/lib/auth'
import { authApi } from '@/lib/api'
import {
  LayoutDashboard, Map, FileText, Users, Shield,
  LogOut, Building2, ChevronRight,
} from 'lucide-react'

const NAV = [
  { href: '/',       label: 'Хяналтын самбар',  icon: LayoutDashboard },
  { href: '/land',   label: 'Газар чөлөөлөлт',  icon: FileText },
  { href: '/map',    label: 'Газрын зураг',      icon: Map },
  { href: '/users',  label: 'Хэрэглэгчид',       icon: Users },
  { href: '/roles',  label: 'Эрх & Роль',        icon: Shield },
]

export function Sidebar() {
  const pathname = usePathname()
  const router   = useRouter()

  const handleLogout = async () => {
    try { await authApi.logout() } catch {}
    authStorage.clear()
    router.push('/login')
  }

  return (
    <aside
      className="flex h-screen w-64 shrink-0 flex-col"
      style={{ background: 'var(--clr-sidebar)' }}
    >
      {/* Brand */}
      <div className="flex items-center gap-3 px-5 py-5 border-b" style={{ borderColor: 'hsl(var(--sidebar-border))' }}>
        <div
          className="flex h-9 w-9 items-center justify-center rounded-xl"
          style={{ background: 'var(--clr-accent)' }}
        >
          <Building2 className="h-5 w-5 text-white" />
        </div>
        <div>
          <p className="text-[13px] font-bold text-white leading-tight">Газрын Систем</p>
          <p className="text-[11px]" style={{ color: 'hsl(var(--sidebar-foreground))' }}>Удирдлагын самбар</p>
        </div>
      </div>

      {/* Nav group label */}
      <div className="px-5 pt-5 pb-2">
        <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'hsl(220 20% 48%)' }}>
          Үндсэн цэс
        </p>
      </div>

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto px-3 space-y-0.5">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all duration-150',
                active
                  ? 'text-white'
                  : 'text-slate-400 hover:text-white'
              )}
              style={active ? { background: 'var(--clr-accent)' } : {}}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="flex-1">{label}</span>
              {active && <ChevronRight className="h-3 w-3 opacity-60" />}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t" style={{ borderColor: 'hsl(var(--sidebar-border))' }}>
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium text-slate-400 hover:text-white transition-colors"
        >
          <LogOut className="h-4 w-4" />
          <span>Гарах</span>
        </button>
      </div>
    </aside>
  )
}
