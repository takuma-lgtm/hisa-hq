import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import SuppliersTable from './SuppliersTable'
import AddSupplierModal from './AddSupplierModal'

export default async function SuppliersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const service = createServiceClient()

  const [{ data: profile }, { data: suppliers }, { data: profiles }, { data: comms }] = await Promise.all([
    service.from('profiles').select('role').eq('id', user.id).single(),
    service.from('suppliers').select('*').neq('stage', 'deal_established').order('created_at', { ascending: false }),
    service.from('profiles').select('id, name, role, created_at'),
    service.from('supplier_communications').select('supplier_id'),
  ])

  const role = profile?.role ?? 'lead_gen'
  const canEdit = role === 'admin' || role === 'closer'

  // Aggregate comm counts
  const commCounts: Record<string, number> = {}
  for (const row of comms ?? []) {
    commCounts[row.supplier_id] = (commCounts[row.supplier_id] ?? 0) + 1
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif text-slate-900">Supplier Leads</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {(suppliers ?? []).length} supplier leads in pipeline
          </p>
        </div>
        {canEdit && <AddSupplierModal />}
      </div>

      {(suppliers ?? []).length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-sm text-slate-500">No suppliers yet</p>
            {canEdit && (
              <p className="text-xs text-slate-400 mt-1">Click &quot;Add Supplier&quot; to get started</p>
            )}
          </div>
        </div>
      ) : (
        <SuppliersTable
          suppliers={suppliers ?? []}
          profiles={profiles ?? []}
          commCounts={commCounts}
          canEdit={canEdit}
        />
      )}
    </div>
  )
}
