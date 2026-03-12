import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { UserRole } from '@/types/database'
import LeadDetailClient from './LeadDetailClient'

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: profile }, { data: lead }, { data: profiles }] = await Promise.all([
    supabase.from('profiles').select('role').eq('id', user.id).single(),
    supabase.from('customers').select('*').eq('customer_id', id).single(),
    supabase.from('profiles').select('id, name').order('name'),
  ])

  if (!lead || lead.status !== 'lead') notFound()

  const role = (profile?.role ?? 'lead_gen') as UserRole
  const canEdit = role === 'admin' || role === 'lead_gen'

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <LeadDetailClient
        lead={lead}
        profiles={profiles ?? []}
        canEdit={canEdit}
      />
    </div>
  )
}
