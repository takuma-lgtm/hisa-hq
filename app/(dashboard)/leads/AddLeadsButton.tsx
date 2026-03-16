'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import AddLeadsPanel from './AddLeadsPanel'

export default function AddLeadsButton() {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-green-700 hover:bg-green-800 text-white">
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          Add Leads
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-auto p-0">
        <DialogTitle className="sr-only">Add Leads</DialogTitle>
        <AddLeadsPanel onClose={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  )
}
