'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getMarginHealth, type MarginThresholds } from '@/lib/margin-health'

// --- Types ---

export interface CarouselProduct {
  product_id: string
  customer_facing_product_name: string
  product_type: string | null
  supplier: string | null
  selling_price_usd: number | null
  monthly_available_stock_kg: number | null
  gross_profit_margin: number | null
  gross_profit_per_kg_usd: number | null
  display_tier: 'premium' | 'versatile' | 'budget' | null
  active: boolean
}

interface ProductCarouselProps {
  title: string
  tier: 'premium' | 'versatile' | 'budget'
  products: CarouselProduct[]
  onCardClick: (product: CarouselProduct) => void
  marginThresholds: MarginThresholds
  className?: string
}

// --- Tier config ---

const TIER_CONFIG = {
  premium: { accent: 'border-l-[#0D1F0E]' },
  versatile: { accent: 'border-l-[#2D5A3D]' },
  budget: { accent: 'border-l-[#7BA340]' },
} as const

// --- Card ---

const cardVariants = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0 },
}

function ProductCard({
  product,
  tier,
  onCardClick,
  marginThresholds,
}: {
  product: CarouselProduct
  tier: 'premium' | 'versatile' | 'budget'
  onCardClick: (p: CarouselProduct) => void
  marginThresholds: MarginThresholds
}) {
  const health = getMarginHealth(product.gross_profit_margin, product.gross_profit_per_kg_usd, marginThresholds)
  const dotColor = health === 'green' ? 'bg-green-500' : health === 'yellow' ? 'bg-yellow-400' : 'bg-red-500'
  const marginPct = product.gross_profit_margin != null ? `${(product.gross_profit_margin * 100).toFixed(0)}%` : '—'
  const price = product.selling_price_usd != null ? `$${product.selling_price_usd.toFixed(2)}` : '—'
  const stock = product.monthly_available_stock_kg != null && product.monthly_available_stock_kg > 0
    ? `~${product.monthly_available_stock_kg}kg/mo`
    : '—'

  return (
    <motion.button
      variants={cardVariants}
      onClick={() => onCardClick(product)}
      className={cn(
        'w-52 flex-shrink-0 text-left rounded-xl border border-gray-200 bg-white',
        'border-l-4', TIER_CONFIG[tier].accent,
        'shadow-sm hover:shadow-md hover:border-gray-300 transition-all duration-200',
        'focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1'
      )}
    >
      <div className="p-4 space-y-3">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold text-gray-900 leading-snug line-clamp-2 flex-1">
            {product.customer_facing_product_name}
          </p>
          <span className={cn(
            'shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full',
            product.active
              ? 'bg-green-100 text-green-700'
              : 'bg-gray-100 text-gray-500'
          )}>
            {product.active ? 'Active' : 'Inactive'}
          </span>
        </div>

        {/* ID · Supplier */}
        <div className="space-y-0.5">
          <p className="text-[11px] text-gray-400 font-mono">{product.product_id}</p>
          {product.supplier && (
            <p className="text-[11px] text-gray-500 truncate">{product.supplier}</p>
          )}
        </div>

        {/* Stats row */}
        <div className="flex items-center justify-between text-xs pt-1 border-t border-gray-100">
          <span className="font-semibold text-gray-800">{price}<span className="font-normal text-gray-400">/kg</span></span>
          <span className="flex items-center gap-1">
            <span className={cn('w-1.5 h-1.5 rounded-full', dotColor)} />
            <span className="text-gray-600">{marginPct}</span>
          </span>
          <span className="text-gray-500">{stock}</span>
        </div>
      </div>
    </motion.button>
  )
}

// --- Main ProductCarousel ---

export const ProductCarousel = React.forwardRef<HTMLDivElement, ProductCarouselProps>(
  ({ title, tier, products, onCardClick, marginThresholds, className }, ref) => {
    const scrollRef = React.useRef<HTMLDivElement>(null)
    const [isAtStart, setIsAtStart] = React.useState(true)
    const [isAtEnd, setIsAtEnd] = React.useState(false)
    const [isScrollable, setIsScrollable] = React.useState(false)

    const checkScroll = React.useCallback(() => {
      const el = scrollRef.current
      if (!el) return
      setIsScrollable(el.scrollWidth > el.clientWidth)
      setIsAtStart(el.scrollLeft <= 1)
      setIsAtEnd(Math.abs(el.scrollWidth - el.scrollLeft - el.clientWidth) < 2)
    }, [])

    React.useEffect(() => {
      checkScroll()
      const el = scrollRef.current
      el?.addEventListener('scroll', checkScroll, { passive: true })
      window.addEventListener('resize', checkScroll)
      return () => {
        el?.removeEventListener('scroll', checkScroll)
        window.removeEventListener('resize', checkScroll)
      }
    }, [checkScroll, products])

    function scroll(dir: 'left' | 'right') {
      scrollRef.current?.scrollBy({ left: dir === 'left' ? -320 : 320, behavior: 'smooth' })
    }

    const containerVariants = {
      hidden: {},
      visible: { transition: { staggerChildren: 0.06 } },
    }

    if (products.length === 0) return null

    return (
      <section ref={ref} className={cn('space-y-3', className)}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
          <span className="text-xs text-gray-400">{products.length} product{products.length !== 1 ? 's' : ''}</span>
        </div>

        <div className="relative">
          <motion.div
            ref={scrollRef}
            className="flex gap-3 overflow-x-auto pb-2"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {products.map((p) => (
              <ProductCard
                key={p.product_id}
                product={p}
                tier={tier}
                onCardClick={onCardClick}
                marginThresholds={marginThresholds}
              />
            ))}
          </motion.div>

          {isScrollable && (
            <>
              <button
                type="button"
                onClick={() => scroll('left')}
                aria-label="Scroll left"
                className={cn(
                  'absolute left-0 top-1/3 -translate-y-1/2 z-10 rounded-full border border-gray-200 bg-white p-1.5 shadow transition-opacity',
                  isAtStart ? 'opacity-0 pointer-events-none' : 'opacity-100'
                )}
              >
                <ChevronLeft className="w-4 h-4 text-gray-600" />
              </button>
              <button
                type="button"
                onClick={() => scroll('right')}
                aria-label="Scroll right"
                className={cn(
                  'absolute right-0 top-1/3 -translate-y-1/2 z-10 rounded-full border border-gray-200 bg-white p-1.5 shadow transition-opacity',
                  isAtEnd ? 'opacity-0 pointer-events-none' : 'opacity-100'
                )}
              >
                <ChevronRight className="w-4 h-4 text-gray-600" />
              </button>
            </>
          )}
        </div>
      </section>
    )
  }
)

ProductCarousel.displayName = 'ProductCarousel'
