import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ProductSyncButton from './ProductSyncButton'
import ProductsTable from './ProductsTable'
import type { UserRole } from '@/types/database'

export default async function ProductsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: profile }, { data: products }] = await Promise.all([
    supabase.from('profiles').select('role').eq('id', user.id).single(),
    supabase
      .from('products')
      .select('*')
      .order('active', { ascending: false })
      .order('customer_facing_product_name'),
  ])

  const role = (profile?.role ?? 'lead_gen') as UserRole
  const isAdmin = role === 'admin'

  // Use the most recent last_synced_at across all products
  const lastSync = products?.reduce<string | null>((latest, p) => {
    if (!p.last_synced_at) return latest
    if (!latest) return p.last_synced_at
    return p.last_synced_at > latest ? p.last_synced_at : latest
  }, null)

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Products</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {products?.length ?? 0} products synced from Google Sheets
            {lastSync && (
              <>
                {' · '}Last sync:{' '}
                {new Date(lastSync).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </>
            )}
          </p>
        </div>
        {isAdmin && <ProductSyncButton />}
      </div>

      {!products?.length ? (
        <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
          No products found.{' '}
          {isAdmin
            ? 'Click "Sync from Sheets" to import your product master.'
            : 'Ask Takuma to sync the product master.'}
        </div>
      ) : (
        <ProductsTable products={products} isAdmin={isAdmin} />
      )}
    </div>
  )
}
