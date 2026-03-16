'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface Sku {
  sku_id: string
  sku_name: string
  product_id: string | null
  name_external_eng: string | null
  sku_type: string
}

interface InventoryLevel {
  sku_id: string
  quantity: number
}

interface OrderItem {
  sku_id: string
  sku_name: string
  product_description: string
  quantity: string
  unit_value_usd: string
}

interface Customer {
  customer_id: string
  cafe_name: string
  address: string | null
  city: string | null
  state: string | null
  country: string | null
}

interface Props {
  skus: Sku[]
  onClose: () => void
}

export default function CreateUSOrderModal({ skus, onClose }: Props) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [customers, setCustomers] = useState<Customer[]>([])
  const [usStock, setUsStock] = useState<InventoryLevel[]>([])
  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [shipToName, setShipToName] = useState('')
  const [shipToAddress, setShipToAddress] = useState('')
  const [shipToCity, setShipToCity] = useState('')
  const [shipToState, setShipToState] = useState('')
  const [shipToZip, setShipToZip] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<OrderItem[]>([
    { sku_id: '', sku_name: '', product_description: '', quantity: '', unit_value_usd: '' },
  ])

  useEffect(() => {
    // Fetch customers for dropdown
    fetch('/api/customers?status=customer&limit=200')
      .then(r => r.ok ? r.json() : { data: [] })
      .then(res => setCustomers(res.data || []))
      .catch((err) => console.error('Failed to fetch customers:', err))

    // Fetch US warehouse stock levels
    fetch('/api/inventory/levels?warehouse=US')
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        if (Array.isArray(data)) setUsStock(data)
        else if (data?.data) setUsStock(data.data)
      })
      .catch((err) => console.error('Failed to fetch US stock:', err))
  }, [])

  function selectCustomer(customerId: string) {
    setSelectedCustomerId(customerId)
    const cust = customers.find(c => c.customer_id === customerId)
    if (cust) {
      setCustomerName(cust.cafe_name)
      setShipToName(cust.cafe_name)
      setShipToAddress(cust.address || '')
      setShipToCity(cust.city || '')
      setShipToState(cust.state || '')
    }
  }

  function getAvailableStock(skuId: string) {
    const level = usStock.find(l => l.sku_id === skuId)
    return level?.quantity ?? 0
  }

  function addItem() {
    setItems([...items, { sku_id: '', sku_name: '', product_description: '', quantity: '', unit_value_usd: '' }])
  }

  function removeItem(idx: number) {
    if (items.length === 1) return
    setItems(items.filter((_, i) => i !== idx))
  }

  function updateItem(idx: number, field: keyof OrderItem, value: string) {
    const updated = [...items]
    updated[idx] = { ...updated[idx], [field]: value }
    // Auto-fill sku_name when sku_id changes
    if (field === 'sku_id') {
      const sku = skus.find(s => s.sku_id === value)
      if (sku) {
        updated[idx].sku_name = sku.sku_name
        updated[idx].product_description = sku.product_id || sku.sku_name.split('_')[0]
      }
    }
    setItems(updated)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const validItems = items.filter(i => i.sku_id && i.quantity && parseInt(i.quantity, 10) > 0)
    if (!customerName.trim() || validItems.length === 0) {
      setError('Customer name and at least one item are required')
      return
    }

    setSaving(true)
    setError('')

    const res = await fetch('/api/orders/us', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_id: selectedCustomerId || undefined,
        customer_name: customerName,
        ship_to_name: shipToName || customerName,
        ship_to_address: shipToAddress,
        ship_to_city: shipToCity,
        ship_to_state: shipToState,
        ship_to_zip: shipToZip,
        notes: notes || undefined,
        items: validItems.map(i => ({
          sku_id: i.sku_id,
          sku_name: i.sku_name,
          product_description: i.product_description,
          quantity: parseInt(i.quantity, 10),
          unit_value_usd: i.unit_value_usd ? parseFloat(i.unit_value_usd) : undefined,
        })),
      }),
    })

    if (!res.ok) {
      const json = await res.json()
      setError(json.error || 'Failed to create order')
      setSaving(false)
      return
    }

    router.refresh()
    onClose()
  }

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New US Outbound Order</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Customer */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Customer</label>
            <select
              value={selectedCustomerId}
              onChange={e => selectCustomer(e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="">Select or type below...</option>
              {customers.map(c => (
                <option key={c.customer_id} value={c.customer_id}>{c.cafe_name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Customer Name *</label>
            <input
              type="text"
              value={customerName}
              onChange={e => setCustomerName(e.target.value)}
              placeholder="Cafe name"
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-green-500"
              required
            />
          </div>

          {/* Ship To */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Ship To Address</label>
              <input
                type="text"
                value={shipToAddress}
                onChange={e => setShipToAddress(e.target.value)}
                placeholder="Street address"
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">City</label>
              <input
                type="text"
                value={shipToCity}
                onChange={e => setShipToCity(e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">State / ZIP</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={shipToState}
                  onChange={e => setShipToState(e.target.value)}
                  placeholder="State"
                  className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-green-500"
                />
                <input
                  type="text"
                  value={shipToZip}
                  onChange={e => setShipToZip(e.target.value)}
                  placeholder="ZIP"
                  className="w-20 text-sm border border-slate-200 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>
          </div>

          {/* Items */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-2">Items *</label>
            <div className="space-y-2">
              {items.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <select
                    value={item.sku_id}
                    onChange={e => updateItem(idx, 'sku_id', e.target.value)}
                    className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-green-500"
                    required
                  >
                    <option value="">Select SKU...</option>
                    {skus.map(s => {
                      const stock = getAvailableStock(s.sku_id)
                      return (
                        <option key={s.sku_id} value={s.sku_id}>
                          {s.sku_name} (US: {stock})
                        </option>
                      )
                    })}
                  </select>
                  <input
                    type="number"
                    value={item.quantity}
                    onChange={e => updateItem(idx, 'quantity', e.target.value)}
                    min="1"
                    placeholder="Qty"
                    className="w-16 text-sm border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-green-500"
                    required
                  />
                  <input
                    type="number"
                    step="0.01"
                    value={item.unit_value_usd}
                    onChange={e => updateItem(idx, 'unit_value_usd', e.target.value)}
                    placeholder="$/ea"
                    className="w-16 text-sm border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-green-500"
                  />
                  {items.length > 1 && (
                    <button type="button" onClick={() => removeItem(idx)} className="p-1.5 text-slate-400 hover:text-red-500">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button type="button" onClick={addItem} className="mt-2 flex items-center gap-1 text-xs text-green-600 hover:text-green-700">
              <Plus className="w-3.5 h-3.5" />
              Add another item
            </button>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-green-500 resize-none"
            />
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-1.5 text-sm rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
            >
              {saving ? 'Creating...' : 'Create Order'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
