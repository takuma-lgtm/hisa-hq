'use client'

import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import type { ProposalWithItems } from '@/types/database'

interface Props {
  proposal: ProposalWithItems
  contactPerson: string | null | undefined
}

export default function ProposalMessage({ proposal, contactPerson }: Props) {
  const [copied, setCopied] = useState(false)

  const lines = proposal.items.map(
    (item) =>
      `• ${item.product.customer_facing_product_name}: $${item.price_per_kg}/${item.currency ?? 'USD'} per kg`,
  )

  const message = [
    `Hi${contactPerson ? ` ${contactPerson}` : ''}! 👋`,
    '',
    'Here are our matcha prices (excl. shipping and import tariffs):',
    '',
    ...lines,
    '',
    'These prices are FOB — shipping and tariffs are additional. Let me know if you have any questions or would like to move forward with samples!',
  ].join('\n')

  async function copy() {
    await navigator.clipboard.writeText(message)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
          Copy-pastable message
        </span>
        <button
          onClick={copy}
          className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 transition-colors"
        >
          {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <pre className="text-xs text-gray-700 bg-gray-50 rounded-lg p-3 whitespace-pre-wrap font-sans border border-gray-200">
        {message}
      </pre>
    </div>
  )
}
