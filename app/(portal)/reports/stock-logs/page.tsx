"use client"

import { SectionHeader } from "@/components/ui/section-header"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table } from "@/components/ui/table"
import { CalendarRange, SlidersHorizontal, Download } from "lucide-react"

export default function StockLogsPage() {
  return (
    <div className="space-y-6">
      <SectionHeader title="Stock Logs" subtitle="Detailed stock movements and changes" />

      <Card className="p-4">
        <div className="flex items-center gap-3">
          <div className="relative max-w-xs">
            <CalendarRange className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Select Dates" className="pl-9" />
          </div>
          <Button variant="secondary" className="gap-2">
            <SlidersHorizontal className="h-4 w-4" />
            Filter
          </Button>
          <div className="flex-1" />
          <Button className="gap-2">
            <Download className="h-4 w-4" />
            Export Excel
          </Button>
        </div>
      </Card>

      <Card>
        <Table>
          <thead>
            <tr>
              <th className="text-left p-4 font-medium">Timestamp</th>
              <th className="text-left p-4 font-medium">Entity</th>
              <th className="text-left p-4 font-medium">Action</th>
              <th className="text-left p-4 font-medium">User</th>
              <th className="text-left p-4 font-medium">Details</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="p-4 text-gray-500" colSpan={5}>No data</td>
            </tr>
          </tbody>
        </Table>
      </Card>
    </div>
  )
}


