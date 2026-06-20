'use client'
import { usePathname, useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { authStorage } from '@/lib/auth'
import { authApi } from '@/lib/api'
import { Bell, Search, User, ChevronRight, Menu, Settings, Moon, Sun, LogOut, UserCircle } from 'lucide-react'

const TITLES: Record<string, { greeting: string; crumb: string }> = {
  '/':                { greeting: 'Тавтай морилно уу!',   crumb: 'Хяналтын самбар'    },
  '/acquisition':            { greeting: 'Газар чөлөөлөлт',      crumb: 'Газар чөлөөлөлт'   },
  '/map':             { greeting: 'Газрын зураг',          crumb: 'Газрын зураг'       },
  '/compensation/create': { greeting: 'Нэхэмжлэл үүсгэх',    crumb: 'Нэхэмжлэл үүсгэх'  },
  '/compensation':        { greeting: 'Нэхэмжлэл',            crumb: 'Нэхэмжлэл'          },
  '/users':           { greeting: 'Хэрэглэгчид',          crumb: 'Хэрэглэгчид'        },
  '/roles':           { greeting: 'Эрх & Роль',           crumb: 'Эрх & Роль'         },
}

function resolveTitle(pathname: string) {
  const sorted = Object.entries(TITLES).sort((a, b) => b[0].length - a[0].length)
  return (
    sorted.find(([k]) => (k === '/' ? pathname === '/' : pathname.startsWith(k)))?.[1] ??
    { greeting: 'Систем', crumb: 'Систем' }
  )
}

export function Header() {
  const pathname = usePathname()
  const router = useRouter()
  const user = authStorage.getUser()
  const { greeting, crumb } = resolveTitle(pathname)
  const { resolvedTheme, setTheme } = useTheme()
  const [profileOpen, setProfileOpen] = useState(false)
  const profileRef = useRef<HTMLDivElement>(null)

  const initials = user?.first_name
    ? `${user.first_name[0]}${user.last_name?.[0] ?? ''}`.toUpperCase()
    : null

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const handleLogout = async () => {
    try { await authApi.logout() } catch {}
    authStorage.clear()
    router.push('/login')
  }

  return (
    <header
      className="flex h-[85px] shrink-0 items-center gap-3 bg-white dark:bg-[#1e1f27] border-b border-slate-200/80 dark:border-[#37394d] px-6"
      style={{ boxShadow: '0 0 35px 0 rgba(154,161,171,.15)' }}
    >
      {/* Page title + breadcrumb */}
      <div className="min-w-0">
        <p className="text-[15px] font-bold text-slate-800 dark:text-white leading-tight truncate">{greeting}</p>
        <div className="flex items-center gap-1 mt-0.5">
          <span className="text-[11px] text-slate-400 dark:text-slate-500">Газрын Систем</span>
          <ChevronRight className="h-2.5 w-2.5 text-slate-300 dark:text-slate-600" />
          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">{crumb}</span>
        </div>
      </div>

      <div className="flex-1" />

      {/* Search */}
      <div className="relative hidden md:block">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500 pointer-events-none" />
        <input
          placeholder="Хайлт..."
          className="h-9 w-48 rounded-lg border border-slate-200 dark:border-[#37394d] border-solid bg-slate-50/80 dark:bg-[#1e1f27] pl-9 pr-3 text-[13px] text-slate-700 dark:text-slate-300 placeholder:text-slate-400 dark:placeholder:text-slate-600 outline-none focus:border-[#02c0ce] focus:bg-white dark:focus:bg-[#252630] focus:ring-2 focus:ring-[#02c0ce]/15 transition-all"
        />
      </div>

      {/* Icon row */}
      <div className="flex items-center gap-0.5">

        <button
          onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-[#252630] transition-colors"
          title={resolvedTheme === 'dark' ? 'Цайвар горим' : 'Харанхуй горим'}
        >
          {resolvedTheme === 'dark'
            ? <Sun  className="h-4 w-4" />
            : <Moon className="h-4 w-4" />
          }
        </button>

        <div className="mx-1.5 h-5 w-px bg-slate-200 dark:bg-[#37394d]" />

        {/* User dropdown */}
        <div className="relative" ref={profileRef}>
          <button
            onClick={() => setProfileOpen(v => !v)}
            className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-slate-100 dark:hover:bg-[#252630] transition-colors"
          >
            <div
              className="flex h-8 w-8 items-center justify-center rounded-full text-white text-[11px] font-bold shrink-0"
              style={{ background: '#02c0ce' }}
            >
              {initials ?? <User className="h-4 w-4" />}
            </div>
            {user && (
              <div className="hidden sm:block text-left">
                <p className="text-[12px] font-semibold text-slate-700 dark:text-slate-200 leading-tight">
                  {user.first_name} {user.last_name}
                </p>
              </div>
            )}
            <ChevronRight className={`h-3 w-3 text-slate-400 dark:text-slate-500 transition-transform ${profileOpen ? '-rotate-90' : 'rotate-90'}`} />
          </button>

          {profileOpen && (
            <div className="absolute right-0 top-[calc(100%+8px)] w-56 rounded-xl bg-white dark:bg-[#1e1f27] border border-solid border-slate-200 dark:border-[#37394d] overflow-hidden z-50"
              style={{ boxShadow: '0 0 35px 0 rgba(154,161,171,.2)' }}
            >
              {/* User info */}
              <div className="px-4 py-3.5 border-b border-solid border-slate-100 dark:border-[#37394d] dark:bg-[#252630]">
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white text-[12px] font-bold"
                    style={{ background: '#02c0ce' }}
                  >
                    {initials ?? <User className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-slate-800 dark:text-white truncate">
                      {user?.first_name} {user?.last_name}
                    </p>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate mt-0.5">
                      {user?.email}
                    </p>
                  </div>
                </div>
              </div>

              {/* Menu items */}
              <div className="py-1.5">
                <Link
                  href="/users"
                  onClick={() => setProfileOpen(false)}
                  className="flex w-full items-center gap-3 px-4 py-2 text-[13px] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#252630] transition-colors"
                >
                  <UserCircle className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                  Профайл
                </Link>
                <Link
                  href="/roles"
                  onClick={() => setProfileOpen(false)}
                  className="flex w-full items-center gap-3 px-4 py-2 text-[13px] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#252630] transition-colors"
                >
                  <Settings className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                  Тохиргоо
                </Link>
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-3 px-4 py-2 text-[13px] text-[#f1556c] hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  Гарах
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
