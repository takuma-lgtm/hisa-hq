'use client'

import { useState, useRef, useEffect } from 'react'
import { Plus, ArrowRightLeft, Wrench, Truck, ChevronDown } from 'lucide-react'
import type { InventoryLevelWithDetails } from '@/types/database'
import StockLevelsTable from './StockLevelsTable'
import USOrdersDrawer from './USOrdersDrawer'
import RecordInboundModal from './RecordInboundModal'
import RecordTransferModal from './RecordTransferModal'
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
  const [showInbound, setShowInbound] = useState(false)
  const [showTransfer, setShowTransfer] = useState(false)
  const [showAdjust, setShowAdjust] = useState(false)
  const [showNewOrder, setShowNewOrder] = useState(false)
  const [showUSOrders, setShowUSOrders] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const moreRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!moreOpen) return
    function handleClick(e: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [moreOpen])

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
        <div>
          <h1 className="text-2xl font-serif text-slate-900">Inventory</h1>
        </div>
        <div className="flex items-center gap-2">
          {canWrite && (
            <button
              onClick={() => setShowInbound(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Record Inventory
            </button>
          )}
          <div className="relative" ref={moreRef}>
            <button
              onClick={() => setMoreOpen(!moreOpen)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
            >
              More
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
            {moreOpen && (
              <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-20">
                <button
                  onClick={() => { setShowUSOrders(true); setMoreOpen(false) }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <Truck className="w-3.5 h-3.5" />
                  File US Order
                </button>
                {canWrite && (
                  <button
                    onClick={() => { setShowTransfer(true); setMoreOpen(false) }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5" />
                    Transfer
                  </button>
                )}
                {isAdmin && (
                  <button
                    onClick={() => { setShowAdjust(true); setMoreOpen(false) }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <Wrench className="w-3.5 h-3.5" />
                    Adjust
                  </button>
                )}
              </div>
            )}
          </div>
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
      {showInbound && (
        <RecordInboundModal
          skus={skus}
          warehouses={warehouses}
          onClose={() => setShowInbound(false)}
        />
      )}
      {showTransfer && (
        <RecordTransferModal
          skus={skus}
          onClose={() => setShowTransfer(false)}
        />
      )}
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
