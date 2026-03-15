'use client'

import { useState } from 'react'
import type { CrmSetting } from '@/types/database'

const CATEGORY_LABELS: Record<string, string> = {
  exchange_rates: 'Exchange Rates',
  shipping: 'Shipping Costs',
  company: 'Company Info',
  margin_alerts: 'Margin Alert Thresholds',
  integrations: 'Integrations',
  general: 'General',
}

const CATEGORY_ORDER = ['exchange_rates', 'shipping', 'margin_alerts', 'company', 'integrations', 'general']

const NUMBER_CATEGORIES = new Set(['exchange_rates', 'shipping', 'margin_alerts'])

interface Props {
  grouped: Record<string, CrmSetting[]>
}

export default function SettingsForm({ grouped }: Props) {
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

  const sortedCategories = CATEGORY_ORDER.filter((c) => grouped[c])
  // Add any categories not in the predefined order
  for (const cat of Object.keys(grouped)) {
    if (!sortedCategories.includes(cat)) sortedCategories.push(cat)
  }

  return (
    <div className="max-w-2xl space-y-8">
      {sortedCategories.map((category) => {
        const settings = grouped[category]
        if (!settings?.length) return null
        const isNumber = NUMBER_CATEGORIES.has(category)

        return (
          <section key={category}>
            <h2 className="text-sm font-semibold text-slate-800 mb-3 pb-2 border-b border-slate-200">
              {CATEGORY_LABELS[category] || category}
            </h2>
            <div className="space-y-3">
              {settings.map((s) => (
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
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
