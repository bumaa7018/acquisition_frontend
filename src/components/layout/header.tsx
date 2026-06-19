'use client'
import { usePathname } from 'next/navigation'
import { authStorage } from '@/lib/auth'
import { Bell, Search, User, ChevronRight } from 'lucide-react'

const TITLES: Record<string, string> = {
  '/':      'Хяналтын самбар',
  '/land':  'Газар чөлөөлөлт',
  '/map':   'Газрын зураг',
  '/users': 'Хэрэглэгчид',
  '/roles': 'Эрх & Роль',
}

export function Header() {
  const pathname = usePathname()
  const user  = authStorage.getUser()

  const title = Object.entries(TITLES)
    .find(([k]) => k === '/' ? pathname === '/' : pathname.startsWith(k))?.[1] ?? 'Систем'

  const initials = user?.first_name
    ? `${user.first_name[0]}${user.last_name?.[0] ?? ''}`.toUpperCase()
    : null

  return (
    <header className="flex h-16 shrink-0 items-center justify-between bg-white border-b border-slate-200 px-6"
      style={{ boxShadow: '0 1px 4px rgba(31,45,88,0.06)' }}>

      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-400">Нүүр</span>
        <ChevronRight className="h-3 w-3 text-slate-300" />
        <span className="text-xs font-semibold text-slate-700">{title}</span>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-2">
        <button className="flex h-9 w-9 items-center justify-center rounded-xl hover:bg-slate-100 transition-colors">
          <Search className="h-4 w-4 text-slate-500" />
        </button>

        <button className="relative flex h-9 w-9 items-center justify-center rounded-xl hover:bg-slate-100 transition-colors">
          <Bell className="h-4 w-4 text-slate-500" />
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
        </button>

        <div className="mx-1 h-6 w-px bg-slate-200" />

        <button className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 hover:bg-slate-100 transition-colors">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-xl text-white text-xs font-bold"
            style={{ background: 'var(--clr-accent)' }}
          >
            {initials ?? <User className="h-4 w-4" />}
          </div>
          {user && (
            <div className="hidden sm:block text-left">
              <p className="text-[12px] font-semibold text-slate-700 leading-tight">
                {user.first_name} {user.last_name}
              </p>
              <p className="text-[10px] text-slate-400 leading-tight">{user.email}</p>
            </div>
          )}
        </button>
      </div>
    </header>
  )
}
