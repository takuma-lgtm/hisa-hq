'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Check, ChevronRight, X, Truck } from 'lucide-react'
import type { Profile } from '@/types/database'

// ── Types ──

interface TaskItemWithStock {
  item_id: string
  sku_id: string
  qty: number
  sku: { sku_id: string; sku_name: string; sku_type: string } | null
  stock: Record<string, number> // { JP: qty, US: qty }
}

interface TaskWithItems {
  task_id: string
  task_type: 'sample' | 'order'
  route: 'jp_to_us' | 'jp_to_cafe' | 'jp_to_customer' | 'us_to_cafe' | 'us_to_customer'
  customer_name: string | null
  assigned_to: string | null
  created_by: string
  status: 'open' | 'done'
  created_at: string
  items: TaskItemWithStock[]
}

interface USOrder {
  order_id: string
  order_number: string
  customer_name: string
  status: string
  created_at: string
  items: { sku_name: string; quantity: number }[]
}

interface SkuOption {
  sku_id: string
  sku_name: string
  sku_type: string
}

interface Props {
  tasks: TaskWithItems[]
  usOrders: USOrder[]
  skus: SkuOption[]
  profiles: Pick<Profile, 'id' | 'name'>[]
}

// ── Helpers ──

const ROUTE_LABELS: Record<string, string> = {
  jp_to_us: '🇯🇵 JP Warehouse → 🇺🇸 US Warehouse',
  jp_to_cafe: '🇯🇵 JP Warehouse → Customer',
  jp_to_customer: '🇯🇵 JP Warehouse → Customer',
  us_to_cafe: '🇺🇸 US Warehouse → Customer',
  us_to_customer: '🇺🇸 US Warehouse → Customer',
}

const ROUTE_TOOLTIPS: Record<string, string> = {
  jp_to_us: 'JP Warehouse → US Warehouse',
  jp_to_cafe: 'JP Warehouse → Customer (Direct)',
  jp_to_customer: 'JP Warehouse → Customer (Direct)',
  us_to_cafe: 'US Warehouse → Customer',
  us_to_customer: 'US Warehouse → Customer',
}

// Source warehouse for stock checking
const ROUTE_WAREHOUSE: Record<string, string> = {
  jp_to_us: 'JP',
  jp_to_cafe: 'JP',
  jp_to_customer: 'JP',
  us_to_cafe: 'US',
  us_to_customer: 'US',

}

// Normalize old route names to canonical names for grouping
function normalizeRoute(route: string): string {
  if (route === 'jp_to_cafe') return 'jp_to_customer'
  if (route === 'us_to_cafe') return 'us_to_customer'
  return route
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return '1d ago'
  return `${days}d ago`
}

function StockBadge({ qty, needed }: { qty: number; needed: number }) {
  if (qty >= needed) return <span className="text-green-600 text-xs">{qty} ✓</span>
  if (qty > 0) return <span className="text-amber-600 text-xs">{qty} ⚠</span>
  return <span className="text-red-500 text-xs">{qty} ✗</span>
}

const ALL_ROUTES = ['jp_to_us', 'jp_to_customer', 'us_to_customer'] as const

// ── Component ──

