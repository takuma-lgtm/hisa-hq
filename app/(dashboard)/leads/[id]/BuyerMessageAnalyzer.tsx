'use client'

import { useState } from 'react'
import type { Customer } from '@/types/database'
import { AlertCircle, CheckCircle, Loader2, Package, Sparkles } from 'lucide-react'

interface Props {
  lead: Customer
  canEdit: boolean
  onDraftReady?: (draft: string) => void
}

type AnalyzeState = 'idle' | 'analyzing' | 'results' | 'error'

interface AnalysisResult {
  extraction: {
    product_keywords: string[]
    product_type_guess: string
    estimated_volume_kg: number | null
    volume_frequency: string
    urgency: string
    tone: string
    key_concerns: string[]
    summary: string
  }
  matched_product: {
    product_id: string
    product_name: string
    product_type: string
  } | null
  pricing: {
    currency: string
    price_per_kg: number
    tier_name: string | null
    tier_discount_pct: number
    landing_cost_per_kg: number
    gross_profit_per_kg: number
    gross_margin_pct: number
    margin_health: 'green' | 'yellow' | 'red'
    is_below_min: boolean
    subtotal: number | null
  } | null
  inventory: {
    total_in_stock: number
    total_in_transit: number
    monthly_available_kg: number | null
    sufficient: boolean
  } | null
  draft_reply: string
  alternatives: {
    product_id: string
    product_name: string
    product_type: string
    price_per_kg: number
  }[]
}

const CURRENCY_SYMBOL: Record<string, string> = { USD: '$', GBP: '£', EUR: '€' }

const MARGIN_COLORS: Record<string, string> = {
  green: 'bg-green-50 text-green-700',
  yellow: 'bg-amber-50 text-amber-700',
  red: 'bg-red-50 text-red-600',
}

const URGENCY_COLORS: Record<string, string> = {
  high: 'bg-red-50 text-red-600',
  medium: 'bg-amber-50 text-amber-700',
  low: 'bg-slate-100 text-slate-600',
}

