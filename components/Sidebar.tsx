'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import type { UserRole } from '@/types/database'
import {
  Sidebar,
  SidebarBody,
  SidebarLink,
  useSidebar,
} from '@/components/ui/sidebar'
import {
  LayoutDashboard,
  KanbanSquare,
  RefreshCw,
  Package,
  LogOut,
  Inbox,
} from 'lucide-react'

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'closer', 'lead_gen'] },
  { href: '/leads', label: 'Leads', icon: Inbox, roles: ['admin', 'closer', 'lead_gen'] },
  { href: '/opportunities', label: 'Opportunities', icon: KanbanSquare, roles: ['admin', 'closer', 'lead_gen'] },
  { href: '/recurring', label: 'Recurring', icon: RefreshCw, roles: ['admin', 'closer'] },
  { href: '/products', label: 'Products', icon: Package, roles: ['admin', 'closer', 'lead_gen'] },
] as const

interface SidebarProps {
  userName: string
  userRole: UserRole
}

export default function AppSidebar({ userName, userRole }: SidebarProps) {
  const [open, setOpen] = useState(false)

  return (
    <Sidebar open={open} setOpen={setOpen}>
      <SidebarBody className="justify-between gap-10 border-r border-slate-200 bg-slate-50">
        <SidebarContent userName={userName} userRole={userRole} />
      </SidebarBody>
    </Sidebar>
  )
}

function SidebarContent({ userName, userRole }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { open } = useSidebar()

  const visibleItems = NAV_ITEMS.filter((item) =>
    (item.roles as readonly string[]).includes(userRole),
  )

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <>
      {/* Top section: brand + nav */}
      <div className="flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
        {/* Brand */}
        {open ? <Logo /> : <LogoIcon />}

        {/* Navigation */}
        <div className="mt-8 flex flex-col gap-1">
          {visibleItems.map(({ href, label, icon: Icon }) => {
            const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href)
            return (
              <SidebarLink
                key={href}
                link={{
                  label,
                  href,
                  icon: (
                    <Icon
                      size={18}
                      className={cn(
                        'flex-shrink-0',
                        isActive ? 'text-green-700' : 'text-slate-400',
                      )}
                    />
                  ),
                }}
                className={cn(
                  'rounded-lg px-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-green-50 text-green-800'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                )}
              />
            )
          })}
        </div>
      </div>

      {/* Bottom section: user + sign-out */}
      <div className="border-t border-slate-200 pt-3">
        {/* User profile */}
        <SidebarLink
          link={{
            label: userName,
            href: '#',
            icon: (
              <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                <span className="text-green-800 text-xs font-semibold">
                  {userName.charAt(0).toUpperCase()}
                </span>
              </div>
            ),
          }}
          className="px-2"
        />

        {/* Sign out */}
        <button
          onClick={handleSignOut}
          className="flex items-center gap-2 w-full px-2 py-2 rounded-lg text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
        >
          <LogOut size={18} className="flex-shrink-0 text-slate-400" />
          <motion.span
            animate={{
              display: open ? 'inline-block' : 'none',
              opacity: open ? 1 : 0,
            }}
            className="text-sm whitespace-pre"
          >
            Sign out
          </motion.span>
        </button>
      </div>
    </>
  )
}

function Logo() {
  return (
    <Link
      href="/"
      className="flex items-center gap-2.5 py-1 relative z-20"
    >
      <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-green-700 flex-shrink-0">
        <span className="text-white text-xs font-bold">H</span>
      </div>
    </Link>
  )
}

function LogoIcon() {
  return (
    <Link
      href="/"
      className="flex items-center gap-2.5 py-1 relative z-20"
    >
      <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-green-700 flex-shrink-0">
        <span className="text-white text-xs font-bold">H</span>
      </div>
    </Link>
  )
}
