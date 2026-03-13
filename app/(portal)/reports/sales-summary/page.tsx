"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import useSWR from "swr"
import { useAppContext } from "@/components/context/app-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Loader2, ShoppingBag, TrendingUp, Calculator, Upload,
  Crown, RefreshCw, Search, FileText, FileSpreadsheet, FileIcon as FilePdf,
  DollarSign, Package, BarChart3, ListOrdered
} from "lucide-react"
import * as XLSX from "xlsx"
import { formatPKR, cn } from "@/lib/utils"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import { Badge } from "@/components/ui/badge"
import { Role } from "@/lib/rbac"
import { useSession } from "next-auth/react"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import { ColumnSelector, useColumnSelector, type ColumnDef } from "@/components/reports/column-selector"
import { ExpandableRowDrawer, type DetailField } from "@/components/reports/expandable-row-drawer"
import { ScheduleReportModal } from "@/components/reports/schedule-report-modal"
import { GlobalDateFilter, type FilterPreset, getPresetRange } from "@/components/dashboard/global-date-filter"
import { BranchFilter } from "@/components/reports/branch-filter"
import { GroupFilter } from "@/components/reports/group-filter"

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

// Column definitions for the Orders ledger
const ORDER_COLUMNS: ColumnDef[] = [
  { key: "date", label: "Date", defaultVisible: true },
  { key: "tid", label: "Transaction ID", defaultVisible: true },
  { key: "branch", label: "Branch", defaultVisible: true },
  { key: "status", label: "Status", defaultVisible: true },
  { key: "subtotal", label: "Subtotal", defaultVisible: true },
  { key: "tax", label: "Tax", defaultVisible: true },
  { key: "discount", label: "Discount", defaultVisible: false },
  { key: "total", label: "Total", defaultVisible: true },
  { key: "organization", label: "Organization", defaultVisible: false },
  { key: "group", label: "Group", defaultVisible: false },
]

// Column definitions for the Line Items ledger
const ITEM_COLUMNS: ColumnDef[] = [
  { key: "date", label: "Date", defaultVisible: true },
  { key: "product", label: "Product / SKU", defaultVisible: true },
  { key: "branch", label: "Branch", defaultVisible: true },
  { key: "qty", label: "Qty", defaultVisible: true },
  { key: "unitPrice", label: "Unit Price", defaultVisible: true },
  { key: "lineTotal", label: "Line Total", defaultVisible: true },
  { key: "status", label: "Status", defaultVisible: true },
]

// Donut chart colors
const STATUS_COLORS: Record<string, string> = {
  FULFILLED: "#10b981",
  PENDING: "#f59e0b",
  CANCELLED: "#ef4444",
  REJECTED: "#ef4444",
  REFUNDED: "#8b5cf6",
}

