'use client'

import { useState } from 'react'
import { Wrench, Truck } from 'lucide-react'
import type { InventoryLevelWithDetails } from '@/types/database'
import StockLevelsTable from './StockLevelsTable'
import USOrdersDrawer from './USOrdersDrawer'
import ManualAdjustmentModal from './ManualAdjustmentModal'
import CreateUSOrderModal from './CreateUSOrderModal'

interface Sku {
  sku_id: string
  sku_name: string
  product_id: string | null
  name_external_eng: string | null
  sku_type: string
  is_active: boolean
  product: { supplier: string | null } | null
}

interface Warehouse {
  warehouse_id: string
  name: string
  short_code: string
}

interface Props {
  levels: InventoryLevelWithDetails[]
  skus: Sku[]
  warehouses: Warehouse[]
  exchangeRate: number
  isAdmin: boolean
  canWrite: boolean
}

export default function InventoryClient({
  levels,
  skus,
  warehouses,
  exchangeRate,
  isAdmin,
  canWrite,
}: Props) {
  const [showAdjust, setShowAdjust] = useState(false)
  const [showNewOrder, setShowNewOrder] = useState(false)
  const [showUSOrders, setShowUSOrders] = useState(false)

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
        <div>
          <h1 className="text-2xl font-serif text-slate-900">Inventory</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowUSOrders(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <Truck className="w-3.5 h-3.5" />
            US Orders
          </button>
          <button
            onClick={() => setShowAdjust(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <Wrench className="w-3.5 h-3.5" />
            Adjust
          </button>
        </div>
      </div>

      {/* Stock levels table — always visible */}
      <StockLevelsTable levels={levels} exchangeRate={exchangeRate} isAdmin={isAdmin} />

      {/* US Orders drawer */}
      <USOrdersDrawer
        open={showUSOrders}
        onClose={() => setShowUSOrders(false)}
        onNewOrder={() => { setShowUSOrders(false); setShowNewOrder(true) }}
        canWrite={canWrite}
      />

      {/* Modals */}
      {showAdjust && (
        <ManualAdjustmentModal
          skus={skus}
          warehouses={warehouses}
          onClose={() => setShowAdjust(false)}
        />
      )}
      {showNewOrder && (
        <CreateUSOrderModal
          skus={skus}
          onClose={() => setShowNewOrder(false)}
        />
      )}
    </>
  )
}