export default function DashboardShipments({ tasks, usOrders, skus, profiles }: Props) {
  const router = useRouter()
  const [creatingFor, setCreatingFor] = useState<string | null>(null)
  const [localTasks, setLocalTasks] = useState(tasks)

  const profileMap = Object.fromEntries(profiles.map((p) => [p.id, p.name]))

  const openTasks = localTasks.filter((t) => t.status === 'open')
  const sampleTasks = openTasks.filter((t) => t.task_type === 'sample')
  const orderTasks = openTasks.filter((t) => t.task_type === 'order')
  const pendingUsOrders = usOrders.filter((o) => o.status === 'pending' || o.status === 'packed')

  async function markDone(taskId: string) {
    setLocalTasks((prev) => prev.map((t) => t.task_id === taskId ? { ...t, status: 'done' as const } : t))
    await fetch(`/api/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'done' }),
    })
  }

  function toggleCreate(key: string) {
    setCreatingFor(creatingFor === key ? null : key)
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <h2 className="text-sm font-semibold text-slate-900 mb-4">Shipment Tasks</h2>

      <div className="grid grid-cols-2 gap-4">
        {/* Left lane: Samples */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Samples{sampleTasks.length > 0 && <span className="ml-1.5 text-slate-800">({sampleTasks.length})</span>}
          </h3>

          {ALL_ROUTES.map((route) => {
            const key = `sample_${route}`
            const routeTasks = sampleTasks.filter((t) => normalizeRoute(t.route) === route)
            return (
              <div key={key}>
                <RouteGroup
                  label={ROUTE_LABELS[route]}
                  tooltip={ROUTE_TOOLTIPS[route]}
                  tasks={routeTasks}
                  warehouse={ROUTE_WAREHOUSE[route]}
                  profileMap={profileMap}
                  onMarkDone={markDone}
                  onCreateNew={() => toggleCreate(key)}
                  isCreating={creatingFor === key}
                />
                {creatingFor === key && (
                  <CreateTaskForm
                    route={route}
                    taskType="sample"
                    skus={skus}
                    profiles={profiles}
                    warehouse={ROUTE_WAREHOUSE[route]}
                    showCustomer={route !== 'jp_to_us'}
                    onCreated={(task) => { setLocalTasks((prev) => [task, ...prev]); setCreatingFor(null) }}
                    onCancel={() => setCreatingFor(null)}
                  />
                )}
              </div>
            )
          })}
        </div>

        {/* Right lane: Orders */}
        <div className="space-y-3 border-l border-slate-100 pl-4">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Orders{(orderTasks.length + pendingUsOrders.length) > 0 && <span className="ml-1.5 text-slate-800">({orderTasks.length + pendingUsOrders.length})</span>}
          </h3>

          {ALL_ROUTES.map((route) => {
            const key = `order_${route}`
            const routeTasks = orderTasks.filter((t) => normalizeRoute(t.route) === route)

            // For us_to_customer orders, also show pending US orders
            if (route === 'us_to_customer') {
              return (
                <div key={key}>
                  <USOrdersGroup
                    label={ROUTE_LABELS[route]}
                    tooltip={ROUTE_TOOLTIPS[route]}
                    tasks={routeTasks}
                    orders={pendingUsOrders}
                    warehouse="US"
                    profileMap={profileMap}
                    onMarkDone={markDone}
                    onFileOrder={() => router.push('/inventory')}
                  />
                </div>
              )
            }

            return (
              <div key={key}>
                <RouteGroup
                  label={ROUTE_LABELS[route]}
                  tooltip={ROUTE_TOOLTIPS[route]}
                  tasks={routeTasks}
                  warehouse={ROUTE_WAREHOUSE[route]}
                  profileMap={profileMap}
                  onMarkDone={markDone}
                  onCreateNew={() => toggleCreate(key)}
                  isCreating={creatingFor === key}
                />
                {creatingFor === key && (
                  <CreateTaskForm
                    route={route}
                    taskType="order"
                    skus={skus}
                    profiles={profiles}
                    warehouse={ROUTE_WAREHOUSE[route]}
                    showCustomer={route !== 'jp_to_us'}
                    onCreated={(task) => { setLocalTasks((prev) => [task, ...prev]); setCreatingFor(null) }}
                    onCancel={() => setCreatingFor(null)}
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Sub-components ──

function RouteGroup({
  label, tooltip, tasks, warehouse, profileMap, onMarkDone, onCreateNew, isCreating,
}: {
  label: string
  tooltip: string
  tasks: TaskWithItems[]
  warehouse: string
  profileMap: Record<string, string>
  onMarkDone: (id: string) => void
  onCreateNew: () => void
  isCreating: boolean
}) {
  return (
    <div className="border border-slate-100 rounded-lg p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-semibold text-slate-600 tracking-wide" title={tooltip}>{label}</h3>
          {tasks.length > 0 && (
            <span className="bg-slate-800 text-white text-[10px] font-medium rounded-full w-4 h-4 flex items-center justify-center">
              {tasks.length}
            </span>
          )}
        </div>
        <button
          onClick={onCreateNew}
          aria-label={isCreating ? 'Cancel' : `New ${label} shipment`}
          className="text-xs text-white font-medium flex items-center gap-1 bg-slate-800 rounded-md px-2.5 py-1 hover:bg-slate-900 cursor-pointer transition-colors"
        >
          {isCreating ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
          {isCreating ? 'Cancel' : 'New'}
        </button>
      </div>
      {tasks.length === 0 && !isCreating ? (
        <p className="text-xs text-slate-300 mt-2">—</p>
      ) : (
        <div className="space-y-1 mt-2">
          {tasks.map((task) => (
            <TaskRow key={task.task_id} task={task} warehouse={warehouse} profileMap={profileMap} onMarkDone={onMarkDone} />
          ))}
        </div>
      )}
    </div>
  )
}

function TaskRow({ task, warehouse, profileMap, onMarkDone }: {
  task: TaskWithItems
  warehouse: string
  profileMap: Record<string, string>
  onMarkDone: (id: string) => void
}) {
  return (
    <div className="flex items-start gap-2 px-2 py-2 rounded-lg hover:bg-slate-50 transition-colors">
      <button
        onClick={() => onMarkDone(task.task_id)}
        className="mt-0.5 w-4 h-4 rounded border border-slate-300 hover:border-green-500 hover:bg-green-50 flex items-center justify-center shrink-0 transition-colors"
        title="Mark done"
      >
        <Check className="w-3 h-3 text-transparent hover:text-green-600" />
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-800">
            {task.customer_name || 'Warehouse transfer'}
          </span>
          <span className="text-xs text-slate-400">
            {task.assigned_to ? profileMap[task.assigned_to] ?? 'Unknown' : 'Unassigned'} · {timeAgo(task.created_at)}
          </span>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1">
          {task.items.map((item) => (
            <span key={item.item_id} className="text-xs text-slate-600 flex items-center gap-1.5">
              {item.sku?.sku_name ?? 'Unknown SKU'} × {item.qty}
              <StockBadge qty={item.stock[warehouse] ?? 0} needed={item.qty} />
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

function USOrdersGroup({ label, tooltip, tasks, orders, warehouse, profileMap, onMarkDone, onFileOrder }: {
  label: string
  tooltip: string
  tasks: TaskWithItems[]
  orders: USOrder[]
  warehouse: string
  profileMap: Record<string, string>
  onMarkDone: (id: string) => void
  onFileOrder: () => void
}) {
  const router = useRouter()
  const totalCount = tasks.length + orders.length

  return (
    <div className="border border-slate-100 rounded-lg p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-semibold text-slate-600 tracking-wide" title={tooltip}>{label}</h3>
          {totalCount > 0 && (
            <span className="bg-slate-800 text-white text-[10px] font-medium rounded-full w-4 h-4 flex items-center justify-center">
              {totalCount}
            </span>
          )}
        </div>
        <button
          onClick={onFileOrder}
          aria-label="File a new order"
          className="text-xs text-white font-medium flex items-center gap-1 bg-slate-800 rounded-md px-2.5 py-1 hover:bg-slate-900 cursor-pointer transition-colors"
        >
          <Truck className="w-3 h-3" />
          File Order for Tatsumi
        </button>
      </div>

      {/* Manual shipment tasks for this route */}
      {tasks.length > 0 && (
        <div className="space-y-1 mt-2">
          {tasks.map((task) => (
            <TaskRow key={task.task_id} task={task} warehouse={warehouse} profileMap={profileMap} onMarkDone={onMarkDone} />
          ))}
        </div>
      )}

      {/* Pending US orders */}
      {orders.length === 0 && tasks.length === 0 ? (
        <p className="text-xs text-slate-300 mt-2">—</p>
      ) : orders.length > 0 ? (
        <div className="space-y-1 mt-2">
          {orders.map((order) => (
            <button
              key={order.order_id}
              onClick={() => router.push('/inventory')}
              className="w-full flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors text-left"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-800">{order.customer_name}</span>
                  <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded-full ${
                    order.status === 'pending' ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'
                  }`}>
                    {order.status}
                  </span>
                  <span className="text-xs text-slate-400">{order.order_number}</span>
                </div>
                <div className="flex flex-wrap gap-x-3 mt-0.5">
                  {order.items.map((item, i) => (
                    <span key={i} className="text-xs text-slate-500">
                      {item.sku_name} × {item.quantity}
                    </span>
                  ))}
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

// ── Inline Create Form ──

function CreateTaskForm({
  route, taskType, skus, profiles, warehouse, showCustomer, onCreated, onCancel,
}: {
  route: string
  taskType: 'sample' | 'order'
  skus: SkuOption[]
  profiles: Pick<Profile, 'id' | 'name'>[]
  warehouse: string
  showCustomer?: boolean
  onCreated: (task: TaskWithItems) => void
  onCancel: () => void
}) {
  const [customerName, setCustomerName] = useState('')
  const [assignedTo, setAssignedTo] = useState('')
  const [items, setItems] = useState([{ sku_id: '', qty: 1 }])
  const [submitting, setSubmitting] = useState(false)

  function addItem() {
    setItems((prev) => [...prev, { sku_id: '', qty: 1 }])
  }

  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx))
  }

  function updateItem(idx: number, field: 'sku_id' | 'qty', value: string | number) {
    setItems((prev) => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item))
  }

  async function handleSubmit() {
    const validItems = items.filter((i) => i.sku_id && i.qty > 0)
    if (validItems.length === 0) return

    setSubmitting(true)
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task_type: taskType,
          route,
          customer_name: customerName || null,
          assigned_to: assignedTo || null,
          items: validItems,
        }),
      })
      if (res.ok) {
        const tasksRes = await fetch('/api/tasks')
        const allTasks = await tasksRes.json()
        const created = allTasks[0]
        onCreated(created)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="border border-slate-200 rounded-lg p-3 space-y-3 bg-slate-50/50 mt-2">
      {showCustomer && (
        <input
          type="text"
          placeholder="Customer name"
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
        />
      )}

      <div className="space-y-2">
        {items.map((item, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <select
              value={item.sku_id}
              onChange={(e) => updateItem(idx, 'sku_id', e.target.value)}
              className="flex-1 text-sm border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="">Select SKU</option>
              {skus.map((s) => (
                <option key={s.sku_id} value={s.sku_id}>{s.sku_name}</option>
              ))}
            </select>
            <input
              type="number"
              min={1}
              value={item.qty}
              onChange={(e) => updateItem(idx, 'qty', parseInt(e.target.value) || 1)}
              className="w-16 text-sm border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-green-500 text-center"
            />
            {items.length > 1 && (
              <button onClick={() => removeItem(idx)} className="text-slate-400 hover:text-red-500">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        ))}
        <button onClick={addItem} className="text-xs text-slate-500 hover:text-slate-700 font-medium">
          + Add item
        </button>
      </div>

      <select
        value={assignedTo}
        onChange={(e) => setAssignedTo(e.target.value)}
        className="w-full text-sm border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-green-500"
      >
        <option value="">Assign to (optional)</option>
        {profiles.map((p) => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>

      <div className="flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={submitting || items.every((i) => !i.sku_id)}
          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 text-white hover:bg-slate-900 disabled:opacity-50 transition-colors"
        >
          {submitting ? 'Creating...' : 'Create'}
        </button>
      </div>
    </div>
  )
}
