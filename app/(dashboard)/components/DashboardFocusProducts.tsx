'use client'

import { useState } from 'react'
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { Plus, Search, X, GripVertical } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog'

// ── Types ──

interface Product {
  product_id: string
  customer_facing_product_name: string | null
  selling_price_usd: number | null
  gross_profit_margin: number | null
  jp_stock: number
  us_stock: number
  in_transit: number
}

type CategoryKey = 'price_sensitive' | 'one_fits_all' | 'edge'
type Categories = Record<CategoryKey, string[]>

interface Props {
  allProducts: Product[]
  focusProductCategories: string
}

// ── Constants ──

const CATEGORY_META: { key: CategoryKey; label: string; subtitle: string }[] = [
  { key: 'price_sensitive', label: 'Price Sensitive', subtitle: 'Cost-first, quality flexible' },
  { key: 'one_fits_all', label: 'One Fits All', subtitle: 'Safe pick for any cafe' },
  { key: 'edge', label: 'Edge', subtitle: 'Quality-driven, wants to stand out' },
]

const EMPTY_CATEGORIES: Categories = { price_sensitive: [], one_fits_all: [], edge: [] }

function parseCategories(raw: string): Categories {
  try {
    const parsed = JSON.parse(raw)
    // Handle new format
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return {
        price_sensitive: parsed.price_sensitive ?? [],
        one_fits_all: parsed.one_fits_all ?? [],
        edge: parsed.edge ?? [],
      }
    }
    // Handle old format (plain array) → migrate to one_fits_all
    if (Array.isArray(parsed)) {
      return { ...EMPTY_CATEGORIES, one_fits_all: parsed }
    }
    return EMPTY_CATEGORIES
  } catch {
    return EMPTY_CATEGORIES
  }
}

function allIds(cats: Categories): string[] {
  return [...cats.price_sensitive, ...cats.one_fits_all, ...cats.edge]
}

function findCategory(cats: Categories, productId: string): CategoryKey | null {
  for (const key of Object.keys(cats) as CategoryKey[]) {
    if (cats[key].includes(productId)) return key
  }
  return null
}

// ── Main Component ──

