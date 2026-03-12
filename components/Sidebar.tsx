'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import type { UserRole } from '@/types/database'
import {
  LayoutDashboard,
  KanbanSquare,
  Users,
  RefreshCw,
  Package,
  LogOut,
  Inbox,
} from 'lucide-react'

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'closer', 'lead_gen'] },
  { href: '/leads', label: 'Leads', icon: Inbox, roles: ['admin', 'closer', 'lead_gen'] },
  { href: '/opportunities', label: 'Opportunities', icon: KanbanSquare, roles: ['admin', 'closer', 'lead_gen'] },
  { href: '/customers', label: 'Customers', icon: Users, roles: ['admin', 'closer', 'lead_gen'] },
  { href: '/recurring', label: 'Recurring', icon: RefreshCw, roles: ['admin', 'closer'] },
  { href: '/products', label: 'Products', icon: Package, roles: ['admin', 'closer', 'lead_gen'] },
] as const

const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admin',
  closer: 'Closer',
  lead_gen: 'Lead Gen',
}

interface SidebarProps {
  userName: string
  userRole: UserRole
}

export default function Sidebar({ userName, userRole }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const visibleItems = NAV_ITEMS.filter((item) =>
    (item.roles as readonly string[]).includes(userRole),
  )

  return (
    <aside className="w-56 flex flex-col border-r border-slate-200 bg-slate-50 shrink-0">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-4 py-5 border-b border-slate-200">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-green-700 shrink-0">
          <span className="text-white text-sm font-bold">H</span>
        </div>
        <span className="text-sm font-semibold text-slate-800">HISA Matcha</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {visibleItems.map(({ href, label, icon: Icon }) => {
          const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-green-50 text-green-800'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
              )}
            >
              <Icon
                size={16}
                className={isActive ? 'text-green-700' : 'text-slate-400'}
              />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* User / sign-out */}
      <div className="border-t border-slate-200 px-3 py-3">
        <div className="flex items-center gap-2.5 mb-2 px-1">
          <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center shrink-0">
            <span className="text-green-800 text-xs font-semibold">
              {userName.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-800 truncate">{userName}</p>
            <p className="text-xs text-slate-400">{ROLE_LABELS[userRole]}</p>
          </div>
        </div>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
        >
          <LogOut size={13} />
          Sign out
        </button>
      </div>
    </aside>
  )
}
