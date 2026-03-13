"use client"

import { useState, useMemo, useCallback } from "react"
import useSWR from "swr"
import { useAppContext } from "@/components/context/app-context"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Loader2, TrendingUp, ShoppingBag, 
  BarChart3, RefreshCw, Search, FileText, 
  FileSpreadsheet, FileIcon as FilePdf, Download,
  Building2, Package, Calculator
} from "lucide-react"
import { formatPKR, cn } from "@/lib/utils"
import * as XLSX from "xlsx"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { GlobalDateFilter, type FilterPreset, getPresetRange } from "@/components/dashboard/global-date-filter"
import { BranchFilter } from "@/components/reports/branch-filter"
import { GroupFilter } from "@/components/reports/group-filter"
import { ScheduleReportModal } from "@/components/reports/schedule-report-modal"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export default function PurchaseReportPage() {
  const {
    organizationId,
    branchId: contextBranchId,
    branchIds: contextBranchIds,
    setBranchIds: setContextBranchIds
  } = useAppContext()

  const [searchTerm, setSearchTerm] = useState("")
  
  // Date and Comparison State
  const [dateRange, setDateRange] = useState<{ startDate: Date, endDate: Date }>(() => {
    const end = new Date()
    const start = new Date()
    start.setDate(1) // Start of month
    return { startDate: start, endDate: end }
  })
  const [activePreset, setActivePreset] = useState<FilterPreset>("thisMonth")
  const [compare, setCompare] = useState(false)
  const [compareRange, setCompareRange] = useState<{ startDate: Date, endDate: Date } | null>(null)

  // Filters
  const [selectedBranchId, setSelectedBranchId] = useState<string>("all")
  const [selectedGroupId, setSelectedGroupId] = useState<string>("all")

  const handleDateChange = useCallback((range: { startDate: Date; endDate: Date } | null, preset: FilterPreset, compareMode?: boolean, compRange?: { startDate: Date; endDate: Date } | null) => {
    if (range) setDateRange(range)
    setActivePreset(preset)
    if (compareMode !== undefined) setCompare(compareMode)
    if (compRange !== undefined) setCompareRange(compRange)
  }, [])

  const handleBranchChange = useCallback((id: string) => {
    setSelectedBranchId(id)
  }, [])

  const handleGroupChange = useCallback((id: string) => {
    setSelectedGroupId(id)
  }, [])

  // Build API URL
  const queryParams = useMemo(() => {
    const params = new URLSearchParams()
    if (organizationId) params.set("organizationId", organizationId)
    
    // Use multi-branch if selected in context, or specific branch if selected in report filter
    if (selectedBranchId !== "all") {
      params.set("branchId", selectedBranchId)
    } else if (contextBranchIds.length > 0) {
      params.set("branchIds", contextBranchIds.join(","))
    } else if (contextBranchId) {
      params.set("branchId", contextBranchId)
    }

    if (selectedGroupId !== "all") params.set("groupId", selectedGroupId)
    
    params.set("startDate", dateRange.startDate.toISOString())
    params.set("endDate", dateRange.endDate.toISOString())
    
    if (compare) {
      params.set("compare", "true")
      if (compareRange) {
        params.set("compareStartDate", compareRange.startDate.toISOString())
        params.set("compareEndDate", compareRange.endDate.toISOString())
      }
    }
    
    return params.toString()
  }, [organizationId, contextBranchId, contextBranchIds, selectedBranchId, selectedGroupId, dateRange, compare, compareRange])

  const { data, isLoading, mutate } = useSWR(`/api/v1/analytics/sales-performance?${queryParams}`, fetcher)

  const purchaseData = data?.branchSales || []
  const summary = data?.totalSales || 0
  const totalOrders = data?.totalOrders || 0
  const avgOrderValue = totalOrders > 0 ? summary / totalOrders : 0
  
  const comparison = data?.comparison

  const filteredBranches = useMemo(() => {
    return purchaseData.filter((b: any) => 
      b.branchName.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [purchaseData, searchTerm])

  const handleExport = (format: 'csv' | 'excel' | 'pdf') => {
    const headers = ["Branch Name", "Purchases (PKR)", "Orders", "Avg Ticket"]
    const rows = filteredBranches.map((b: any) => [
      b.branchName,
      b.sales.toFixed(2),
      b.orders,
      (b.orders > 0 ? b.sales / b.orders : 0).toFixed(2)
    ])

    if (format === 'pdf') {
      const doc = new jsPDF()
      doc.text("Purchase Intelligence Report", 14, 20)
      autoTable(doc, {
        startY: 30,
        head: [headers],
        body: rows,
      })
      doc.save(`purchase-report-${Date.now()}.pdf`)
      return
    }

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Purchases")
    XLSX.writeFile(wb, `purchase-report-${Date.now()}.${format === 'excel' ? 'xlsx' : 'csv'}`)
  }

  const getTrend = (current: number, prev: number) => {
    if (!prev || prev === 0) return null
    const diff = ((current - prev) / prev) * 100
    return {
      value: Math.abs(diff).toFixed(1),
      isUp: diff > 0,
      isDown: diff < 0
    }
  }

  const purchaseTrend = comparison ? getTrend(summary, comparison.totalSales) : null

  return (
    <div className="space-y-6 bg-slate-50 dark:bg-slate-950 min-h-screen">
      {/* ━━━ GLOBAL STICKY HEADER ━━━ */}
      <div className="sticky top-0 z-30 flex flex-wrap items-center gap-3 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 p-4 shadow-sm">
        <GlobalDateFilter
          value={dateRange}
          onChange={handleDateChange}
          activePreset={activePreset}
          compare={compare}
          compareRange={compareRange}
        />
        <GroupFilter 
          value={selectedGroupId} 
          onChange={handleGroupChange} 
          organizationId={organizationId || undefined}
        />
        <BranchFilter 
          value={selectedBranchId} 
          onChange={handleBranchChange}
          organizationId={organizationId || undefined}
          groupId={selectedGroupId !== "all" ? selectedGroupId : undefined}
        />
        <div className="flex-1" />
        <ScheduleReportModal reportName="Purchase Report" />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => mutate()}
          disabled={isLoading}
          className="h-9 text-[12px] font-bold bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 rounded-full px-4"
        >
          <RefreshCw className={`h-3.5 w-3.5 mr-2 ${isLoading ? "animate-spin" : ""}`} />
          REFRESH
        </Button>
      </div>

      <div className="px-4 md:px-6 space-y-6">
        {/* ━━━ "INTELLIGENCE" HEADER ━━━ */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#0f172a] via-[#1e293b] to-[#334155] px-8 py-8 text-white shadow-2xl ring-1 ring-white/10">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2 opacity-80">
                <Building2 className="h-4 w-4 text-indigo-400" />
                <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Head Office Analytics</span>
              </div>
              <h1 className="text-4xl font-extrabold tracking-tight">Purchase <span className="text-indigo-400">Intelligence</span></h1>
              <p className="max-w-xl text-sm font-medium text-slate-400">
                Track branch-level procurement and purchase volumes across your entire organization.
              </p>
            </div>
          </div>
          
          {/* Abstract BG Decorations */}
          <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-indigo-500/10 blur-[100px]" />
          <div className="absolute -left-20 -bottom-20 h-64 w-64 rounded-full bg-blue-500/10 blur-[100px]" />
        </div>

        {/* ━━━ KPI BENTO GRID ━━━ */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-6 border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
              <ShoppingBag className="h-12 w-12" />
            </div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Total Purchases</p>
            <div className="flex items-baseline gap-2">
              <h2 className="text-3xl font-black text-slate-900 dark:text-white">{formatPKR(summary)}</h2>
              {purchaseTrend && (
                <span className={cn(
                  "text-[10px] font-bold px-1.5 py-0.5 rounded-md flex items-center gap-1",
                  purchaseTrend.isUp ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
                )}>
                  {purchaseTrend.isUp ? "↑" : "↓"} {purchaseTrend.value}%
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-2">Gross expenditure across all branches.</p>
          </Card>

          <Card className="p-6 border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm relative overflow-hidden group">
             <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
              <Package className="h-12 w-12" />
            </div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Order Volume</p>
            <h2 className="text-3xl font-black text-slate-900 dark:text-white">{totalOrders.toLocaleString()}</h2>
            <p className="text-xs text-slate-400 mt-2">Total procurement tickets processed.</p>
          </Card>

          <Card className="p-6 border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
              <Calculator className="h-12 w-12" />
            </div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Average Ticket</p>
            <h2 className="text-3xl font-black text-slate-900 dark:text-white">{formatPKR(avgOrderValue)}</h2>
            <p className="text-xs text-slate-400 mt-2">Mean value per purchase order.</p>
          </Card>
        </div>

        {/* ━━━ DETAILED DATA TABLE ━━━ */}
        <Card className="overflow-hidden border border-slate-200 dark:border-slate-800 shadow-xl bg-white dark:bg-slate-900">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-wrap justify-between items-center gap-4 bg-slate-50/50 dark:bg-slate-900/50">
            <h3 className="font-bold text-xs uppercase tracking-widest text-slate-400 flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Branch Level Breakdown
            </h3>
            
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <Input
                  placeholder="Search Branch..."
                  className="pl-8 h-8 w-48 text-xs bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-700"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" className="h-8 text-[10px] font-bold bg-slate-900 dark:bg-white text-white dark:text-slate-900 gap-2">
                    <Download className="h-3 w-3" /> EXPORT
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  <DropdownMenuItem onClick={() => handleExport('csv')} className="text-xs cursor-pointer"><FileText className="mr-2 h-4 w-4" /> CSV</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport('excel')} className="text-xs cursor-pointer"><FileSpreadsheet className="mr-2 h-4 w-4" /> Excel</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport('pdf')} className="text-xs cursor-pointer"><FilePdf className="mr-2 h-4 w-4" /> PDF</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/50 dark:bg-slate-800/30">
                  <TableHead className="pl-6 h-12 text-[10px] font-bold uppercase tracking-widest text-slate-500">Branch Name</TableHead>
                  <TableHead className="h-12 text-[10px] font-bold uppercase tracking-widest text-slate-500 text-center">Orders</TableHead>
                  <TableHead className="h-12 text-[10px] font-bold uppercase tracking-widest text-slate-500 text-center">Avg Ticket</TableHead>
                  <TableHead className="pr-6 h-12 text-[10px] font-bold uppercase tracking-widest text-slate-500 text-right">Total Purchases</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={4} className="h-40 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-slate-300" /></TableCell></TableRow>
                ) : filteredBranches.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="h-40 text-center text-slate-400 italic">No branch data available for this range.</TableCell></TableRow>
                ) : (
                  filteredBranches.map((b: any) => (
                    <TableRow key={b.branchId} className="hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors">
                      <TableCell className="pl-6 py-4">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-bold text-xs text-slate-900 dark:text-white">{b.branchName}</span>
                          <span className="text-[10px] text-slate-400 font-medium">ID: {b.branchId}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="font-mono text-[10px] font-bold bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                          {b.orders}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center font-mono text-xs text-slate-500">
                        {formatPKR(b.orders > 0 ? b.sales / b.orders : 0)}
                      </TableCell>
                      <TableCell className="pr-6 text-right font-black text-xs text-slate-900 dark:text-white">
                        {formatPKR(b.sales)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>
    </div>
  )
}