export default function DashboardFocusProducts({ allProducts, focusProductCategories }: Props) {
  const [categories, setCategories] = useState<Categories>(() => parseCategories(focusProductCategories))
  const [activeId, setActiveId] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(allIds(parseCategories(focusProductCategories))))
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))
  const productMap = Object.fromEntries(allProducts.map((p) => [p.product_id, p]))
  const activeProduct = activeId ? productMap[activeId] : null

  // ── Persist ──

  async function persistCategories(newCats: Categories) {
    await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'focus_product_categories', value: JSON.stringify(newCats) }),
    })
  }

  // ── Drag Handlers ──

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string)
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null)
    const { active, over } = event
    if (!over) return

    const productId = active.id as string
    const targetCategory = over.id as CategoryKey
    const sourceCategory = findCategory(categories, productId)

    if (!sourceCategory || sourceCategory === targetCategory) return
    if (!CATEGORY_META.some((c) => c.key === targetCategory)) return

    const newCats = { ...categories }
    newCats[sourceCategory] = newCats[sourceCategory].filter((id) => id !== productId)
    newCats[targetCategory] = [...newCats[targetCategory], productId]

    setCategories(newCats)
    persistCategories(newCats)
  }

  // ── Remove ──

  function removeProduct(productId: string) {
    const cat = findCategory(categories, productId)
    if (!cat) return

    const newCats = { ...categories }
    newCats[cat] = newCats[cat].filter((id) => id !== productId)

    setCategories(newCats)
    setSelectedIds((prev) => { const next = new Set(prev); next.delete(productId); return next })
    persistCategories(newCats)
  }

  // ── Dialog ──

  function toggleProduct(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleSave() {
    const currentAll = new Set(allIds(categories))
    const newAll = selectedIds

    // Find added and removed
    const added = [...newAll].filter((id) => !currentAll.has(id))
    const removed = [...currentAll].filter((id) => !newAll.has(id))

    if (added.length === 0 && removed.length === 0) {
      setOpen(false)
      return
    }

    setSaving(true)
    try {
      const newCats = { ...categories }
      // Remove
      for (const id of removed) {
        const cat = findCategory(newCats, id)
        if (cat) newCats[cat] = newCats[cat].filter((pid) => pid !== id)
      }
      // Add new ones to one_fits_all
      newCats.one_fits_all = [...newCats.one_fits_all, ...added]

      setCategories(newCats)
      await persistCategories(newCats)
      setOpen(false)
    } finally {
      setSaving(false)
    }
  }

  function handleOpenChange(isOpen: boolean) {
    if (!isOpen) {
      setSelectedIds(new Set(allIds(categories)))
      setSearch('')
    }
    setOpen(isOpen)
  }

  const filtered = allProducts.filter((p) => {
    if (!search) return true
    const q = search.toLowerCase()
    return p.product_id.toLowerCase().includes(q) ||
      (p.customer_facing_product_name?.toLowerCase().includes(q) ?? false)
  })

  const totalProducts = allIds(categories).length

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-slate-900">Focus Products</h2>
        <Dialog open={open} onOpenChange={handleOpenChange}>
          <DialogTrigger asChild>
            <button
              className="p-1.5 text-white bg-slate-800 rounded-md hover:bg-slate-900 transition-colors"
              title="Add focus products"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md p-0">
            <div className="p-4 border-b border-slate-100">
              <DialogTitle className="text-base font-semibold text-slate-900">
                Select Focus Products
              </DialogTitle>
              <p className="text-xs text-slate-500 mt-0.5">
                New products are added to &ldquo;One Fits All&rdquo; — drag to reclassify
              </p>
            </div>
            <div className="px-4 py-3 border-b border-slate-100">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search products..."
                  className="w-full text-sm border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 outline-none focus:ring-2 focus:ring-green-500"
                  autoFocus
                />
              </div>
            </div>
            <div className="max-h-[50vh] overflow-y-auto px-2 py-1">
              {filtered.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-4">No products found</p>
              ) : (
                filtered.map((p) => {
                  const cat = findCategory(categories, p.product_id)
                  const catLabel = cat ? CATEGORY_META.find((c) => c.key === cat)?.label : null
                  return (
                    <label
                      key={p.product_id}
                      className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-slate-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.has(p.product_id)}
                        onChange={() => toggleProduct(p.product_id)}
                        className="rounded border-slate-300 text-green-600 focus:ring-green-500"
                      />
                      <div className="flex-1 min-w-0 flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-800">
                          {p.customer_facing_product_name || p.product_id}
                        </span>
                        <span className="text-xs text-slate-400">{p.product_id}</span>
                        {catLabel && (
                          <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                            {catLabel}
                          </span>
                        )}
                      </div>
                    </label>
                  )
                })
              )}
            </div>
            <div className="p-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                {selectedIds.size} selected
              </span>
              <div className="flex items-center gap-3">
                <Link href="/products" className="text-xs text-slate-500 hover:text-slate-700 font-medium">
                  + Add Product
                </Link>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-sm font-medium rounded-lg disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {totalProducts === 0 ? (
        <p className="text-sm text-slate-400">No focus products selected yet.</p>
      ) : (
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-3 gap-3">
            {CATEGORY_META.map((cat) => (
              <CategoryLane
                key={cat.key}
                categoryKey={cat.key}
                label={cat.label}
                subtitle={cat.subtitle}
                productIds={categories[cat.key]}
                productMap={productMap}
                onRemove={removeProduct}
              />
            ))}
          </div>
          <DragOverlay>
            {activeProduct && <ProductCard product={activeProduct} isDragging />}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  )
}

// ── Category Lane (droppable) ──

