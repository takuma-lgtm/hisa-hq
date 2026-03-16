import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; linkId: string }> },
) {
  const { id, linkId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['admin', 'closer'].includes(profile.role)) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  const service = createServiceClient()
  const { error } = await service
    .from('supplier_products')
    .delete()
    .eq('id', linkId)
    .eq('supplier_id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true })
}
