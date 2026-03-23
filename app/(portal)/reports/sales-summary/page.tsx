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
  Package, BarChart3, ListOrdered, ArrowUpRight, ArrowDownRight, LayoutDashboard, Database, ChevronDown, CheckSquare
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
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

import { ColumnSelector, useColumnSelector, type ColumnDef } from "@/components/reports/column-selector"
import { ExpandableRowDrawer, type DetailField } from "@/components/reports/expandable-row-drawer"

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
  { key: "refund", label: "Refund", defaultVisible: true },
  { key: "netTotal", label: "Net Total", defaultVisible: true },
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
  const presetFromUrl = (searchParams.get("preset") as FilterPreset) || "all"
  const startFromUrl = searchParams.get("startDate") || ""
  const endFromUrl = searchParams.get("endDate") || ""
  const activePreset = presetFromUrl

  const monthsFromUrl = searchParams.get("months")?.split(',').map(Number) || []
  const yearsFromUrl = searchParams.get("years")?.split(',').map(Number) || []
  const compareMonthsFromUrl = searchParams.get("compareMonths")?.split(',').map(Number) || []
  const compareYearsFromUrl = searchParams.get("compareYears")?.split(',').map(Number) || []

  // Advanced State Arrays
  const [selectedMonths, setSelectedMonths] = useState<number[]>(monthsFromUrl)
  const [selectedYears, setSelectedYears] = useState<number[]>(yearsFromUrl)
  const [compareMonths, setCompareMonths] = useState<number[]>(compareMonthsFromUrl)
  const [compareYears, setCompareYears] = useState<number[]>(compareYearsFromUrl)

  const dateRange = useMemo(() => {
    if (startFromUrl && endFromUrl) {
      return { startDate: new Date(startFromUrl), endDate: new Date(endFromUrl) }
    }
    return null
  }, [startFromUrl, endFromUrl])

  const handleDateChange = useCallback((
      range: { startDate: Date; endDate: Date } | null, 
      preset: FilterPreset, 
      compareMode?: boolean, 
      compRange?: { startDate: Date; endDate: Date } | null,
      newMonths?: number[],
      newYears?: number[],
      newCompMonths?: number[],
      newCompYears?: number[]
  ) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set("preset", preset)
    if (compareMode !== undefined) {
      params.set("compare", String(compareMode))
      setCompare(compareMode)
    }
    if (compRange !== undefined) {
      setCompareRange(compRange)
    }

    // Arrays Support
    if (newMonths !== undefined) { setSelectedMonths(newMonths); if(newMonths.length > 0) params.set("months", newMonths.join(",")); else params.delete("months"); }
    if (newYears !== undefined) { setSelectedYears(newYears); if(newYears.length > 0) params.set("years", newYears.join(",")); else params.delete("years"); }
    if (newCompMonths !== undefined) { setCompareMonths(newCompMonths); if(newCompMonths.length > 0) params.set("compareMonths", newCompMonths.join(",")); else params.delete("compareMonths"); }
    if (newCompYears !== undefined) { setCompareYears(newCompYears); if(newCompYears.length > 0) params.set("compareYears", newCompYears.join(",")); else params.delete("compareYears"); }

    // Calculate range for presets if not provided
    const finalRange = range || (preset !== "custom" && preset !== "all" ? getPresetRange(preset) : null)

    if (finalRange) {
      params.set("startDate", finalRange.startDate.toISOString())
      params.set("endDate", finalRange.endDate.toISOString())
    } else if (preset !== "custom") {
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
  
  // Advanced DB Arrays (Postgres logic in route.ts converts 0-indexed JS month arrays to 1-indexed)
  if (selectedMonths.length > 0) {
    queryParams.set("months", selectedMonths.map(m => m + 1).join(",")) 
  }
  if (selectedYears.length > 0) {
    queryParams.set("years", selectedYears.join(","))
  }
  if (compareMonths.length > 0) {
    queryParams.set("compareMonths", compareMonths.map(m => m + 1).join(","))
  }
  if (compareYears.length > 0) {
    queryParams.set("compareYears", compareYears.join(","))
  }
  
  // Date ranges
  if (startFromUrl && selectedMonths.length === 0 && selectedYears.length === 0) queryParams.set("startDate", startFromUrl)
  if (endFromUrl && selectedMonths.length === 0 && selectedYears.length === 0) queryParams.set("endDate", endFromUrl)
  
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

    // If no explicit preset/dates AND no multi-select arrays, force "All Time" filter
    if (!startFromUrl && !endFromUrl && !searchParams.has("preset") && selectedMonths.length === 0 && selectedYears.length === 0) {
      handleDateChange(null, "all")
    }
  }, [startFromUrl, endFromUrl, searchParams, handleDateChange, selectedMonths.length, selectedYears.length])

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
  const chartData = useMemo(() => {
    if (!filteredOrders.length) return []
    const groups: Record<string, { revenue: number; orders: number }> = {}
    
    // Determine local granularity (match backend logic roughly)
    let localGranularity: "daily" | "monthly" | "yearly" = "daily"
    if (activePreset === "all") {
      localGranularity = "yearly"
    } else if (dateRange) {
      const diffDays = (dateRange.endDate.getTime() - dateRange.startDate.getTime()) / (1000 * 60 * 60 * 24)
      if (diffDays > 400) localGranularity = "yearly"
      else if (diffDays > 32) localGranularity = "monthly"
    }

    const sorted = [...filteredOrders].sort((a: any, b: any) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    )

    sorted.forEach((o: any) => {
      if ((o.status || "").toUpperCase() === "FULFILLED") {
        let label = ""
        const d = new Date(o.createdAt)
        if (localGranularity === "yearly") {
          label = d.getFullYear().toString()
        } else if (localGranularity === "monthly") {
          label = d.toLocaleDateString("en-US", { month: "short", year: "numeric" })
        } else {
          label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
        }
        
        if (!groups[label]) groups[label] = { revenue: 0, orders: 0 }
        groups[label].revenue += (o.totalCents || 0) / 100
        groups[label].orders += 1
      }
    })
    
    // Convert to array and ensure it's still sorted by date (the object keys might not be in order)
    return Object.entries(groups).map(([date, d]) => ({ date, revenue: d.revenue, orders: d.orders }))
  }, [filteredOrders, activePreset, dateRange])

  // Keep old name for JSX compatibility if needed, or update JSX. 
  // Checking JSX below... let's use 'chartData' and update JSX call if it was dailyChartData.
  const dailyChartData = chartData;

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
    const isPartial = (order.refundAmountCents || 0) > 0 && order.status === "FULFILLED"
    const grossRevenue = (order.totalCents || 0) / 100
    const refundedAmount = (order.refundAmountCents || 0) / 100
    const netRevenue = grossRevenue - refundedAmount

    const fields: DetailField[] = [
      { type: "section", label: "Order Overview", value: null },
      { key: "tid", label: "Transaction ID", value: order.tid, type: "mono" },
      { label: "Organization", value: order.organizationName || 'N/A' },
      { label: "Branch", value: order.branchName || `ID: ${order.branchId}` },
      { label: "Created At", value: new Date(order.createdAt).toLocaleString(), type: "date" },
      { key: "status", label: "Status", value: isPartial ? "PARTIAL FULFILLED" : order.status, type: "badge" },
      { label: "Fulfilled At", value: order.fulfilledAt ? new Date(order.fulfilledAt).toLocaleString() : "-", type: "date" },
      { label: "Refunded At", value: order.refundedAt ? new Date(order.refundedAt).toLocaleString() : "-", type: "date" },

      {
        type: "section", label: "Financial Summary", value: (
          <div className="grid grid-cols-1 gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Gross Revenue</p>
                <p className="text-sm font-bold text-slate-900 dark:text-white font-mono">{formatPKR(grossRevenue)}</p>
              </div>
              <div className="p-4 rounded-2xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-100/50 dark:border-rose-900/30">
                <p className="text-[10px] font-bold text-rose-400 uppercase tracking-widest mb-1">Refunded</p>
                <p className="text-sm font-bold text-rose-600 dark:text-rose-400 font-mono">-{formatPKR(refundedAmount)}</p>
              </div>
            </div>
            <div className="p-5 rounded-2xl bg-indigo-600 shadow-xl shadow-indigo-500/20 text-white">
              <p className="text-[10px] font-bold text-indigo-100 uppercase tracking-widest mb-1">Net Revenue (Net Total)</p>
              <div className="flex items-center justify-between">
                <h4 className="text-2xl font-black font-mono leading-none">{formatPKR(netRevenue)}</h4>
                <TrendingUp className="h-5 w-5 text-indigo-200" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter mb-1">Subtotal</p>
                <p className="text-xs font-bold text-slate-700 dark:text-slate-300 font-mono">{formatPKR((order.subtotalCents || 0) / 100)}</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter mb-1">Tax</p>
                <p className="text-xs font-bold text-slate-700 dark:text-slate-300 font-mono">{formatPKR((order.taxCents || 0) / 100)}</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter mb-1">Discount</p>
                <p className="text-xs font-bold text-rose-500 font-mono">-{formatPKR((order.discountCents || 0) / 100)}</p>
              </div>
            </div>
          </div>
        )
      },

      {
        type: "section", label: "Line Items Detail", value: (
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
                    <div key={idx} className="p-4 flex justify-between items-start gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors group/item">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-black text-slate-900 dark:text-white leading-tight truncate text-[12px]">{item.productName}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span className="text-[10px] font-bold font-mono text-indigo-500 uppercase">ID: {item.globalProductId}</span>
                          <span className="text-[10px] font-bold text-slate-400 font-mono">{item.productCode || 'N/A'}</span>
                          <div className="flex items-center gap-2 ml-auto lg:ml-0">
                            <Badge variant="outline" className="text-[8px] h-4 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                              Fulfilled: {item.quantity - (item.quantityRefunded || 0)}
                            </Badge>
                            {(item.quantityRefunded || 0) > 0 && (
                              <Badge variant="outline" className="text-[8px] h-4 border-rose-200 bg-rose-50 text-rose-600">
                                Refunded: {item.quantityRefunded}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[11px] font-black font-mono text-slate-900 dark:text-white">{formatPKR(((item.priceCents * item.quantity) - (item.priceCents * (item.quantityRefunded || 0))) / 100)}</p>
                        <p className="text-[9px] font-bold text-slate-400 mt-1">@ {formatPKR(item.priceCents / 100)} / {item.unit}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="bg-slate-50/50 dark:bg-slate-800/30 p-3 border-t border-slate-100 dark:divide-slate-800">
                  <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-slate-400">
                    <span>Summary</span>
                    <span className="text-slate-900 dark:text-white">{orderDetails.orderItems.length} Products · {orderDetails.orderItems.reduce((acc: number, cur: any) => acc + cur.quantity, 0)} Units</span>
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
    const headers = ["Date", "Transaction ID", "Organization", "Group", "Branch", "Status", "Subtotal (PKR)", "Refund (PKR)", "Net Total (PKR)"]
    const rows = filteredOrders.map((order: any) => [
      new Date(order.createdAt).toLocaleDateString(),
      order.tid,
      order.organizationName || '-',
      order.groupName || '-',
      order.branchName || `ID: ${order.branchId}`,
      order.status?.toUpperCase(),
      ((order.totalCents || 0) / 100).toFixed(2),
      ((order.refundAmountCents || 0) / 100).toFixed(2),
      (((order.totalCents || 0) - (order.refundAmountCents || 0)) / 100).toFixed(2),
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

  const totalRevenueAllBranches = useMemo(() => {
    return topPerformers.reduce((acc: number, p: any) => acc + (p.sales || 0), 0)
  }, [topPerformers])

  const [activeTab, setActiveTab] = useState("analytics")

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
            months={selectedMonths}
            years={selectedYears}
            compareMonths={compareMonths}
            compareYears={compareYears}
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
                    <TrendingUp className="h-6 w-6" />
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-none font-black text-[10px] px-2.5 py-1 tracking-tighter uppercase">Fulfilled</Badge>
                    {revenueTrend && revenueTrend.value !== "0.0" && (
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
                    {orderTrend && orderTrend.value !== "0.0" && (
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

          {/* ── Tabs Navigation ── */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
            <TabsList className="bg-slate-100 dark:bg-slate-800/50 p-1 rounded-2xl border border-slate-200 dark:border-slate-800">
              <TabsTrigger value="analytics" className="rounded-xl px-8 py-2.5 text-xs font-black uppercase tracking-widest data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:shadow-lg data-[state=active]:text-indigo-600 dark:data-[state=active]:text-indigo-400 transition-all duration-300">
                <LayoutDashboard className="h-3.5 w-3.5 mr-2" />
                Sales Analytics
              </TabsTrigger>
              <TabsTrigger value="reports" className="rounded-xl px-8 py-2.5 text-xs font-black uppercase tracking-widest data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:shadow-lg data-[state=active]:text-indigo-600 dark:data-[state=active]:text-indigo-400 transition-all duration-300">
                <Database className="h-3.5 w-3.5 mr-2" />
                Order Reports
              </TabsTrigger>
            </TabsList>

            <TabsContent value="analytics" className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                {/* Enormously Centered Pie Chart */}
                <Card className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 shadow-xl overflow-hidden group">
                  <CardHeader className="px-8 pt-8 pb-4 border-b border-slate-100 dark:border-slate-800/50">
                    <CardTitle className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500">
                        <ShoppingBag className="h-5 w-5" />
                      </div>
                      Order Status Breakdown
                    </CardTitle>
                    <p className="text-xs font-bold text-slate-400 tracking-wide mt-1">Status distribution for the selected period</p>
                  </CardHeader>
                  <CardContent className="p-8">
                    {isLoading ? (
                      <div className="h-[400px] flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-indigo-500/20" /></div>
                    ) : statusChartData.length > 0 ? (
                      <div className="flex flex-col items-center justify-center">
                        <div className="h-[400px] w-full max-w-[500px] relative">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={statusChartData}
                                cx="50%"
                                cy="50%"
                                innerRadius={100}
                                outerRadius={160}
                                paddingAngle={4}
                                dataKey="value"
                                labelLine={false}
                                label={renderDonutLabel}
                              >
                                {statusChartData.map((entry, index) => (
                                  <Cell
                                    key={`cell-${index}`}
                                    fill={STATUS_COLORS[entry.name] || "#94a3b8"}
                                    stroke="none"
                                    className="hover:opacity-80 transition-opacity cursor-pointer delay-75"
                                  />
                                ))}
                              </Pie>
                              <Tooltip
                                content={({ active, payload }: any) => {
                                  if (active && payload && payload.length) {
                                    return (
                                      <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700/50 p-4 rounded-2xl shadow-2xl">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">{payload[0].name}</p>
                                        <p className="text-2xl font-black text-white">{payload[0].value.toLocaleString()} <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">Orders</span></p>
                                        <div className="mt-2 text-[10px] font-bold text-indigo-400">{(payload[0].payload.percent * 100).toFixed(1)}% of total</div>
                                      </div>
                                    );
                                  }
                                  return null;
                                }}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                          {/* Center overlay icon */}
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="flex flex-col items-center gap-1">
                              <ShoppingBag className="h-10 w-10 text-slate-200 dark:text-slate-800" />
                              <span className="text-3xl font-black text-slate-900 dark:text-white leading-none tracking-tighter">{orderCount.toLocaleString()}</span>
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total</span>
                            </div>
                          </div>
                        </div>
                        {/* Legend */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-12 w-full max-w-2xl px-4">
                          {statusChartData.map((entry) => (
                            <div key={entry.name} className="flex flex-col gap-1.5 p-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800/50">
                              <div className="flex items-center gap-2">
                                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: STATUS_COLORS[entry.name] || '#94a3b8' }} />
                                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-black uppercase tracking-tighter">{entry.name}</span>
                              </div>
                              <span className="text-xl font-black text-slate-900 dark:text-white leading-none">{entry.value.toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="h-[400px] flex items-center justify-center text-slate-400 text-sm">No status data recorded</div>
                    )}
                  </CardContent>
                </Card>

                {/* Branch Leaderboard */}
                <Card className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 shadow-xl overflow-hidden">
                  <CardHeader className="px-8 pt-8 pb-4 border-b border-slate-100 dark:border-slate-800/50">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500">
                          <Crown className="h-5 w-5" />
                        </div>
                        Branch Leaderboard
                      </CardTitle>
                      <Badge variant="secondary" className="text-[10px] font-black tracking-[0.1em] bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-none uppercase px-3 py-1">BY REVENUE</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="divide-y divide-slate-100 dark:divide-slate-800/50">
                      {topPerformers.length > 0 ? topPerformers.slice(0, 10).map((p: any, i: number) => {
                        const share = totalRevenueAllBranches > 0 ? (p.sales / totalRevenueAllBranches) * 100 : 0
                        return (
                          <div key={p.branchId} className="flex items-center justify-between px-8 py-4 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-all duration-300">
                            <div className="flex items-center gap-5">
                              <div className={cn(
                                "w-9 h-9 rounded-2xl flex items-center justify-center text-xs font-black text-white shrink-0 shadow-lg transition-transform hover:scale-110",
                                i === 0 ? "bg-amber-500 shadow-amber-500/20" :
                                  i === 1 ? "bg-slate-400 shadow-slate-400/20" :
                                    i === 2 ? "bg-orange-600 shadow-orange-600/20" :
                                      "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 shadow-none border border-slate-200 dark:border-slate-700"
                              )}>
                                {i + 1}
                              </div>
                              <div>
                                <p className="text-sm font-black text-slate-900 dark:text-white">
                                  {p.branchName || `Branch #${p.branchId}`}
                                </p>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{p.orderCount} fulfilled orders</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-black font-mono text-slate-900 dark:text-white">{formatPKR(p.sales / 100)}</p>
                              {/* Revenue share bar */}
                              <div className="flex items-center gap-2.5 mt-2 justify-end">
                                <div className="w-24 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                                  <div
                                    className={cn(
                                      "h-full rounded-full transition-all duration-1000 ease-out",
                                      i === 0 ? "bg-indigo-500" : "bg-slate-300 dark:bg-slate-700"
                                    )}
                                    style={{ width: `${Math.max(2, share)}%` }}
                                  />
                                </div>
                                <span className="text-[10px] text-slate-900 dark:text-slate-300 font-black font-mono min-w-[32px]">
                                  {share.toFixed(0)}%
                                </span>
                              </div>
                            </div>
                          </div>
                        )
                      }) : (
                        <div className="p-12 text-center text-slate-400 italic text-[13px] font-medium">No branch performance data available for this range</div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="reports" className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {(!organizationId && role !== "SUPER_ADMIN") ? (
                <Card className="rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/30 p-20 text-center">
                  <div className="flex flex-col items-center gap-6 max-w-sm mx-auto">
                    <div className="w-20 h-20 rounded-full bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center">
                      <Database className="h-10 w-10 text-indigo-500" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Organization Required</h3>
                      <p className="text-sm font-medium text-slate-500">Please select an organization from the menu above to generate the order reports.</p>
                    </div>
                  </div>
                </Card>
              ) : (
                <Card className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
                  {/* Tab header */}
                  <div className="px-5 pt-4 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
                      <div className="flex items-center gap-2">
                        <ListOrdered className="h-4 w-4 text-indigo-500" />
                        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 uppercase tracking-tight">Order Reports</h3>
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
                          {isOrderVisible("refund") && <TableHead className="text-right h-10 text-[10px] font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap">Refund</TableHead>}
                          {isOrderVisible("netTotal") && <TableHead className="text-right pr-5 h-10 text-[10px] font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap">Net Total</TableHead>}
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
                                    order.status === 'FULFILLED' ? (order.refundAmountCents > 0 ? 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-400' : 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400') :
                                      order.status === 'PENDING' ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400' :
                                        order.status === 'REFUNDED' ? 'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-400' :
                                          'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-400'
                                  )}>
                                    {order.status === "FULFILLED" && order.refundAmountCents > 0 ? "PARTIAL FULFILLED" : order.status}
                                  </Badge>
                                </TableCell>
                              )}
                              {isOrderVisible("subtotal") && (
                                <TableCell className="py-3 text-right font-mono text-xs text-slate-500">
                                  {formatPKR((order.totalCents || 0) / 100)}
                                </TableCell>
                              )}
                              {isOrderVisible("refund") && (
                                <TableCell className="py-3 text-right font-mono text-xs text-rose-500">
                                  -{formatPKR((order.refundAmountCents || 0) / 100)}
                                </TableCell>
                              )}
                              {isOrderVisible("netTotal") && (
                                <TableCell className="py-3 text-right pr-5 font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">
                                  {formatPKR(((order.totalCents || 0) - (order.refundAmountCents || 0)) / 100)}
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
              )}
            </TabsContent>
          </Tabs>
        </div>

        <ExpandableRowDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          title={selectedRow?.tid || "Transaction Details"}
          subtitle={`${selectedRow?.organizationName || "All Organizations"} · ${selectedRow?.branchName || ""} · ${selectedRow ? new Date(selectedRow.createdAt).toLocaleString() : ""}`}
          fields={selectedRow ? getOrderDrawerFields(selectedRow).filter(f => !f.key || isOrderVisible(f.key)) : []}
        />
      </div>
    </div>
  )
}
