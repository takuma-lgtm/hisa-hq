'use client'

import { Menu, LayoutDashboard, KanbanSquare, RefreshCw, Warehouse, Package, Inbox, LogOut, Settings } from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import type { UserRole } from "@/types/database"

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'closer', 'lead_gen'] },
  { href: '/leads', label: 'Leads', icon: Inbox, roles: ['admin', 'closer', 'lead_gen'] },
  { href: '/opportunities', label: 'Opportunities', icon: KanbanSquare, roles: ['admin', 'closer', 'lead_gen'] },
  { href: '/recurring', label: 'Recurring', icon: RefreshCw, roles: ['admin', 'closer'] },
  { href: '/products', label: 'Products', icon: Package, roles: ['admin', 'closer', 'lead_gen'] },
  { href: '/inventory', label: 'Inventory', icon: Warehouse, roles: ['admin', 'closer', 'lead_gen'] },
  { href: '/settings', label: 'Settings', icon: Settings, roles: ['admin'] },
] as const

const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admin',
  closer: 'Closer',
  lead_gen: 'Lead Gen',
}

interface NavbarProps {
  userName: string
  userRole: UserRole
}

export default function Navbar({ userName, userRole }: NavbarProps) {
  const pathname = usePathname()
  const router = useRouter()

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
    <header className="border-b border-border bg-background">
      <div className="px-4 lg:px-6">
        {/* Desktop navbar */}
        <nav className="hidden h-14 items-center justify-between lg:flex">
          <div className="flex items-center gap-6">
            {/* Brand */}
            <Link href="/" className="flex items-center gap-2">
              <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-green-700 shrink-0">
                <span className="text-white text-xs font-bold">H</span>
              </div>
              <span className="text-sm font-semibold text-foreground">HISA Matcha</span>
            </Link>

            {/* Nav links */}
            <NavigationMenu>
              <NavigationMenuList>
                {visibleItems.map(({ href, label, icon: Icon }) => {
                  const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href)
                  return (
                    <NavigationMenuItem key={href}>
                      <NavigationMenuLink asChild>
                        <Link
                          href={href}
                          className={cn(
                            "group inline-flex h-9 w-max items-center justify-center rounded-md px-3 py-2 text-sm font-medium transition-colors",
                            isActive
                              ? "bg-green-50 text-green-800"
                              : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                          )}
                        >
                          <Icon size={16} className={cn("mr-1.5", isActive ? "text-green-700" : "text-muted-foreground")} />
                          {label}
                        </Link>
                      </NavigationMenuLink>
                    </NavigationMenuItem>
                  )
                })}
              </NavigationMenuList>
            </NavigationMenu>
          </div>

          {/* User section */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                <span className="text-green-800 text-xs font-semibold">
                  {userName.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="text-sm">
                <span className="font-medium text-foreground">{userName}</span>
                <span className="text-muted-foreground ml-1.5 text-xs">({ROLE_LABELS[userRole]})</span>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={handleSignOut} className="text-muted-foreground">
              <LogOut size={16} className="mr-1.5" />
              Sign out
            </Button>
          </div>
        </nav>

        {/* Mobile navbar */}
        <div className="flex h-14 items-center justify-between lg:hidden">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-green-700 shrink-0">
              <span className="text-white text-xs font-bold">H</span>
            </div>
            <span className="text-sm font-semibold text-foreground">HISA Matcha</span>
          </Link>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon">
                <Menu className="size-4" />
              </Button>
            </SheetTrigger>
            <SheetContent className="overflow-y-auto">
              <SheetHeader>
                <SheetTitle>
                  <Link href="/" className="flex items-center gap-2">
                    <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-green-700 shrink-0">
                      <span className="text-white text-xs font-bold">H</span>
                    </div>
                    <span className="text-sm font-semibold">HISA Matcha</span>
                  </Link>
                </SheetTitle>
              </SheetHeader>
              <div className="my-6 flex flex-col gap-6">
                {/* Mobile nav links */}
                <div className="flex flex-col gap-1">
                  {visibleItems.map(({ href, label, icon: Icon }) => {
                    const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href)
                    return (
                      <Link
                        key={href}
                        href={href}
                        className={cn(
                          "flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                          isActive
                            ? "bg-green-50 text-green-800"
                            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                        )}
                      >
                        <Icon size={16} className={isActive ? "text-green-700" : "text-muted-foreground"} />
                        {label}
                      </Link>
                    )
                  })}
                </div>

                {/* Mobile user section */}
                <div className="border-t pt-4">
                  <div className="flex items-center gap-2.5 px-3 mb-3">
                    <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                      <span className="text-green-800 text-xs font-semibold">
                        {userName.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{userName}</p>
                      <p className="text-xs text-muted-foreground">{ROLE_LABELS[userRole]}</p>
                    </div>
                  </div>
                  <Button variant="outline" className="w-full" onClick={handleSignOut}>
                    <LogOut size={16} className="mr-1.5" />
                    Sign out
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}
