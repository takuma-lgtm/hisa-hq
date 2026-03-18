'use client'

import {
  Menu,
  Home,
  Target,
  Boxes,
  Package,
  Users,
  LogOut,
  Settings,
  Handshake,
  Search,
  Truck,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import type { UserRole } from '@/types/database'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'

type NavItem = { href: string; label: string; icon: typeof Home; roles: readonly string[] }
type NavSection = { label: string; items: NavItem[] }

const NAV_SECTIONS: NavSection[] = [
  {
    label: '',
    items: [
      { href: '/', label: 'Dashboard', icon: Home, roles: ['owner', 'admin', 'member'] },
    ],
  },
  {
    label: 'Customers',
    items: [
      { href: '/leads', label: 'Leads', icon: Users, roles: ['owner', 'admin', 'member'] },
      { href: '/opportunities', label: 'Opportunities', icon: Target, roles: ['owner', 'admin', 'member'] },
      { href: '/recurring', label: 'Active', icon: Handshake, roles: ['owner', 'admin'] },
    ],
  },
  {
    label: 'Suppliers',
    items: [
      { href: '/suppliers', label: 'Leads', icon: Users, roles: ['owner', 'admin'] },
      { href: '/active-suppliers', label: 'Active', icon: Handshake, roles: ['owner', 'admin'] },
    ],
  },
  {
    label: 'Inventory & Products',
    items: [
      { href: '/logistics', label: 'Logistics', icon: Truck, roles: ['owner', 'admin'] },
      { href: '/inventory', label: 'Inventory', icon: Boxes, roles: ['owner', 'admin', 'member'] },
      { href: '/products', label: 'Products', icon: Package, roles: ['owner', 'admin', 'member'] },
    ],
  },
]

const SETTINGS_ITEM: NavItem = { href: '/settings', label: 'Settings', icon: Settings, roles: ['owner', 'admin'] }

const ROLE_LABELS: Record<UserRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Member',
  closer: 'Member',
  lead_gen: 'Member',
}

const COLLAPSED_WIDTH = 60
const EXPANDED_WIDTH = 240

interface GlassSidebarProps {
  userName: string
  userRole: UserRole
}

