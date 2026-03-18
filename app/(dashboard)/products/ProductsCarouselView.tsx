'use client'

import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Search, Plus } from 'lucide-react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import ProductAccordionPanel from './ProductAccordionPanel'
import ProductSidePanel from './ProductSidePanel'
import type { Product } from '@/types/database'
import type { MarginThresholds } from '@/lib/margin-health'
import { getMarginHealth } from '@/lib/margin-health'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

type FilterTier = 'all' | 'premium' | 'versatile' | 'budget'

interface Props {
  products: Product[]
  isAdmin: boolean
  marginThresholds: MarginThresholds
}

const TIER_ORDER = ['premium', 'versatile', 'budget'] as const

const TIER_LABELS: Record<string, string> = {
  premium: 'Premium Edge',
  versatile: 'All-Purpose',
  budget: 'Budget-Friendly',
}

const TIER_BORDER: Record<string, string> = {
  premium: 'border-l-slate-900',
  versatile: 'border-l-[#2D5A3D]',
  budget: 'border-l-[#7BA340]',
}

const TIER_BADGE: Record<string, string> = {
  premium: 'bg-slate-900 text-white',
  versatile: 'bg-green-700 text-white',
  budget: 'bg-lime-600 text-white',
}

const TABS: { value: FilterTier; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'premium', label: 'Premium' },
  { value: 'versatile', label: 'Versatile' },
  { value: 'budget', label: 'Budget' },
]

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function ProductsCarouselView({ products: initialProducts, isAdmin, marginThresholds }: Props) {
  const [products, setProducts] = useState<Product[]>(initialProducts)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [createMode, setCreateMode] = useState(false)
  const [filter, setFilter] = useState<FilterTier>('all')
  const [search, setSearch] = useState('')

  function handleSaved(updated: Product) {
    setProducts(prev => prev.map(p => p.product_id === updated.product_id ? updated : p))
    setSelectedProduct(updated)
  }

  function handleCreated(created: Product) {
    setProducts(prev => [created, ...prev])
    setCreateMode(false)
    setSelectedProduct(created)
  }

  // Counts per tier (active only, non-competitor)
  const counts = useMemo(() => {
    const own = products.filter(p => !p.is_competitor)
    return {
      all: own.length,
      premium: own.filter(p => p.display_tier === 'premium').length,
      versatile: own.filter(p => p.display_tier === 'versatile').length,
      budget: own.filter(p => p.display_tier === 'budget').length,
    }
  }, [products])

  // Filtered + searched list
  const filtered = useMemo(() => {
    let list = products.filter(p => !p.is_competitor)
    if (filter !== 'all') list = list.filter(p => p.display_tier === filter)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(p =>
        p.customer_facing_product_name?.toLowerCase().includes(q) ||
        p.supplier?.toLowerCase().includes(q) ||
        p.tasting_headline?.toLowerCase().includes(q)
      )
    }
    return list.sort((a, b) => {
      if (a.active && !b.active) return -1
      if (!a.active && b.active) return 1
      return (a.customer_facing_product_name ?? '').localeCompare(b.customer_facing_product_name ?? '')
    })
  }, [products, filter, search])

  // Grouped by tier for the "All" view (no search)
  const grouped = useMemo(() => {
    if (filter !== 'all' || search.trim()) return null
    const result: { tier: string; label: string; items: Product[] }[] = []
    for (const tier of TIER_ORDER) {
      const items = filtered.filter(p => p.display_tier === tier)
      if (items.length > 0) result.push({ tier, label: TIER_LABELS[tier], items })
    }
    const untiered = filtered.filter(p => !p.display_tier)
    if (untiered.length > 0) result.push({ tier: 'untiered', label: 'Unassigned', items: untiered })
    return result
  }, [filter, search, filtered])

  // Hero: only when a specific tier is selected, no search, 3+ products
  const showHero = filter !== 'all' && !search.trim() && filtered.length >= 3

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-gray-50 border-b border-gray-200 px-6 py-3 space-y-2.5 shrink-0">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-base font-semibold text-gray-900">
            Products
            <span className="ml-2 text-sm font-normal text-gray-400">{counts.all}</span>
          </h1>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-400 w-44"
              />
            </div>
            {isAdmin && (
              <button
                onClick={() => setCreateMode(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                Add
              </button>
            )}
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1">
          {TABS.map(tab => (
            <button
              key={tab.value}
              onClick={() => setFilter(tab.value)}
              className={cn(
                'px-3 py-1 text-sm rounded-lg transition-colors cursor-pointer',
                filter === tab.value
                  ? 'bg-slate-900 text-white'
                  : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'
              )}
            >
              {tab.label}
              <span className={cn(
                'ml-1.5 text-xs tabular-nums',
                filter === tab.value ? 'text-white/70' : 'text-gray-400'
              )}>
                {counts[tab.value]}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Grid body */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {grouped ? (
          <div className="space-y-8">
            {grouped.map(({ tier, label, items }) => (
              <section key={tier}>
                <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">
                  {label}
                  <span className="ml-1.5 font-normal">{items.length}</span>
                </h3>
                <ProductGrid
                  products={items}
                  tier={tier}
                  onSelect={setSelectedProduct}
                  marginThresholds={marginThresholds}
                  showHero={false}
                />
              </section>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-gray-400 text-center pt-16">No products found.</p>
        ) : (
          <ProductGrid
            products={filtered}
            tier={filter !== 'all' ? filter : undefined}
            onSelect={setSelectedProduct}
            marginThresholds={marginThresholds}
            showHero={showHero}
          />
        )}
      </div>

      {/* Create modal */}
      <Dialog open={createMode} onOpenChange={open => { if (!open) setCreateMode(false) }}>
        <DialogContent className="p-0 max-w-lg overflow-hidden">
          <ProductSidePanel
            product={null}
            isCompetitor={false}
            isAdmin={isAdmin}
            marginThresholds={marginThresholds}
            onClose={() => setCreateMode(false)}
            onSaved={handleCreated}
          />
        </DialogContent>
      </Dialog>

      {/* Detail modal — unchanged */}
      <Dialog open={!!selectedProduct} onOpenChange={open => { if (!open) setSelectedProduct(null) }}>
        <DialogContent className="p-0 max-w-2xl overflow-hidden">
          {selectedProduct && (
            <ProductAccordionPanel
              product={selectedProduct}
              isAdmin={isAdmin}
              marginThresholds={marginThresholds}
              onClose={() => setSelectedProduct(null)}
              onSaved={handleSaved}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Product Grid
// ---------------------------------------------------------------------------

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05 } },
}

function ProductGrid({
  products,
  tier,
  onSelect,
  marginThresholds,
  showHero,
}: {
  products: Product[]
  tier?: string
  onSelect: (p: Product) => void
  marginThresholds: MarginThresholds
  showHero: boolean
}) {
  return (
    <motion.div
      className="grid grid-cols-2 lg:grid-cols-4 gap-4"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {products.map((p, i) => (
        <ProductCard
          key={p.product_id}
          product={p}
          tier={tier ?? p.display_tier ?? undefined}
          onSelect={onSelect}
          marginThresholds={marginThresholds}
          isHero={showHero && i === 0}
        />
      ))}
    </motion.div>
  )
}

// ---------------------------------------------------------------------------
// Product Card
// ---------------------------------------------------------------------------

const cardVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.2 } },
}

function ProductCard({
  product,
  tier,
  onSelect,
  marginThresholds,
  isHero,
}: {
  product: Product
  tier?: string
  onSelect: (p: Product) => void
  marginThresholds: MarginThresholds
  isHero: boolean
}) {
  const health = getMarginHealth(product.gross_profit_margin, product.gross_profit_per_kg_usd, marginThresholds)
  const marginPct = product.gross_profit_margin != null ? product.gross_profit_margin * 100 : null
  const price = product.selling_price_usd != null ? `$${product.selling_price_usd.toFixed(0)}` : '—'
  const stock = product.monthly_available_stock_kg != null && product.monthly_available_stock_kg > 0
    ? `~${product.monthly_available_stock_kg}kg/mo`
    : null

  const borderColor = tier && TIER_BORDER[tier] ? TIER_BORDER[tier] : 'border-l-gray-200'
  const healthBarColor = health === 'green' ? 'bg-green-500' : health === 'yellow' ? 'bg-yellow-400' : 'bg-red-500'

  return (
    <motion.button
      variants={cardVariants}
      onClick={() => onSelect(product)}
      className={cn(
        'text-left rounded-xl border border-gray-200 bg-white',
        'border-l-4', borderColor,
        'shadow-sm hover:shadow-md hover:border-gray-300 transition-all duration-200',
        'focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1',
        'cursor-pointer',
        isHero ? 'col-span-2 row-span-2' : 'col-span-1',
      )}
    >
      <div className={cn('p-4 flex flex-col h-full', isHero && 'p-6')}>
        {/* Badges row */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
            {tier && TIER_BADGE[tier] && (
              <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0', TIER_BADGE[tier])}>
                {TIER_LABELS[tier] ?? tier}
              </span>
            )}
            {product.product_type && (
              <span className="text-[10px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-full shrink-0 truncate max-w-[100px]">
                {product.product_type}
              </span>
            )}
          </div>
          <span className={cn(
            'shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full',
            product.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'
          )}>
            {product.active ? 'Active' : 'Inactive'}
          </span>
        </div>

        {/* Product name */}
        <p className={cn(
          'font-semibold text-gray-900 leading-snug',
          isHero ? 'text-lg mb-2' : 'text-sm mb-1.5'
        )}>
          {product.customer_facing_product_name}
        </p>

        {/* Tasting headline */}
        {product.tasting_headline && (
          <p className={cn(
            'italic text-gray-500 leading-snug',
            isHero ? 'text-sm mb-4' : 'text-[11px] mb-2 line-clamp-2'
          )}>
            &ldquo;{product.tasting_headline}&rdquo;
          </p>
        )}

        <div className="flex-1" />

        {/* Supplier */}
        {product.supplier && (
          <p className="text-[11px] text-gray-400 truncate mb-2">{product.supplier}</p>
        )}

        {/* Stats footer */}
        <div className="border-t border-gray-100 pt-2 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className={cn('font-semibold text-gray-800', isHero ? 'text-sm' : 'text-xs')}>
              {price}
              <span className="font-normal text-gray-400 text-[10px]">/kg</span>
            </span>
            {stock && (
              <span className="text-[10px] text-gray-400">{stock}</span>
            )}
          </div>

          {/* Margin bar */}
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={cn('h-full rounded-full', healthBarColor)}
                style={{ width: marginPct != null ? `${Math.min(marginPct, 100)}%` : '0%' }}
              />
            </div>
            <span className="text-[10px] tabular-nums text-gray-500 w-7 text-right">
              {marginPct != null ? `${marginPct.toFixed(0)}%` : '—'}
            </span>
          </div>
        </div>
      </div>
    </motion.button>
  )
}
