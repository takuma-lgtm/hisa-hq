'use client'

import { useState } from 'react'
import type { CrmSetting } from '@/types/database'

const CATEGORY_LABELS: Record<string, string> = {
  exchange_rates: 'Exchange Rates',
  shipping: 'Shipping Costs',
  company: 'Company Info',
  margin_alerts: 'Margin Alert Thresholds',
  integrations: 'Integrations',
  payments: 'Payment Settings',
  general: 'General',
}

const CATEGORY_ORDER = ['exchange_rates', 'shipping', 'margin_alerts', 'company', 'integrations', 'payments', 'general']

const NUMBER_CATEGORIES = new Set(['exchange_rates', 'shipping', 'margin_alerts'])

// Wise bank details grouped by currency for structured display
const WISE_CURRENCY_GROUPS: { label: string; prefix: string }[] = [
  { label: 'Wise — USD', prefix: 'wise_usd_' },
  { label: 'Wise — GBP', prefix: 'wise_gbp_' },
  { label: 'Wise — EUR', prefix: 'wise_eur_' },
]

interface Props {
  grouped: Record<string, CrmSetting[]>
  stripeConfigured?: boolean
}

export default function SettingsForm({ grouped, stripeConfigured }: Props) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {}
    for (const settings of Object.values(grouped)) {
      for (const s of settings) {
        map[s.key] = s.value
      }
    }
    return map
  })
  const [savedKeys, setSavedKeys] = useState<Set<string>>(new Set())
  const [savingKeys, setSavingKeys] = useState<Set<string>>(new Set())
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set(WISE_CURRENCY_GROUPS.map((g) => g.prefix)))

  async function handleBlur(key: string, originalValue: string) {
    const current = values[key]
    if (current === originalValue) return

    setSavingKeys((prev) => new Set(prev).add(key))
    setSavedKeys((prev) => { const next = new Set(prev); next.delete(key); return next })

    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value: current }),
      })
      if (res.ok) {
        setSavedKeys((prev) => new Set(prev).add(key))
        setTimeout(() => setSavedKeys((prev) => { const next = new Set(prev); next.delete(key); return next }), 2000)
      }
    } finally {
      setSavingKeys((prev) => { const next = new Set(prev); next.delete(key); return next })
    }
  }

  function toggleGroup(prefix: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(prefix)) next.delete(prefix)
      else next.add(prefix)
      return next
    })
  }

  const sortedCategories = CATEGORY_ORDER.filter((c) => grouped[c])
  for (const cat of Object.keys(grouped)) {
    if (!sortedCategories.includes(cat)) sortedCategories.push(cat)
  }

  function renderField(s: CrmSetting, isNumber: boolean) {
    return (
      <div key={s.key} className="flex items-center gap-4">
        <label className="w-56 text-sm text-slate-600 shrink-0">
          {s.label || s.key}
        </label>
        <div className="flex-1 relative">
          <input
            type={isNumber ? 'number' : 'text'}
            step={isNumber ? 'any' : undefined}
            value={values[s.key] ?? ''}
            onChange={(e) => setValues((prev) => ({ ...prev, [s.key]: e.target.value }))}
            onBlur={() => handleBlur(s.key, s.value)}
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
          {savingKeys.has(s.key) && (
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">Saving...</span>
          )}
          {savedKeys.has(s.key) && (
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-green-600">Saved</span>
          )}
        </div>
      </div>
    )
  }

  function renderPaymentsSection(settings: CrmSetting[]) {
    // Separate Wise settings from others
    const wiseSettings: Record<string, CrmSetting[]> = {}
    const otherSettings: CrmSetting[] = []

    for (const s of settings) {
      const group = WISE_CURRENCY_GROUPS.find((g) => s.key.startsWith(g.prefix))
      if (group) {
        if (!wiseSettings[group.prefix]) wiseSettings[group.prefix] = []
        wiseSettings[group.prefix].push(s)
      } else {
        otherSettings.push(s)
      }
    }

    return (
      <section className="bg-white border border-slate-200 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-slate-800 mb-4">
          {CATEGORY_LABELS.payments}
        </h2>
        <div className="space-y-4">
          {/* Stripe status */}
          <div className="flex items-center gap-4">
            <label className="w-56 text-sm text-slate-600 shrink-0">Stripe</label>
            <div className="flex-1">
              {stripeConfigured ? (
                <span className="text-xs text-green-700 bg-green-50 px-2 py-1 rounded font-medium">Configured</span>
              ) : (
                <span className="text-xs text-red-700 bg-red-50 px-2 py-1 rounded font-medium">Not configured</span>
              )}
              <p className="text-xs text-slate-400 mt-1">Stripe API keys are configured in environment variables.</p>
            </div>
          </div>

          {/* Zelle and other non-Wise settings */}
          {otherSettings.map((s) => renderField(s, false))}

          {/* Wise bank details grouped by currency */}
          {WISE_CURRENCY_GROUPS.map((group) => {
            const groupSettings = wiseSettings[group.prefix]
            if (!groupSettings?.length) return null

            const isCollapsed = collapsedGroups.has(group.prefix)
            const hasValues = groupSettings.some((s) => values[s.key]?.trim())

            return (
              <div key={group.prefix} className="border border-slate-200 rounded-lg">
                <button
                  type="button"
                  onClick={() => toggleGroup(group.prefix)}
                  className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-lg"
                >
                  <span>{group.label}</span>
                  <span className="flex items-center gap-2">
                    {!hasValues && (
                      <span className="text-xs text-amber-600 font-normal">Not configured</span>
                    )}
                    <span className="text-xs text-slate-400">{isCollapsed ? '▸' : '▾'}</span>
                  </span>
                </button>
                {!isCollapsed && (
                  <div className="px-3 pb-3 space-y-3">
                    {groupSettings.map((s) => renderField(s, false))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>
    )
  }

  return (
    <div className="max-w-2xl space-y-8">
      {sortedCategories.map((category) => {
        const settings = grouped[category]
        if (!settings?.length) return null

        // Special rendering for payments category
        if (category === 'payments') {
          return renderPaymentsSection(settings)
        }

        const isNumber = NUMBER_CATEGORIES.has(category)

        return (
          <section key={category} className="bg-white border border-slate-200 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-slate-800 mb-4">
              {CATEGORY_LABELS[category] || category}
            </h2>
            <div className="space-y-3">
              {settings.map((s) => renderField(s, isNumber))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