export default function GlassSidebar({ userName, userRole }: GlassSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [isExpanded, setIsExpanded] = useState(false)

  const visibleSections = NAV_SECTIONS
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => item.roles.includes(userRole)),
    }))
    .filter((section) => section.items.length > 0)

  const showSettings = SETTINGS_ITEM.roles.includes(userRole)

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const brand = (
    <Link href="/" className="flex items-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/hisa-logo.png"
        alt="HISA Matcha"
        className="shrink-0 h-10 w-auto"
      />
    </Link>
  )

  const brandSmall = (
    <Link href="/" className="flex items-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/hisa-logo.png"
        alt="HISA Matcha"
        className="shrink-0 h-8 w-auto"
      />
    </Link>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className="hidden lg:flex glass-sidebar flex-shrink-0 flex-col h-screen overflow-hidden"
        style={{ width: isExpanded ? EXPANDED_WIDTH : COLLAPSED_WIDTH }}
        onMouseEnter={() => setIsExpanded(true)}
        onMouseLeave={() => setIsExpanded(false)}
      >
        {/* Brand / Search */}
        <div className="h-16 flex items-center justify-center border-b border-[#0A0A0A]/8 px-3">
          {isExpanded ? (
            <button
              className="flex items-center gap-2 w-full px-3 py-2 rounded-lg bg-[#0A0A0A]/5 hover:bg-[#0A0A0A]/8 transition-colors cursor-text"
              onClick={() => window.dispatchEvent(new CustomEvent('open-search'))}
            >
              <Search size={14} className="text-[#0A0A0A]/30 shrink-0" />
              <span className="text-sm text-[#0A0A0A]/30">Search…</span>
            </button>
          ) : (
            brand
          )}
        </div>

        {/* Nav */}
        <nav className={cn('flex-1 py-4', isExpanded ? 'px-3' : 'px-0 flex flex-col items-center')}>
          {visibleSections.map((section, sectionIdx) => {
            const visibleItems = section.items
            return (
              <div key={section.label || `section-${sectionIdx}`} className={sectionIdx > 0 ? 'mt-4' : ''}>
                {sectionIdx > 0 && (
                  isExpanded ? (
                    <div className="border-t border-dashed border-[#0A0A0A]/10 mb-2" />
                  ) : (
                    <div className="mx-2 border-t border-[#0A0A0A]/20 mb-2" />
                  )
                )}
                {isExpanded && section.label && (
                  <p className="text-[11px] tracking-widest text-[#0A0A0A]/45 uppercase font-medium px-2 mb-1">
                    {section.label}
                  </p>
                )}
                <div className="space-y-1">
                  {visibleItems.map(({ href, label, icon: Icon }) => {
                    const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href)
                    return (
                      <Link
                        key={href}
                        href={href}
                        className={cn(
                          'glass-sidebar-link overflow-hidden whitespace-nowrap',
                          isActive && 'active',
                          !isExpanded && 'w-10 h-10 justify-center p-0 rounded-lg',
                        )}
                        title={!isExpanded ? label : undefined}
                      >
                        <Icon size={18} className="shrink-0" />
                        {isExpanded && <span>{label}</span>}
                      </Link>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </nav>

        {/* User section */}
        <div className={cn('py-4 border-t border-[#0A0A0A]/8', isExpanded ? 'px-3' : 'px-0 flex flex-col items-center')}>
          <div className={cn('flex items-center mb-3', isExpanded ? 'gap-3' : 'justify-center')}>
            <div className="w-9 h-9 rounded-full bg-[#2D5A3D]/10 flex items-center justify-center shrink-0 ring-2 ring-[#2D5A3D]/20">
              <span className="text-[#2D5A3D] text-sm font-semibold">
                {userName.charAt(0).toUpperCase()}
              </span>
            </div>
            {isExpanded && (
              <div className="min-w-0">
                <p className="text-sm font-medium text-[#0A0A0A] truncate">{userName}</p>
                <p className="text-xs text-[#0A0A0A]/40">{ROLE_LABELS[userRole]}</p>
              </div>
            )}
          </div>
          {showSettings && (
            <Link
              href="/settings"
              className={cn(
                'glass-sidebar-link overflow-hidden whitespace-nowrap mb-1',
                pathname.startsWith('/settings') && 'active',
                !isExpanded && 'w-10 h-10 justify-center p-0 rounded-lg',
              )}
              title={!isExpanded ? 'Settings' : undefined}
            >
              <Settings size={18} className="shrink-0" />
              {isExpanded && <span>Settings</span>}
            </Link>
          )}
          <button
            onClick={handleSignOut}
            className={cn(
              'glass-sidebar-link text-[#0A0A0A]/40 hover:text-red-500 overflow-hidden whitespace-nowrap',
              isExpanded ? 'w-full' : 'w-10 h-10 justify-center p-0 rounded-lg',
            )}
            title={!isExpanded ? 'Sign out' : undefined}
          >
            <LogOut size={16} className="shrink-0" />
            {isExpanded && <span>Sign out</span>}
          </button>
        </div>
      </aside>

      {/* Mobile top bar + sheet */}
      <div className="lg:hidden fixed top-0 inset-x-0 z-30 glass-sidebar h-14 flex items-center justify-between px-4">
        {brandSmall}
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="text-[#0A0A0A]/60 hover:text-[#0A0A0A] hover:bg-[#0A0A0A]/5">
              <Menu className="size-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0 glass-sidebar border-r-0">
            <SheetHeader className="h-16 flex items-center px-4 border-b border-[#0A0A0A]/8">
              <SheetTitle>{brandSmall}</SheetTitle>
            </SheetHeader>
            <div className="flex flex-col flex-1 overflow-y-auto">
              <nav className="flex-1 px-3 py-4">
                {visibleSections.map((section, sectionIdx) => (
                  <div key={section.label || `section-${sectionIdx}`} className={sectionIdx > 0 ? 'mt-4' : ''}>
                    {sectionIdx > 0 && (
                      <div className="border-t border-dashed border-[#0A0A0A]/10 mb-2" />
                    )}
                    {section.label && (
                      <p className="text-[11px] tracking-widest text-[#0A0A0A]/45 uppercase font-medium px-2 mb-1">
                        {section.label}
                      </p>
                    )}
                    <div className="space-y-1">
                      {section.items.map(({ href, label, icon: Icon }) => {
                        const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href)
                        return (
                          <Link
                            key={href}
                            href={href}
                            className={cn('glass-sidebar-link', isActive && 'active')}
                          >
                            <Icon size={18} />
                            <span>{label}</span>
                          </Link>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </nav>
              <div className="px-3 py-4 border-t border-[#0A0A0A]/8">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-full bg-[#2D5A3D]/10 flex items-center justify-center shrink-0 ring-2 ring-[#2D5A3D]/20">
                    <span className="text-[#2D5A3D] text-sm font-semibold">
                      {userName.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#0A0A0A] truncate">{userName}</p>
                    <p className="text-xs text-[#0A0A0A]/40">{ROLE_LABELS[userRole]}</p>
                  </div>
                </div>
                {showSettings && (
                  <Link
                    href="/settings"
                    className={cn('glass-sidebar-link mb-1', pathname.startsWith('/settings') && 'active')}
                  >
                    <Settings size={18} />
                    <span>Settings</span>
                  </Link>
                )}
                <button
                  onClick={handleSignOut}
                  className="glass-sidebar-link w-full text-[#0A0A0A]/40 hover:text-red-500"
                >
                  <LogOut size={16} />
                  <span>Sign out</span>
                </button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  )
}
