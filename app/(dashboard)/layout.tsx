import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import GlassSidebar from '@/components/GlassSidebar'
import type { UserRole } from '@/types/database'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('name, role')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')

  return (
    <div className="flex h-screen overflow-hidden">
      <GlassSidebar userName={profile.name} userRole={profile.role as UserRole} />
      <main className="flex-1 flex flex-col min-w-0 overflow-auto lg:ml-0 mt-14 lg:mt-0 bg-background">
        {children}
      </main>
    </div>
  )
}