export default function SalesSummaryPage() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const {
    organizationId,
    branchId: contextBranchId,
    branchIds: contextBranchIds,
    setBranchIds: setContextBranchIds
  } = useAppContext()

  const [orderSearch, setOrderSearch] = useState("")
  const [generatedDate, setGeneratedDate] = useState("")
  const [selectedRow, setSelectedRow] = useState<any>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [groupId, setGroupId] = useState("")
  const [orderDetails, setOrderDetails] = useState<any>(null)
  const [isDetailLoading, setIsDetailLoading] = useState(false)
  const [compare, setCompare] = useState(searchParams.get("compare") === "true")
  const [compareRange, setCompareRange] = useState<{ startDate: Date; endDate: Date } | null>(null)

  const { data: session } = useSession()
  const role = (session?.user as any)?.role as Role
  const [hasMounted, setHasMounted] = useState(false)

  // URL States
  const presetFromUrl = (searchParams.get("preset") as FilterPreset) || "today"
  const startFromUrl = searchParams.get("startDate") || ""
  const endFromUrl = searchParams.get("endDate") || ""
  const activePreset = presetFromUrl

  const dateRange = useMemo(() => {
    if (startFromUrl && endFromUrl) {
      return { startDate: new Date(startFromUrl), endDate: new Date(endFromUrl) }
    }
    return null
  }, [startFromUrl, endFromUrl])

  const handleDateChange = useCallback((range: { startDate: Date; endDate: Date } | null, preset: FilterPreset, compareMode?: boolean, compRange?: { startDate: Date; endDate: Date } | null) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set("preset", preset)
    if (compareMode !== undefined) {
      params.set("compare", String(compareMode))
      setCompare(compareMode)
    }
    if (compRange !== undefined) {
      setCompareRange(compRange)
    }

    // Calculate range for presets if not provided
    const finalRange = range || (preset !== "custom" ? getPresetRange(preset) : null)

    if (finalRange) {
      params.set("startDate", finalRange.startDate.toISOString())
      params.set("endDate", finalRange.endDate.toISOString())
    } else if (preset !== "custom") {
      // Fallback for custom with no range should not delete, but presets should always have range
      params.delete("startDate")
      params.delete("endDate")
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }, [searchParams, pathname, router])

  // Column selectors
  const { visibleKeys: orderVisibleKeys, isVisible: isOrderVisible, setVisibleKeys: setOrderVisibleKeys } = useColumnSelector(ORDER_COLUMNS, "sales-summary-orders-v2")

  const handleBranchChange = useCallback((ids: string[]) => {
    setContextBranchIds(ids)
  }, [setContextBranchIds])

  // Build query strings
  const queryParams = new URLSearchParams()
  if (organizationId) queryParams.set("organizationId", organizationId.toString())
  if (startFromUrl) queryParams.set("startDate", startFromUrl)
  if (endFromUrl) queryParams.set("endDate", endFromUrl)
  if (groupId) queryParams.set("groupId", groupId)
  if (contextBranchIds.length > 0) {
    queryParams.set("branchIds", contextBranchIds.join(","))
  } else if (contextBranchId) {
    queryParams.set("branchId", contextBranchId)
  }
  if (compare) {
    queryParams.set("compare", "true")
    if (compareRange) {
      queryParams.set("compareStartDate", compareRange.startDate.toISOString())
      queryParams.set("compareEndDate", compareRange.endDate.toISOString())
    }
  }

  // Orders summary (aggregated)
  const ordersParams = new URLSearchParams(queryParams.toString())
  ordersParams.set("limit", "10000")
  const { data, isLoading, mutate } = useSWR(`/api/v1/analytics/summary?${ordersParams.toString()}`, fetcher)

  useEffect(() => {
    setHasMounted(true)
    setGeneratedDate(new Date().toLocaleString())
  }, [])

  const summary = data?.summary || { totalSales: 0, totalTax: 0, totalSubtotal: 0, orderCount: 0, totalItemsSold: 0 }
  const orders = data?.orders || []
  const topPerformers = data?.topPerformers || []

  // Filtered data
  const filteredOrders = orders.filter((order: any) =>
    order.tid?.toLowerCase().includes(orderSearch.toLowerCase()) ||
    order.status?.toLowerCase().includes(orderSearch.toLowerCase()) ||
    (order.branchName && order.branchName.toLowerCase().includes(orderSearch.toLowerCase()))
  )

  // KPIs (real values from API)
  const totalRevenue = summary.totalSales || 0
  const orderCount = summary.orderCount || 0
  const avgOrderValue = orderCount > 0 ? totalRevenue / orderCount : 0
  const totalItemsSold = Number(summary.totalItemsSold) || 0
  const totalTax = Number(summary.totalTax) || 0

  // Comparison logic calculations
  const comparison = summary.comparison
  const getTrend = (current: number, prev: number) => {
    if (!prev || prev === 0) return null
    const diff = ((current - prev) / prev) * 100
    return {
      value: Math.abs(diff).toFixed(1),
      isUp: diff > 0,
      isDown: diff < 0
    }
  }

  const revenueTrend = getTrend(totalRevenue, comparison?.totalSales || 0)
  const orderTrend = getTrend(orderCount, comparison?.orderCount || 0)

  // Daily revenue chart data
  const dailyChartData = useMemo(() => {
    if (!filteredOrders.length) return []
    const daily: Record<string, { revenue: number; orders: number }> = {}
    const sorted = [...filteredOrders].sort((a: any, b: any) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    )
    sorted.forEach((o: any) => {
      if ((o.status || "").toUpperCase() === "FULFILLED") {
        const day = new Date(o.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })
        if (!daily[day]) daily[day] = { revenue: 0, orders: 0 }
        daily[day].revenue += (o.totalCents || 0) / 100
        daily[day].orders += 1
      }
    })
    return Object.entries(daily).map(([date, d]) => ({ date, revenue: d.revenue, orders: d.orders }))
  }, [filteredOrders])

  // Status breakdown for donut chart
  const statusChartData = useMemo(() => {
    if (!orders.length) return []
    const counts: Record<string, number> = {}
    orders.forEach((o: any) => {
      const s = (o.status || "UNKNOWN").toUpperCase()
      counts[s] = (counts[s] || 0) + 1
    })
    return Object.entries(counts).map(([name, value]) => ({ name, value }))
  }, [orders])

  const handleRowClick = async (order: any) => {
    setSelectedRow(order)
    setDrawerOpen(true)
    setOrderDetails(null)
    setIsDetailLoading(true)
    try {
      const res = await fetch(`/api/v1/orders/${order.id}`)
      const d = await res.json()
      if (d.item) {
        setOrderDetails(d.item)
      }
    } catch (e) {
      console.error("Failed to fetch order details", e)
    } finally {
      setIsDetailLoading(false)
    }
  }

  const getOrderDrawerFields = (order: any): DetailField[] => {
    const fields: DetailField[] = [
      { type: "section", label: "Order Overview", value: null },
      { key: "tid", label: "Transaction ID", value: order.tid, type: "mono" },
      { key: "date", label: "Date", value: new Date(order.createdAt).toLocaleString(), type: "date" },
      { key: "branch", label: "Branch", value: order.branchName || `ID: ${order.branchId}` },
      { key: "status", label: "Status", value: order.status, type: "badge" },

      {
        type: "section", label: "Financial Summary", value: (
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Subtotal</p>
              <p className="text-sm font-bold text-slate-900 dark:text-white font-mono">{formatPKR((order.subtotalCents || 0) / 100)}</p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Tax</p>
              <p className="text-sm font-bold text-slate-900 dark:text-white font-mono">{formatPKR((order.taxCents || 0) / 100)}</p>
            </div>
            <div className="p-4 rounded-2xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-100/50 dark:border-rose-900/30">
              <p className="text-[10px] font-bold text-rose-400 uppercase tracking-widest mb-1">Discount</p>
              <p className="text-sm font-bold text-rose-600 dark:text-rose-400 font-mono">-{formatPKR((order.discountCents || 0) / 100)}</p>
            </div>
            <div className="p-4 rounded-2xl bg-indigo-600 shadow-lg shadow-indigo-500/20 text-white">
              <p className="text-[10px] font-bold text-indigo-100 uppercase tracking-widest mb-1">Total</p>
              <p className="text-base font-black font-mono leading-none">{formatPKR((order.totalCents || 0) / 100)}</p>
            </div>
          </div>
        )
      },

      {
        type: "section", label: "Line Items", value: (
          <div className="space-y-3">
            {isDetailLoading ? (
              <div className="flex flex-col items-center justify-center py-12 rounded-3xl bg-slate-50/50 dark:bg-slate-900/30 border border-dashed border-slate-200 dark:border-slate-800/50">
                <Loader2 className="h-6 w-6 animate-spin text-indigo-500 mb-2" />
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Syncing line items...</p>
              </div>
            ) : orderDetails?.orderItems && orderDetails.orderItems.length > 0 ? (
              <div className="overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {orderDetails.orderItems.map((item: any, idx: number) => (
                    <div key={idx} className="p-5 flex justify-between items-start gap-6 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors group/item">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <div className="w-2 h-2 rounded-full bg-indigo-500" />
                          <p className="font-black text-slate-900 dark:text-white leading-tight truncate text-[13px]">{item.productName}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[9px] font-bold font-mono text-slate-500 uppercase">{item.productCode || 'N/A'}</span>
                          <span className="text-[11px] font-bold text-slate-400">{item.quantity} × {item.unit || 'units'}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[12px] font-black font-mono text-slate-900 dark:text-white">{formatPKR((item.priceCents * item.quantity) / 100)}</p>
                        <p className="text-[10px] font-bold text-indigo-500 mt-1">@ {formatPKR(item.priceCents / 100)}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="bg-slate-50/50 dark:bg-slate-800/30 p-4 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-slate-400">
                    <span>Items Count</span>
                    <span className="text-slate-900 dark:text-white">{orderDetails.orderItems.length} Products</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl">
                <ShoppingBag className="h-8 w-8 opacity-10 mb-2" />
                <p className="text-[10px] font-black uppercase tracking-widest italic">No item data found</p>
              </div>
            )}
          </div>
        )
      }
    ]

    return fields
  }

  const handleExport = (format: 'csv' | 'excel' | 'pdf') => {
    const headers = ["Date", "Transaction ID", "Organization", "Group", "Branch", "Status", "Subtotal (PKR)", "Tax (PKR)", "Total (PKR)"]
    const rows = filteredOrders.map((order: any) => [
      new Date(order.createdAt).toLocaleDateString(),
      order.tid,
      order.organizationName || '-',
      order.groupName || '-',
      order.branchName || `ID: ${order.branchId}`,
      order.status?.toUpperCase(),
      ((order.subtotalCents || 0) / 100).toFixed(2),
      ((order.taxCents || 0) / 100).toFixed(2),
      ((order.totalCents || 0) / 100).toFixed(2),
    ])
    if (format === 'pdf') {
      const doc = new jsPDF()
      doc.setFontSize(18); doc.text("Sales Summary — Orders", 14, 20)
      doc.setFontSize(10); doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28)
      autoTable(doc, { startY: 38, head: [headers], body: rows, theme: 'grid', headStyles: { fillColor: [79, 70, 229] } })
      doc.save(`sales-orders-${Date.now()}.pdf`); return
    }
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Orders")
    XLSX.writeFile(wb, `sales-orders-${Date.now()}.${format === 'excel' ? 'xlsx' : 'csv'}`)
  }

  // Custom tooltip for bar chart
  const BarTooltip = ({ active, payload, label }: any) => {
    if (active && payload?.length) {
      return (
        <div className="bg-slate-900 border border-slate-700 rounded-xl p-3 shadow-2xl text-xs space-y-1.5 min-w-[160px]">
          <p className="text-slate-300 font-semibold mb-2">{label}</p>
          {payload.map((entry: any, i: number) => (
            <div key={i} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.fill || entry.color }} />
                <span className="text-slate-400">{entry.name}</span>
              </div>
              <span className="text-white font-bold font-mono">
                {entry.name === "Revenue (PKR)" ? formatPKR(entry.value) : entry.value}
              </span>
            </div>
          ))}
        </div>
      )
    }
    return null
  }

  // Donut custom label
  const renderDonutLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }: any) => {
    if (percent < 0.05) return null
    const RADIAN = Math.PI / 180
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5
    const x = cx + radius * Math.cos(-midAngle * RADIAN)
    const y = cy + radius * Math.sin(-midAngle * RADIAN)
    return (
      <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight="700">
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    )
  }

  if (!hasMounted) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0b0f1a] pb-16">

      {/* ── Banking-Grade Filter Toolbar ── */}
      <div className="sticky top-0 z-40 bg-white/80 dark:bg-[#0b0f1a]/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 px-6 h-14 flex items-center shadow-sm">
        <div className="flex items-center gap-3">
          <GlobalDateFilter
            value={dateRange}
            onChange={handleDateChange}
            activePreset={activePreset}
            hidePresets={false}
            compare={compare}
            compareRange={compareRange}
          />

          {(role === "SUPER_ADMIN" || role === "HEAD_OFFICE") && (
            <div className="flex items-center gap-2 h-6 pl-3 border-l border-slate-200 dark:border-slate-800">
              <BranchFilter selectedIds={contextBranchIds} onChange={handleBranchChange} organizationId={organizationId || undefined} />
              <GroupFilter value={groupId} onChange={setGroupId} organizationId={organizationId || undefined} />
            </div>
          )}
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-4">
          <ScheduleReportModal reportName="Sales Summary" />
        </div>
      </div>

      <div className="px-4 md:px-6 pt-6 space-y-6">

        <div className="px-6 py-8 space-y-8 max-w-[1600px] mx-auto">

          {/* ── Page Header (Refined) ── */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-indigo-500/80 mb-2">
                <div className="w-8 h-[1px] bg-indigo-500/30" />
                Records & Reports
              </div>
              <h1 className="text-4xl font-black tracking-tighter text-slate-900 dark:text-white flex items-center gap-3">
                Sales Summary
                <Badge variant="outline" className="h-5 text-[9px] font-black uppercase tracking-widest border-emerald-500/20 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400">Live</Badge>
              </h1>
              <p className="text-sm font-medium text-slate-400 dark:text-slate-500 max-w-xl">
                Consolidated financial oversight across all branches and groups.
              </p>
            </div>
          </div>

          {/* ── KPI Grid (2-Column Focused) ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

            {/* Revenue */}
            <Card className="relative overflow-hidden group bg-white dark:bg-slate-900/50 border-slate-100 dark:border-slate-800/50 shadow-xl shadow-slate-200/50 dark:shadow-none hover:shadow-indigo-500/10 transition-all duration-500 rounded-3xl pt-2">
              <CardContent className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <div className="p-4 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                    <DollarSign className="h-6 w-6" />
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-none font-black text-[10px] px-2.5 py-1 tracking-tighter uppercase">Fulfilled</Badge>
                    {revenueTrend && (
                      <div className={cn(
                        "flex items-center gap-1 text-[10px] font-black tracking-tighter",
                        revenueTrend.isUp ? "text-emerald-500" : revenueTrend.isDown ? "text-rose-500" : "text-slate-400"
                      )}>
                        {revenueTrend.isUp ? "↑" : revenueTrend.isDown ? "↓" : "•"} {revenueTrend.value}%
                      </div>
                    )}
                  </div>
                </div>
                <p className="text-[12px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Total Revenue</p>
                <div className="flex items-baseline gap-3">
                  <h3 className="text-4xl font-black tracking-tight text-slate-900 dark:text-white font-mono leading-none">
                    {isLoading ? <Loader2 className="h-8 w-8 animate-spin text-slate-200" /> : formatPKR(totalRevenue / 100)}
                  </h3>
                  {compare && comparison && (
                    <span className="text-xs font-bold text-slate-400 dark:text-slate-600 line-through opacity-50">
                      {formatPKR(comparison.totalSales / 100)}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Orders */}
            <Card className="relative overflow-hidden group bg-white dark:bg-slate-900/50 border-slate-100 dark:border-slate-800/50 shadow-xl shadow-slate-200/50 dark:shadow-none hover:shadow-blue-500/10 transition-all duration-500 rounded-3xl pt-2">
              <CardContent className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <div className="p-4 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                    <ShoppingBag className="h-6 w-6" />
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-900/30">
                      <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                      <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-tighter">Live Monitor</span>
                    </div>
                    {orderTrend && (
                      <div className={cn(
                        "flex items-center gap-1 text-[10px] font-black tracking-tighter",
                        orderTrend.isUp ? "text-emerald-500" : orderTrend.isDown ? "text-rose-500" : "text-slate-400"
                      )}>
                        {orderTrend.isUp ? "↑" : orderTrend.isDown ? "↓" : "•"} {orderTrend.value}%
                      </div>
                    )}
                  </div>
                </div>
                <p className="text-[12px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Total Order Volume</p>
                <div className="flex items-baseline gap-3">
                  <h3 className="text-5xl font-black tracking-tight text-slate-900 dark:text-white leading-none">
                    {isLoading ? <Loader2 className="h-8 w-8 animate-spin text-slate-200" /> : orderCount.toLocaleString()}
                  </h3>
                  {compare && comparison && (
                    <span className="text-xs font-bold text-slate-400 dark:text-slate-600 line-through opacity-50">
                      {comparison.orderCount.toLocaleString()}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ── Charts ── */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

            {/* Daily Revenue Bar Chart */}
            <Card className="xl:col-span-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
              <CardHeader className="px-5 pt-5 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-indigo-500" />
                  <CardTitle className="text-sm font-semibold text-slate-800 dark:text-slate-200">Daily Revenue & Order Volume</CardTitle>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">Fulfilled orders only · grouped by day</p>
              </CardHeader>
              <CardContent className="p-4">
                <div className="h-[300px]">
                  {isLoading ? (
                    <div className="h-full flex items-center justify-center">
                      <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
                    </div>
                  ) : dailyChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={dailyChartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }} barCategoryGap="30%">
                        <defs>
                          <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#6366f1" stopOpacity={1} />
                            <stop offset="100%" stopColor="#818cf8" stopOpacity={0.7} />
                          </linearGradient>
                          <linearGradient id="ordGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#06b6d4" stopOpacity={1} />
                            <stop offset="100%" stopColor="#22d3ee" stopOpacity={0.6} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" className="dark:stroke-slate-700" />
                        <XAxis
                          dataKey="date"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 11, fill: '#94a3b8' }}
                          dy={8}
                        />
                        <YAxis
                          yAxisId="rev"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 11, fill: '#94a3b8' }}
                          tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                          width={45}
                        />
                        <YAxis
                          yAxisId="ord"
                          orientation="right"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 11, fill: '#94a3b8' }}
                          width={30}
                        />
                        <Tooltip content={<BarTooltip />} cursor={{ fill: 'rgba(99,102,241,0.06)', radius: 6 }} />
                        <Legend
                          iconType="circle"
                          iconSize={8}
                          wrapperStyle={{ paddingTop: 16, fontSize: 12, color: '#64748b' }}
                        />
                        <Bar yAxisId="rev" dataKey="revenue" name="Revenue (PKR)" fill="url(#revGrad)" radius={[5, 5, 0, 0]} maxBarSize={40} />
                        <Bar yAxisId="ord" dataKey="orders" name="Orders" fill="url(#ordGrad)" radius={[5, 5, 0, 0]} maxBarSize={20} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-3">
                      <TrendingUp className="h-10 w-10 opacity-20" />
                      <p className="text-sm font-medium">No fulfilled order data for this period</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Right panel: Status Breakdown + Top Branch */}
            <div className="flex flex-col gap-5">

              {/* Order Status Donut */}
              <Card className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex-1">
                <CardHeader className="px-5 pt-5 pb-3 border-b border-slate-100 dark:border-slate-800">
                  <CardTitle className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <ShoppingBag className="h-4 w-4 text-blue-500" />
                    Order Status Breakdown
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  {isLoading ? (
                    <div className="h-[170px] flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-slate-300" /></div>
                  ) : statusChartData.length > 0 ? (
                    <div className="flex flex-col items-center gap-3">
                      <div className="h-[150px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={statusChartData}
                              cx="50%"
                              cy="50%"
                              innerRadius={42}
                              outerRadius={70}
                              paddingAngle={3}
                              dataKey="value"
                              labelLine={false}
                              label={renderDonutLabel}
                            >
                              {statusChartData.map((entry, index) => (
                                <Cell
                                  key={`cell-${index}`}
                                  fill={STATUS_COLORS[entry.name] || "#94a3b8"}
                                />
                              ))}
                            </Pie>
                            <Tooltip
                              formatter={(value: any, name: any) => [value, name]}
                              contentStyle={{
                                background: '#1e293b', border: '1px solid #334155',
                                borderRadius: 8, fontSize: 12, color: '#e2e8f0'
                              }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      {/* Legend */}
                      <div className="flex flex-wrap gap-x-3 gap-y-1.5 justify-center">
                        {statusChartData.map((entry) => (
                          <div key={entry.name} className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: STATUS_COLORS[entry.name] || '#94a3b8' }} />
                            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">{entry.name}</span>
                            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">{entry.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="h-[170px] flex items-center justify-center text-slate-400 text-sm">No data</div>
                  )}
                </CardContent>
              </Card>

              {/* #1 Branch */}
              {topPerformers.length > 0 && (
                <Card className="rounded-2xl border border-emerald-200 dark:border-emerald-900/40 bg-white dark:bg-slate-900 shadow-sm">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <Crown className="h-4 w-4 text-amber-500" />
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">Top Branch</p>
                    </div>
                    <p className="text-base font-bold text-slate-900 dark:text-white truncate">
                      {topPerformers[0]?.branchName || `Branch #${topPerformers[0]?.branchId}`}
                    </p>
                    <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                      {formatPKR((topPerformers[0]?.sales || 0) / 100)}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1">{topPerformers[0]?.orderCount || 0} fulfilled orders</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          {/* ── Branch Leaderboard ── */}
          {topPerformers.length > 1 && (
            <Card className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
              <CardHeader className="px-5 pt-5 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <Crown className="h-4 w-4 text-amber-500" />
                    Branch Leaderboard
                  </CardTitle>
                  <Badge variant="secondary" className="text-[10px] font-bold tracking-widest bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-none uppercase">By Revenue</Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {topPerformers.slice(0, 8).map((p: any, i: number) => (
                    <div key={p.branchId} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0",
                          i === 0 ? "bg-amber-400 shadow-md shadow-amber-400/30" :
                            i === 1 ? "bg-slate-400" :
                              i === 2 ? "bg-orange-600" :
                                "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                        )}>
                          {i + 1}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-900 dark:text-white">
                            {p.branchName || `Branch #${p.branchId}`}
                          </p>
                          <p className="text-[11px] text-slate-400">{p.orderCount} fulfilled orders</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold font-mono text-slate-900 dark:text-white">{formatPKR(p.sales / 100)}</p>
                        {/* Revenue share bar */}
                        <div className="flex items-center gap-1.5 mt-1 justify-end">
                          <div className="w-20 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-indigo-500"
                              style={{ width: `${Math.max(4, ((p.sales / (topPerformers[0]?.sales || 1)) * 100))}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono w-8 text-right">
                            {((p.sales / (topPerformers[0]?.sales || 1)) * 100).toFixed(0)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Tab Bar: Orders | Line Items ── */}
          <Card className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">

            {/* Tab header */}
            <div className="px-5 pt-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
                <div className="flex items-center gap-2">
                  <ListOrdered className="h-4 w-4 text-indigo-500" />
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 uppercase tracking-tight">Order Activity Ledger</h3>
                  {!isLoading && <Badge variant="secondary" className="ml-1 h-4 text-[10px] px-1.5 font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-none">{filteredOrders.length}</Badge>}
                </div>

                {/* Search + Controls */}
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                    <Input
                      placeholder="Search by ID, branch…"
                      className="pl-8 h-8 w-56 text-xs bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-lg"
                      value={orderSearch}
                      onChange={(e) => setOrderSearch(e.target.value)}
                    />
                  </div>
                  <ColumnSelector columns={ORDER_COLUMNS} storageKey="sales-summary-orders-v2" visibleKeys={orderVisibleKeys} onChange={setOrderVisibleKeys} />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" className="h-8 text-[11px] font-bold bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 px-3 rounded-lg" disabled={isLoading}>
                        <Upload className="h-3.5 w-3.5" />
                        EXPORT
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="min-w-[148px] rounded-xl border border-slate-200 dark:border-slate-800 shadow-xl">
                      <DropdownMenuItem onClick={() => handleExport('csv')} className="text-xs font-medium cursor-pointer py-2">
                        <FileText className="mr-2. h-3.5 w-3.5 text-slate-400" /> CSV
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleExport('excel')} className="text-xs font-medium cursor-pointer py-2">
                        <FileSpreadsheet className="mr-2 h-3.5 w-3.5 text-emerald-500" /> Excel
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleExport('pdf')} className="text-xs font-medium cursor-pointer py-2">
                        <FilePdf className="mr-2 h-3.5 w-3.5 text-rose-500" /> PDF
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>

            {/* ── Orders Table ── */}
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 dark:bg-slate-800/30 border-b border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/30">
                    {isOrderVisible("date") && <TableHead className="pl-5 h-10 text-[10px] font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap">Date</TableHead>}
                    {isOrderVisible("tid") && <TableHead className="h-10 text-[10px] font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap">Transaction ID</TableHead>}
                    {isOrderVisible("organization") && <TableHead className="h-10 text-[10px] font-bold uppercase tracking-wider text-slate-500">Org</TableHead>}
                    {isOrderVisible("group") && <TableHead className="h-10 text-[10px] font-bold uppercase tracking-wider text-slate-500">Group</TableHead>}
                    {isOrderVisible("branch") && <TableHead className="h-10 text-[10px] font-bold uppercase tracking-wider text-slate-500">Branch</TableHead>}
                    {isOrderVisible("status") && <TableHead className="h-10 text-[10px] font-bold uppercase tracking-wider text-slate-500">Status</TableHead>}
                    {isOrderVisible("subtotal") && <TableHead className="text-right h-10 text-[10px] font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap">Subtotal</TableHead>}
                    {isOrderVisible("tax") && <TableHead className="text-right h-10 text-[10px] font-bold uppercase tracking-wider text-slate-500">Tax</TableHead>}
                    {isOrderVisible("discount") && <TableHead className="text-right h-10 text-[10px] font-bold uppercase tracking-wider text-slate-500">Discount</TableHead>}
                    {isOrderVisible("total") && <TableHead className="text-right pr-5 h-10 text-[10px] font-bold uppercase tracking-wider text-slate-500">Total</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={orderVisibleKeys.length} className="h-32 text-center">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto text-indigo-400" />
                      </TableCell>
                    </TableRow>
                  ) : filteredOrders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={orderVisibleKeys.length} className="h-32 text-center">
                        <div className="flex flex-col items-center justify-center text-slate-400 gap-2">
                          <Search className="h-8 w-8 opacity-20" />
                          <p className="text-sm text-slate-500">No orders found for the selected filters.</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredOrders.map((order: any) => (
                      <TableRow
                        key={order.id}
                        className="hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 cursor-pointer border-b border-slate-100 dark:border-slate-800/60 transition-colors"
                        onClick={() => handleRowClick(order)}
                      >
                        {isOrderVisible("date") && (
                          <TableCell className="pl-5 py-3 font-mono text-xs text-slate-500 whitespace-nowrap" suppressHydrationWarning>
                            {new Date(order.createdAt).toLocaleDateString()}
                          </TableCell>
                        )}
                        {isOrderVisible("tid") && (
                          <TableCell className="py-3 font-mono text-xs font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                            {order.tid}
                          </TableCell>
                        )}
                        {isOrderVisible("organization") && (
                          <TableCell className="py-3 text-xs text-slate-500">{order.organizationName || '-'}</TableCell>
                        )}
                        {isOrderVisible("group") && (
                          <TableCell className="py-3 text-xs text-slate-500">{order.groupName || '-'}</TableCell>
                        )}
                        {isOrderVisible("branch") && (
                          <TableCell className="py-3 text-xs font-medium text-slate-700 dark:text-slate-300">
                            {order.branchName || `ID: ${order.branchId}`}
                          </TableCell>
                        )}
                        {isOrderVisible("status") && (
                          <TableCell className="py-3">
                            <Badge variant="outline" className={cn(
                              "text-[9px] uppercase font-bold tracking-widest border-none px-2 py-0.5",
                              order.status === 'FULFILLED' ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400' :
                                order.status === 'PENDING' ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400' :
                                  order.status === 'REFUNDED' ? 'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-400' :
                                    'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-400'
                            )}>
                              {order.status}
                            </Badge>
                          </TableCell>
                        )}
                        {isOrderVisible("subtotal") && (
                          <TableCell className="py-3 text-right font-mono text-xs text-slate-500">
                            {formatPKR((order.subtotalCents || 0) / 100)}
                          </TableCell>
                        )}
                        {isOrderVisible("tax") && (
                          <TableCell className="py-3 text-right font-mono text-xs text-slate-400">
                            {formatPKR((order.taxCents || 0) / 100)}
                          </TableCell>
                        )}
                        {isOrderVisible("discount") && (
                          <TableCell className="py-3 text-right font-mono text-xs text-rose-500 dark:text-rose-400">
                            -{formatPKR((order.discountCents || 0) / 100)}
                          </TableCell>
                        )}
                        {isOrderVisible("total") && (
                          <TableCell className="py-3 text-right pr-5 font-mono font-bold text-xs text-slate-900 dark:text-white">
                            {formatPKR((order.totalCents || 0) / 100)}
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Footer */}
            <div className="px-5 py-3 bg-slate-50/70 dark:bg-slate-900/40 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
                {filteredOrders.length} order{filteredOrders.length !== 1 ? "s" : ""} shown
              </p>
              <p className="text-[10px] text-slate-300 dark:text-slate-600" suppressHydrationWarning>
                Generated {generatedDate}
              </p>
            </div>
          </Card>
        </div>

        <ExpandableRowDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          title={selectedRow?.tid || "Transaction Details"}
          subtitle={`${selectedRow?.branchName || ""} · ${selectedRow ? new Date(selectedRow.createdAt).toLocaleDateString() : ""}`}
          fields={selectedRow ? getOrderDrawerFields(selectedRow).filter(f => !f.key || isOrderVisible(f.key)) : []}
        />
      </div>
    </div>
  )
}
