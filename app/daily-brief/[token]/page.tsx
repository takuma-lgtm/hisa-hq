import { createServiceClient } from '@/lib/supabase/server'
import DailyBriefClient from './DailyBriefClient'

export default async function DailyBriefPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const service = createServiceClient()

  const { data: brief } = await service
    .from('daily_briefs')
    .select('brief_id, brief_html, brief_text, generated_at, posted_to_chat, posted_at, supplier_notes')
    .eq('token', token)
    .single()

  if (!brief) {
    return (
      <div className="text-center py-20">
        <h2 className="text-lg font-semibold text-slate-700 mb-2">Brief not found</h2>
        <p className="text-sm text-slate-500">This link may have expired or is invalid.</p>
      </div>
    )
  }

  const generatedDate = new Date(brief.generated_at).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Tokyo',
  })

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-800">Daily Brief</h2>
        <p className="text-xs text-slate-500 mt-1">Generated {generatedDate} JST</p>
      </div>

      {/* Brief content */}
      <div
        className="bg-white border border-slate-200 rounded-xl p-6"
        dangerouslySetInnerHTML={{ __html: brief.brief_html }}
      />

      {/* Post to Chat section */}
      <DailyBriefClient
        token={token}
        briefText={brief.brief_text}
        alreadyPosted={brief.posted_to_chat}
        postedAt={brief.posted_at}
        existingNotes={brief.supplier_notes}
      />
    </div>
  )
}
