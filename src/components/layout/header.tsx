'use client'
import { usePathname } from 'next/navigation'
import { authStorage } from '@/lib/auth'
import { Bell, User } from 'lucide-react'

const titles: Record<string, string> = {
  '/': 'Хяналтын самбар',
  '/land': 'Газар чөлөөлөлт',
  '/map': 'Газрын зураг',
  '/users': 'Хэрэглэгчид',
  '/roles': 'Эрх & Роль',
}

export function Header() {
  const pathname = usePathname()
  const user = authStorage.getUser()
  const title = Object.entries(titles).find(([k]) => k === '/' ? pathname === '/' : pathname.startsWith(k))?.[1] ?? 'Систем'

  return (
    <header className="flex h-16 items-center justify-between border-b bg-background px-6">
      <h1 className="text-lg font-semibold">{title}</h1>
      <div className="flex items-center gap-4">
        <button className="relative p-2 rounded-lg hover:bg-muted transition-colors">
          <Bell className="h-5 w-5 text-muted-foreground" />
        </button>
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold">
            {user?.first_name?.[0] ?? <User className="h-4 w-4" />}
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-medium">{user?.first_name} {user?.last_name}</p>
            <p className="text-xs text-muted-foreground">{user?.email}</p>
          </div>
        </div>
      </div>
    </header>
  )
}