export default function BuyerMessageAnalyzer({ lead, canEdit, onDraftReady }: Props) {
  const [state, setState] = useState<AnalyzeState>('idle')
  const [buyerMessage, setBuyerMessage] = useState('')
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  if (!canEdit) return null

  async function handleAnalyze() {
    if (!buyerMessage.trim()) return
    setState('analyzing')
    setErrorMsg(null)
    setResult(null)

    try {
      const res = await fetch(`/api/leads/${lead.customer_id}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: buyerMessage.trim() }),
      })

      const data = await res.json()

      if (!res.ok) {
        setState('error')
        setErrorMsg(data.error ?? 'Analysis failed')
        return
      }

      setResult(data)
      setState('results')
    } catch {
      setState('error')
      setErrorMsg('Network error')
    }
  }

  function handleDismiss() {
    setState('idle')
    setResult(null)
    setBuyerMessage('')
  }

  function handleUseDraft() {
    if (result?.draft_reply && onDraftReady) {
      onDraftReady(result.draft_reply)
    }
  }

  // ---- Render ----

  return (
    <div className="space-y-3">
      {/* Input area — always visible unless showing results */}
      {(state === 'idle' || state === 'error') && (
        <>
          <textarea
            value={buyerMessage}
            onChange={(e) => setBuyerMessage(e.target.value)}
            placeholder="Paste the buyer's message here…"
            rows={4}
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-green-500 resize-none"
          />
          <button
            onClick={handleAnalyze}
            disabled={!buyerMessage.trim()}
            className="inline-flex items-center gap-1.5 text-sm font-medium px-4 py-1.5 bg-green-700 text-white rounded-lg hover:bg-green-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Analyze Message
          </button>
        </>
      )}

      {/* Loading */}
      {state === 'analyzing' && (
        <div className="flex items-center gap-2 py-4 text-sm text-slate-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          Analyzing buyer message…
        </div>
      )}

      {/* Error */}
      {state === 'error' && errorMsg && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 p-2 rounded-lg bg-red-50 text-red-700 text-xs">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            {errorMsg}
          </div>
          <button onClick={handleDismiss} className="text-xs text-slate-500 hover:text-slate-700">
            Dismiss
          </button>
        </div>
      )}

      {/* Results */}
      {state === 'results' && result && (
        <div className="border border-slate-200 rounded-lg p-4 space-y-4 bg-slate-50">
          {/* Summary + urgency */}
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm text-slate-700 font-medium">{result.extraction.summary}</p>
            <span className={`shrink-0 px-2 py-0.5 text-xs font-medium rounded-full ${URGENCY_COLORS[result.extraction.urgency] ?? URGENCY_COLORS.low}`}>
              {result.extraction.urgency}
            </span>
          </div>

          {/* Product match + pricing */}
          {result.matched_product && result.pricing && (
            <div className="grid grid-cols-2 gap-3">
              {/* Product */}
              <div className="space-y-1">
                <p className="text-xs font-medium text-slate-500 flex items-center gap-1">
                  <Package className="w-3 h-3" /> Matched Product
                </p>
                <p className="text-sm font-medium text-slate-800">{result.matched_product.product_name}</p>
                <span className="inline-block px-1.5 py-0.5 text-[10px] font-medium rounded bg-slate-100 text-slate-600">
                  {result.matched_product.product_type}
                </span>
              </div>

              {/* Pricing */}
              <div className="space-y-1">
                <p className="text-xs font-medium text-slate-500">Pricing ({result.pricing.currency})</p>
                <p className="text-sm font-medium text-slate-800">
                  {CURRENCY_SYMBOL[result.pricing.currency] ?? '$'}{result.pricing.price_per_kg.toFixed(2)}/kg
                </p>
                {result.pricing.tier_name && (
                  <span className="inline-block px-1.5 py-0.5 text-[10px] font-medium rounded bg-blue-50 text-blue-700">
                    {result.pricing.tier_name} tier ({result.pricing.tier_discount_pct}% off)
                  </span>
                )}
                {result.pricing.is_below_min && (
                  <p className="text-[10px] text-red-600 font-medium">Below minimum price</p>
                )}
              </div>
            </div>
          )}

          {/* Volume + Margin + Inventory row */}
          <div className="grid grid-cols-3 gap-3">
            {/* Volume */}
            <div>
              <p className="text-xs font-medium text-slate-500 mb-1">Volume</p>
              <p className="text-sm text-slate-800">
                {result.extraction.estimated_volume_kg
                  ? `${result.extraction.estimated_volume_kg} kg`
                  : 'Not specified'}
              </p>
              <p className="text-[10px] text-slate-400">{result.extraction.volume_frequency}</p>
            </div>

            {/* Margin */}
            {result.pricing && (
              <div>
                <p className="text-xs font-medium text-slate-500 mb-1">Margin</p>
                <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${MARGIN_COLORS[result.pricing.margin_health]}`}>
                  {result.pricing.gross_margin_pct.toFixed(1)}%
                </span>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {CURRENCY_SYMBOL[result.pricing.currency]}{result.pricing.gross_profit_per_kg.toFixed(2)}/kg profit
                </p>
              </div>
            )}

            {/* Inventory */}
            {result.inventory && (
              <div>
                <p className="text-xs font-medium text-slate-500 mb-1">Inventory</p>
                <div className="flex items-center gap-1">
                  {result.inventory.sufficient
                    ? <CheckCircle className="w-3 h-3 text-green-600" />
                    : <AlertCircle className="w-3 h-3 text-red-500" />
                  }
                  <span className="text-sm text-slate-800">{result.inventory.total_in_stock} units</span>
                </div>
                {result.inventory.total_in_transit > 0 && (
                  <p className="text-[10px] text-slate-400">{result.inventory.total_in_transit} in transit</p>
                )}
                {result.inventory.monthly_available_kg != null && (
                  <p className="text-[10px] text-slate-400">{result.inventory.monthly_available_kg} kg/mo available</p>
                )}
              </div>
            )}
          </div>

          {/* Key concerns */}
          {result.extraction.key_concerns.length > 0 && (
            <div>
              <p className="text-xs font-medium text-slate-500 mb-1">Key Concerns</p>
              <div className="flex flex-wrap gap-1">
                {result.extraction.key_concerns.map((c) => (
                  <span key={c} className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-slate-100 text-slate-600">
                    {c}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Alternatives */}
          {result.alternatives.length > 0 && (
            <div>
              <p className="text-xs font-medium text-slate-500 mb-1">Other Options</p>
              <div className="space-y-1">
                {result.alternatives.map((alt) => (
                  <div key={alt.product_id} className="flex items-center justify-between text-xs text-slate-600">
                    <span>{alt.product_name} <span className="text-slate-400">({alt.product_type})</span></span>
                    <span>{CURRENCY_SYMBOL[result.pricing?.currency ?? 'USD']}{alt.price_per_kg.toFixed(2)}/kg</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Draft reply */}
          <div>
            <p className="text-xs font-medium text-slate-500 mb-1">Draft Reply</p>
            <textarea
              value={result.draft_reply}
              readOnly
              rows={5}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-700 resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={handleUseDraft}
              className="text-xs font-medium px-3 py-1.5 bg-green-700 text-white rounded-lg hover:bg-green-800 transition-colors"
            >
              Use as Draft
            </button>
            <button
              onClick={handleDismiss}
              className="text-xs text-slate-500 hover:text-slate-700 px-2 py-1"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
