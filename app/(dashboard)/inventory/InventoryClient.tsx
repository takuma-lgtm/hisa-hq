'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Plus, ArrowRightLeft, Wrench } from 'lucide-react'
import type { InventoryLevelWithDetails } from '@/types/database'
import StockLevelsTable from './StockLevelsTable'
import TransactionLogTable from './TransactionLogTable'
import RecordInboundModal from './RecordInboundModal'
import RecordTransferModal from './RecordTransferModal'
import ManualAdjustmentModal from './ManualAdjustmentModal'

type Tab = 'stock' | 'log'

interface Sku {
  sku_id: string
  sku_name: string
  product_id: string | null
  name_external_eng: string | null
  sku_type: string
  is_active: boolean
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
  const [tab, setTab] = useState<Tab>('stock')
  const [showInbound, setShowInbound] = useState(false)
  const [showTransfer, setShowTransfer] = useState(false)
  const [showAdjust, setShowAdjust] = useState(false)

  // Compute summary stats from levels
  const uniqueSkus = new Set(levels.map(l => l.sku_id))
  const totalUnits = levels.reduce((sum, l) => sum + l.quantity + l.in_transit_qty, 0)
  const totalValue = levels.reduce((sum, l) => {
    const unitCost = (l.sku as InventoryLevelWithDetails['sku'])?.unit_cost_jpy ?? 0
    return sum + (l.quantity + l.in_transit_qty) * unitCost / exchangeRate
  }, 0)

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Inventory</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {uniqueSkus.size} SKUs across {warehouses.length} warehouses
          </p>
        </div>
        {canWrite && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowInbound(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Record Inbound
            </button>
            <button
              onClick={() => setShowTransfer(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              Record Transfer
            </button>
            {isAdmin && (
              <button
                onClick={() => setShowAdjust(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <Wrench className="w-3.5 h-3.5" />
                Adjust
              </button>
            )}
          </div>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 px-6 py-4 border-b border-slate-200 shrink-0">
        <div className="bg-white border border-slate-200 rounded-lg px-4 py-3">
          <p className="text-xs text-slate-500">Total SKUs</p>
          <p className="text-xl font-semibold text-slate-900 mt-1">{uniqueSkus.size}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg px-4 py-3">
          <p className="text-xs text-slate-500">Total Units</p>
          <p className="text-xl font-semibold text-slate-900 mt-1">{totalUnits.toLocaleString()}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg px-4 py-3">
          <p className="text-xs text-slate-500">Total Value</p>
          <p className="text-xl font-semibold text-slate-900 mt-1">
            ${totalValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-6 px-6 border-b border-slate-200 shrink-0">
        <button
          className={cn(
            'pb-2.5 pt-3 text-sm font-medium border-b-2 transition-colors',
            tab === 'stock'
              ? 'border-green-600 text-green-700'
              : 'border-transparent text-slate-500 hover:text-slate-700',
          )}
          onClick={() => setTab('stock')}
        >
          Stock Levels
        </button>
        <button
          className={cn(
            'pb-2.5 pt-3 text-sm font-medium border-b-2 transition-colors',
            tab === 'log'
              ? 'border-green-600 text-green-700'
              : 'border-transparent text-slate-500 hover:text-slate-700',
          )}
          onClick={() => setTab('log')}
        >
          Transaction Log
        </button>
      </div>

      {/* Tab content */}
      {tab === 'stock' ? (
        <StockLevelsTable levels={levels} exchangeRate={exchangeRate} />
      ) : (
        <TransactionLogTable />
      )}

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
    </>
  )
}