function CategoryLane({
  categoryKey, label, subtitle, productIds, productMap, onRemove,
}: {
  categoryKey: CategoryKey
  label: string
  subtitle: string
  productIds: string[]
  productMap: Record<string, Product>
  onRemove: (id: string) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: categoryKey })

  return (
    <div className="flex flex-col">
      <div className="mb-2">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-semibold text-slate-600">{label}</h3>
          {productIds.length > 0 && (
            <span className="text-[10px] text-slate-400">{productIds.length}</span>
          )}
        </div>
        <p className="text-[11px] text-slate-400 mt-0.5">{subtitle}</p>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          'flex flex-col gap-2 flex-1 rounded-lg p-2 min-h-[80px] transition-colors border border-dashed',
          isOver ? 'bg-slate-100 border-slate-300' : 'bg-slate-50/50 border-slate-200/60',
        )}
      >
        {productIds.length === 0 ? (
          <p className="text-xs text-slate-300 text-center py-4">Drop products here</p>
        ) : (
          productIds.map((id) => {
            const product = productMap[id]
            if (!product) return null
            return (
              <DraggableProductCard key={id} product={product} onRemove={() => onRemove(id)} />
            )
          })
        )}
      </div>
    </div>
  )
}

// ── Draggable Product Card ──

function DraggableProductCard({ product, onRemove }: { product: Product; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: product.product_id,
  })

  const style = {
    transform: transform ? `translate(${transform.x}px, ${transform.y}px)` : undefined,
  }

  return (
    <div ref={setNodeRef} style={style} className={cn(isDragging && 'opacity-50')}>
      <ProductCard product={product} onRemove={onRemove} dragHandleProps={{ ...attributes, ...listeners }} />
    </div>
  )
}

// ── Product Card ──

function ProductCard({
  product: p,
  onRemove,
  isDragging,
  dragHandleProps,
}: {
  product: Product
  onRemove?: () => void
  isDragging?: boolean
  dragHandleProps?: Record<string, unknown>
}) {
  const marginPct = p.gross_profit_margin != null ? Math.round(p.gross_profit_margin) : null
  const price = p.selling_price_usd != null ? `$${p.selling_price_usd.toFixed(0)}/kg` : '—'
  const totalStock = p.jp_stock + p.us_stock + p.in_transit
  const marginColor = marginPct == null ? 'text-slate-400' : marginPct >= 25 ? 'text-green-600' : marginPct >= 15 ? 'text-amber-600' : 'text-red-500'
  const marginBg = marginPct == null ? 'bg-slate-100' : marginPct >= 25 ? 'bg-green-50' : marginPct >= 15 ? 'bg-amber-50' : 'bg-red-50'

  return (
    <div className={cn(
      'border border-slate-200 rounded-lg p-3 bg-white transition-colors',
      isDragging ? 'shadow-lg ring-2 ring-slate-200' : 'hover:border-slate-300',
    )}>
      {/* Header */}
      <div className="flex items-start justify-between gap-1 mb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          {dragHandleProps && (
            <button
              {...dragHandleProps}
              className="text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing shrink-0 touch-none"
              aria-label="Drag to reclassify"
            >
              <GripVertical className="w-3.5 h-3.5" />
            </button>
          )}
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900 truncate">
              {p.customer_facing_product_name || p.product_id}
            </p>
            <p className="text-xs text-slate-400">{p.product_id} · {price}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${marginBg} ${marginColor}`}>
            {marginPct != null ? `${marginPct}%` : '—'}
          </span>
          {onRemove && (
            <button
              onClick={onRemove}
              className="p-0.5 rounded text-slate-300 hover:text-slate-500 hover:bg-slate-100 transition-colors"
              aria-label="Remove from focus products"
              title="Remove"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Stock bars */}
      <div className="space-y-1.5">
        <StockRow label="JP" qty={p.jp_stock} total={totalStock} color="bg-emerald-500" />
        <StockRow label="US" qty={p.us_stock} total={totalStock} color="bg-blue-500" />
        {p.in_transit > 0 && (
          <StockRow label="Transit" qty={p.in_transit} total={totalStock} color="bg-amber-400" />
        )}
      </div>

      {/* Total */}
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
        <span className="text-xs text-slate-400">Total stock</span>
        <span className="text-sm font-semibold text-slate-800">{totalStock}</span>
      </div>
    </div>
  )
}

// ── Stock Row ──

function StockRow({ label, qty, total, color }: { label: string; qty: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((qty / total) * 100) : 0
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-medium text-slate-400 w-10">{label}</span>
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs tabular-nums font-medium text-slate-600 w-6 text-right">{qty}</span>
    </div>
  )
}
