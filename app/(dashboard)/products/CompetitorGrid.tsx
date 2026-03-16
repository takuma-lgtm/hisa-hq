'use client'

import { useState } from 'react'
import { Plus, ExternalLink } from 'lucide-react'
import type { Product } from '@/types/database'

interface Props {
  products: Product[]
  selectedId: string | null
  isAdmin: boolean
  onSelect: (id: string) => void
  onAdd: () => void
}

export default function CompetitorGrid({ products, selectedId, isAdmin, onSelect, onAdd }: Props) {
  return (
    <div className="flex-1 overflow-y-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-slate-500">
          {products.length} competitor evaluation{products.length !== 1 ? 's' : ''}
        </p>
        <button
          onClick={onAdd}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-green-700 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Evaluation
        </button>
      </div>

      {products.length === 0 ? (
        <p className="text-center py-20 text-slate-400 text-sm">No competitor evaluations yet.</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {products.map((p) => (
            <CompetitorCard
              key={p.product_id}
              product={p}
              selected={selectedId === p.product_id}
              isAdmin={isAdmin}
              onSelect={() => onSelect(p.product_id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function CompetitorCard({
  product: p,
  selected,
  isAdmin,
  onSelect,
}: {
  product: Product
  selected: boolean
  isAdmin: boolean
  onSelect: () => void
}) {
  const [contacting, setContacting] = useState(p.should_contact_producer)

  async function handleContactToggle(e: React.ChangeEvent<HTMLInputElement>) {
    e.stopPropagation()
    const checked = e.target.checked
    setContacting(checked)
    await fetch(`/api/products/${encodeURIComponent(p.product_id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ should_contact_producer: checked }),
    })
  }

  const badges = [p.roast_level, p.texture_description, p.best_for].filter(Boolean)

  return (
    <div
      onClick={onSelect}
      className={`border rounded-lg p-4 cursor-pointer transition-colors ${
        selected ? 'border-green-500 bg-green-50/30' : 'border-slate-200 hover:border-green-300'
      }`}
    >
      <h3 className="font-medium text-slate-900">{p.customer_facing_product_name}</h3>
      <p className="text-xs text-slate-500 mt-0.5">
        {p.competitor_producer}
        {p.production_region ? ` · ${p.production_region}` : ''}
      </p>

      {p.tasting_headline && (
        <p className="text-sm italic text-slate-600 mt-1.5">{p.tasting_headline}</p>
      )}

      {p.short_description && (
        <p className="text-xs text-slate-500 mt-1 line-clamp-2">{p.short_description}</p>
      )}

      {badges.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {badges.map((b, i) => (
            <span key={i} className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full">
              {b}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between mt-3">
        <div className="flex items-center gap-3">
          {p.introduced_by && (
            <span className="text-[10px] text-slate-400">Introduced by {p.introduced_by}</span>
          )}
        </div>
        {p.competitor_url && (
          <a
            href={p.competitor_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 text-[10px] text-green-600 hover:text-green-700"
          >
            View product <ExternalLink className="h-2.5 w-2.5" />
          </a>
        )}
      </div>

      {isAdmin && (
        <label
          className="flex items-center gap-1.5 mt-2 text-[10px] text-slate-500 cursor-pointer"
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="checkbox"
            checked={contacting}
            onChange={handleContactToggle}
            className="rounded border-slate-300"
          />
          Should contact producer
        </label>
      )}
    </div>
  )
}
