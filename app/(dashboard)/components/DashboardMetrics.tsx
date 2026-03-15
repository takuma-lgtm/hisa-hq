interface MetricCard {
  label: string
  value: string
  alert?: boolean
}

export default function DashboardMetrics({ cards }: { cards: MetricCard[] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {cards.map((card) => (
        <div key={card.label} className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-400 mb-1">{card.label}</p>
          <p className={`text-2xl font-semibold ${card.alert ? 'text-red-600' : 'text-slate-900'}`}>
            {card.value}
          </p>
        </div>
      ))}
    </div>
  )
}
