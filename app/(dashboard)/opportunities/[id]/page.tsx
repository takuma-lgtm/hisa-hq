import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import OpportunityDetailClient from './OpportunityDetailClient'

interface Props {
  params: Promise<{ id: string }>
}

export default async function OpportunityDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [
    { data: profile },
    { data: opportunity },
    { data: callLogs },
    { data: proposals },
    { data: sampleBatches },
    { data: quotations },
    { data: invoices },
    { data: closers },
  ] = await Promise.all([
    supabase.from('profiles').select('id, name, role').eq('id', user.id).single(),

    supabase
      .from('opportunities')
      .select(`
        *,
        customer:customers(*),
        assigned_profile:profiles!opportunities_assigned_to_fkey(id, name, role),
        handoff_profile:profiles!opportunities_handoff_to_fkey(id, name)
      `)
      .eq('opportunity_id', id)
      .single(),

    supabase
      .from('call_logs')
      .select('*, logged_by_profile:profiles!call_logs_logged_by_fkey(name)')
      .eq('opportunity_id', id)
      .order('called_at', { ascending: false }),

    supabase
      .from('opportunity_proposals')
      .select(`
        *,
        items:opportunity_proposal_items(
          *,
          product:products(customer_facing_product_name, supplier_product_name)
        )
      `)
      .eq('opportunity_id', id)
      .order('created_at', { ascending: false }),

    supabase
      .from('sample_batches')
      .select('*, items:sample_batch_items(*)')
      .eq('opportunity_id', id)
      .order('created_at', { ascending: false }),

    supabase
      .from('quotations')
      .select('*')
      .eq('opportunity_id', id)
      .order('created_at', { ascending: false }),

    supabase
      .from('invoices')
      .select('*')
      .eq('opportunity_id', id)
      .order('created_at', { ascending: false }),

    // Fetch closers for handoff assignment
    supabase.from('profiles').select('id, name, role').in('role', ['closer', 'admin']),
  ])

  if (!opportunity) notFound()

  return (
    <OpportunityDetailClient
      opportunity={opportunity as never}
      userProfile={profile!}
      callLogs={(callLogs ?? []) as never}
      proposals={(proposals ?? []) as never}
      sampleBatches={(sampleBatches ?? []) as never}
      quotations={quotations ?? []}
      invoices={invoices ?? []}
      closers={closers ?? []}
    />
  )
}
