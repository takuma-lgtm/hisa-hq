'use client'

import { Plus } from 'lucide-react'
import {
  PopoverRoot,
  PopoverTrigger,
  PopoverContent,
} from '@/components/ui/popover'
import AddLeadsPanel from './AddLeadsPanel'

export default function AddLeadsButton() {
  return (
    <PopoverRoot className="z-50">
      <PopoverTrigger
        variant="default"
        className="bg-green-700 hover:bg-green-800 text-white"
      >
        <span className="inline-flex items-center gap-1.5">
          <Plus className="w-3.5 h-3.5" />
          Add Leads
        </span>
      </PopoverTrigger>
      <PopoverContent className="right-0 top-full mt-2 w-[780px] max-h-[80vh] overflow-auto bg-white border border-slate-200 shadow-xl">
        <AddLeadsPanel />
      </PopoverContent>
    </PopoverRoot>
  )
}
