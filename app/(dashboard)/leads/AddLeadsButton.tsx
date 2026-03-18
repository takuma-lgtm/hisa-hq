'use client'

import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { Button } from '@/components/ui/button'
import AddLeadsPanel from './AddLeadsPanel'

export default function AddLeadsButton() {
  const [open, setOpen] = useState(false)

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger asChild>
        <Button className="bg-slate-800 hover:bg-slate-900 text-white">
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          Add Leads
        </Button>
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          onOpenAutoFocus={e => e.preventDefault()}
          className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 bg-white shadow-xl rounded-lg overflow-auto data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
          style={{ width: 'min(95vw, 1200px)', maxHeight: '90vh' }}
        >
          <DialogPrimitive.Title className="sr-only">Add Leads</DialogPrimitive.Title>
          <DialogPrimitive.Close className="absolute right-4 top-4 z-10 rounded-sm opacity-70 hover:opacity-100 transition-opacity">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
          <AddLeadsPanel onClose={() => setOpen(false)} />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
