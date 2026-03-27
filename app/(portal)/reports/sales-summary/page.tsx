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
  Crown, RefreshCw, Search, FileText, FileSpreadsheet,
  Package, BarChart3, ListOrdered, ArrowUpRight, ArrowDownRight, LayoutDashboard, Database, ChevronDown, CheckSquare,
  LineChart, Layers, Store, Hash, Calendar, Download
} from "lucide-react"
import { KPICard } from "@/components/reports/kpi-card"
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
import { OrganizationFilter } from "@/components/reports/organization-filter"
import { MultiSelectFilter } from "@/components/reports/multi-select-filter"

import {
  ResponsiveContainer,
  ComposedChart,
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

  // Global State (from URL)
  const [selectedMonths, setSelectedMonths] = useState<number[]>(monthsFromUrl)
  const [selectedYears, setSelectedYears] = useState<number[]>(yearsFromUrl)
  const [compareMonths, setCompareMonths] = useState<number[]>(searchParams.get("compareMonths")?.split(',').map(Number) || [])
  const [compareYears, setCompareYears] = useState<number[]>(searchParams.get("compareYears")?.split(',').map(Number) || [])

  // ━━━ LOCAL FILTER STATES ━━━
  // Analytics Filters
  const [chartMonths, setChartMonths] = useState<number[]>(monthsFromUrl.length > 0 ? monthsFromUrl : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
  const [chartYears, setChartYears] = useState<number[]>(yearsFromUrl)
  const [chartOrgIds, setChartOrgIds] = useState<string[]>([])
  const [chartBranchIds, setChartBranchIds] = useState<string[]>([])
  const [chartGroupIds, setChartGroupIds] = useState<string[]>([])

  // Report Filters
  const [reportMonths, setReportMonths] = useState<number[]>(monthsFromUrl.length > 0 ? monthsFromUrl : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
  const [reportYears, setReportYears] = useState<number[]>(yearsFromUrl)
  const [reportOrgIds, setReportOrgIds] = useState<string[]>([])
  const [reportBranchIds, setReportBranchIds] = useState<string[]>([])
  const [reportGroupIds, setReportGroupIds] = useState<string[]>([])
  const [reportSearchTerm, setReportSearchTerm] = useState("")

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

  // ━━━ CHART DATA (Local Filtered) ━━━
  const chartQueryParams = new URLSearchParams()
  if (chartOrgIds.length > 0) chartQueryParams.set("organizationIds", chartOrgIds.join(","))
  else if (organizationId) chartQueryParams.set("organizationId", organizationId.toString())

  if (chartBranchIds.length > 0) chartQueryParams.set("branchIds", chartBranchIds.join(","))
  if (chartGroupIds.length > 0) chartQueryParams.set("groupIds", chartGroupIds.join(","))
  if (chartMonths.length > 0) chartQueryParams.set("months", chartMonths.join(","))
  if (chartYears.length > 0) chartQueryParams.set("years", chartYears.join(","))
  if (compare) chartQueryParams.set("compare", "true")

  const { data: chartData, isLoading: isChartLoading, mutate: mutateChart } = useSWR<any>(`/api/v1/analytics/summary?${chartQueryParams.toString()}`, fetcher)

  // ━━━ REPORT DATA (Local Filtered) ━━━
  const reportQueryParams = new URLSearchParams()
  if (reportOrgIds.length > 0) reportQueryParams.set("organizationIds", reportOrgIds.join(","))
  else if (organizationId) reportQueryParams.set("organizationId", organizationId.toString())

  if (reportBranchIds.length > 0) reportQueryParams.set("branchIds", reportBranchIds.join(","))
  if (reportGroupIds.length > 0) reportQueryParams.set("groupIds", reportGroupIds.join(","))
  if (reportMonths.length > 0) reportQueryParams.set("months", reportMonths.join(","))
  if (reportYears.length > 0) reportQueryParams.set("years", reportYears.join(","))
  if (reportSearchTerm) reportQueryParams.set("searchTerm", reportSearchTerm)
  reportQueryParams.set("limit", "1000")

  const { data: reportData, isLoading: isReportLoading, mutate: mutateReport } = useSWR<any>(`/api/v1/analytics/summary?${reportQueryParams.toString()}`, fetcher)
  
  // ━━━ DATA FOR DYNAMIC FILTERS (All-Time) ━━━
  const allTimeQueryParams = new URLSearchParams()
  if (organizationId) allTimeQueryParams.set("organizationId", organizationId.toString())
  allTimeQueryParams.set("preset", "all")
  const { data: allTimeData } = useSWR<any>(`/api/v1/analytics/summary?${allTimeQueryParams.toString()}`, fetcher)

  // ━━━ GLOBAL DATA (For Header/KPIs) ━━━
  const globalQueryParams = new URLSearchParams()
  if (organizationId) globalQueryParams.set("organizationId", organizationId.toString())
  if (contextBranchIds.length > 0) globalQueryParams.set("branchIds", contextBranchIds.join(","))
  if (selectedMonths.length > 0) globalQueryParams.set("months", selectedMonths.join(","))
  if (selectedYears.length > 0) globalQueryParams.set("years", selectedYears.join(","))
  if (compare) globalQueryParams.set("compare", "true")

  const { data: globalData, isLoading: isGlobalLoading, mutate: mutateGlobal } = useSWR<any>(`/api/v1/analytics/summary?${globalQueryParams.toString()}`, fetcher)

  useEffect(() => {
    setHasMounted(true)
    setGeneratedDate(new Date().toLocaleString())

    // If no explicit preset/dates AND no multi-select arrays, force "All Time" filter
    if (!startFromUrl && !endFromUrl && !searchParams.has("preset") && selectedMonths.length === 0 && selectedYears.length === 0) {
      handleDateChange(null, "all")
    }
  }, [startFromUrl, endFromUrl, searchParams, handleDateChange, selectedMonths.length, selectedYears.length])

  const summary = globalData?.summary || { totalSales: 0, totalTax: 0, totalSubtotal: 0, orderCount: 0, totalItemsSold: 0 }
  const orders = reportData?.orders || []
  const topPerformers = chartData?.topPerformers || []
  const isLoading = isGlobalLoading || isChartLoading || isReportLoading

  const totalRevenue = summary.totalSales || 0
  const orderCount = summary.orderCount || 0
  const totalItemsSold = summary.totalItemsSold || 0
  const avgOrderValue = orderCount > 0 ? (totalRevenue / orderCount) : 0

  // Dynamic Year Ranges for Local Filters
  const allYears = useMemo(() => {
    if (!allTimeData?.orders) return []
    const years = new Set<number>()
    allTimeData.orders.forEach((o: any) => {
        const d = new Date(o.createdAt)
        if (!isNaN(d.getTime())) years.add(d.getFullYear())
    })
    return Array.from(years).sort((a, b) => b - a)
  }, [allTimeData])

  const chartYearsAvailable = allYears
  const reportYearsAvailable = allYears

  // Filtered data
  const filteredOrders = orders.filter((order: any) =>
    order.tid?.toLowerCase().includes(orderSearch.toLowerCase()) ||
    order.status?.toLowerCase().includes(orderSearch.toLowerCase()) ||
    (order.branchName && order.branchName.toLowerCase().includes(orderSearch.toLowerCase()))
  )

  // ━━━ COMPARISON LOGIC (Global) ━━━
  const comparison = globalData?.comparison

  const revenueTrend = useMemo(() => {
    if (!comparison) return null
    const current = globalData?.summary?.totalSales || 0
    const prev = comparison.totalSales || 0
    if (prev === 0) return { value: "0.0", isUp: false, isDown: false }
    const pct = ((current - prev) / prev) * 100
    return { value: Math.abs(pct).toFixed(1), isUp: pct > 0, isDown: pct < 0 }
  }, [globalData, comparison])

  const orderTrend = useMemo(() => {
    if (!comparison) return null
    const current = globalData?.summary?.orderCount || 0
    const prev = comparison.orderCount || 0
    if (prev === 0) return { value: "0.0", isUp: false, isDown: false }
    const pct = ((current - prev) / prev) * 100
    return { value: Math.abs(pct).toFixed(1), isUp: pct > 0, isDown: pct < 0 }
  }, [globalData, comparison])

  // ━━━ ANALYTICS DATA PROCESSING (Local) ━━━
  // ━━━ CHART TREND DATA: Normalized X-Axis ━━━
  const normalizedTrend = useMemo(() => {
    const orders = chartData?.orders || []
    const currentYear = new Date().getFullYear()

    // Case A: Multiple years -> Show Years on X-Axis
    if (chartYears.length > 1) {
      return chartYears.sort((a,b) => a-b).map(year => {
        const yearOrders = orders.filter((o: any) => new Date(o.createdAt).getFullYear() === year)
        const compOrders = chartData?.comparisonOrders?.filter((o: any) => new Date(o.createdAt).getFullYear() === year) || []
        
        return {
          period: String(year),
          revenue: yearOrders.filter((o: any) => ['FULFILLED', 'APPROVED'].includes(o.status?.toUpperCase())).reduce((sum: number, o: any) => sum + (o.totalCents - (o.refundAmountCents || 0)) / 100, 0),
          orders: yearOrders.filter((o: any) => ['FULFILLED', 'APPROVED'].includes(o.status?.toUpperCase())).length,
          compareRevenue: compOrders.filter((o: any) => ['FULFILLED', 'APPROVED'].includes(o.status?.toUpperCase())).reduce((sum: number, o: any) => sum + (o.totalCents - (o.refundAmountCents || 0)) / 100, 0)
        }
      })
    }

    // Case B: Single year -> Show Months on X-Axis
    const activeYear = chartYears.length === 1 ? chartYears[0] : currentYear
    const monthsToShow = chartMonths.length > 0 && chartMonths.length < 12 
        ? [...chartMonths].sort((a,b) => a-b) 
        : [1,2,3,4,5,6,7,8,9,10,11,12]

    return monthsToShow.map(m => {
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
      const monthData = orders.filter((o: any) => {
          const d = new Date(o.createdAt)
          return d.getFullYear() === activeYear && (d.getMonth() + 1) === m
      })
      const compData = chartData?.comparisonOrders?.filter((o: any) => {
          const d = new Date(o.createdAt)
          return d.getFullYear() === activeYear && (d.getMonth() + 1) === m
      }) || []

      return {
        period: monthNames[m-1],
        revenue: monthData.filter((o: any) => ['FULFILLED', 'APPROVED'].includes(o.status?.toUpperCase())).reduce((sum: number, o: any) => sum + (o.totalCents - (o.refundAmountCents || 0)) / 100, 0),
        orders: monthData.filter((o: any) => ['FULFILLED', 'APPROVED'].includes(o.status?.toUpperCase())).length,
        compareRevenue: compData.filter((o: any) => ['FULFILLED', 'APPROVED'].includes(o.status?.toUpperCase())).reduce((sum: number, o: any) => sum + (o.totalCents - (o.refundAmountCents || 0)) / 100, 0)
      }
    })
  }, [chartData, chartMonths, chartYears])

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

// ━━━ PREMIUM SUB-COMPONENTS ━━━

function MonthFilter({ selected, onChange }: any) {
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
    const items = months.map((m, i) => ({ id: i + 1, label: m }))
    return (
        <MultiSelectFilter
            title="Months"
            items={items}
            selectedIds={selected}
      onChange={(ids: any[]) => onChange(ids.sort((a, b) => a - b))}
            icon={<Calendar className="h-3.5 w-3.5 text-indigo-500" />}
            placeholder="Months"
            showSearch={false}
        />
    )
}

function YearFilter({ selected, onChange, availableYears }: any) {
    const items = availableYears.map((y: number) => ({ id: y, label: String(y) }))
    return (
        <MultiSelectFilter
            title="Years"
            items={items}
            selectedIds={selected}
      onChange={(ids: any[]) => onChange(ids.sort((a, b) => b - a))}
            icon={<Layers className="h-3.5 w-3.5 text-blue-500" />}
            placeholder="Years"
            showSearch={false}
        />
    )
}

function BarTooltip({ active, payload }: any) {
    if (active && payload && payload.length) {
        return ( active && payload && payload.length) && (
            <div className="bg-slate-900/95 backdrop-blur-3xl border border-slate-800 p-5 rounded-2xl shadow-2xl ring-1 ring-white/10 animate-in zoom-in-95 duration-200">
                <div className="space-y-3">
                    <div className="flex items-center gap-3 border-b border-slate-800 pb-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]" />
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{payload[0].payload.period}</p>
                    </div>
                    <div className="space-y-2">
                        <div className="flex items-center justify-between gap-8">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Revenue</span>
                            <span className="text-sm font-black text-white font-mono">{formatPKR(payload[0].value)}</span>
                        </div>
                        {payload[1] && (
                            <div className="flex items-center justify-between gap-8 bg-slate-800/30 p-2 rounded-lg">
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Prior Period</span>
                                <span className="text-sm font-black text-slate-400 font-mono">{formatPKR(payload[1].value)}</span>
                            </div>
                        )}
                    </div>
                </div>
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

      {/* ━━━ GLOBAL CONTEXT FILTERS ━━━ */}
      <div className="sticky top-0 z-50 w-full backdrop-blur-xl bg-white/80 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800 shadow-sm transition-all duration-300">
        <div className="max-w-[1600px] mx-auto px-6 py-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex-1" />
          <div className="hidden lg:flex items-center gap-2 p-1.5 bg-slate-100 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-inner">
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
          </div>

          <div className="flex items-center gap-2 h-6 pl-3">
            {(role === "SUPER_ADMIN" || role === "HEAD_OFFICE") && (
              <>
                <div className="h-6 w-[1px] bg-slate-200 dark:bg-slate-800 mr-2" />
                <GroupFilter selectedIds={groupId ? [groupId] : []} onChange={(ids) => setGroupId(ids[0] || "")} organizationId={organizationId || undefined} />
                <BranchFilter selectedIds={contextBranchIds} onChange={handleBranchChange} organizationId={organizationId || undefined} />
              </>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-6 pt-6 space-y-6">
        <Tabs value={activeTab} onValueChange={(val) => {
            setActiveTab(val as any)
            const params = new URLSearchParams(searchParams.toString())
            params.set("tab", val)
            router.replace(`${pathname}?${params.toString()}`, { scroll: false })
        }} className="space-y-6">
          
          {/* ━━━ LUXURY INTELLIGENCE HEADER ━━━ */}
          <div className="relative overflow-hidden bg-slate-900 border-b border-slate-800 shadow-2xl rounded-[2.5rem]">
              <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 bg-indigo-600/20 blur-[120px] rounded-full animate-pulse" />
              <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-72 h-72 bg-blue-600/10 blur-[100px] rounded-full" />
              
              <div className="px-8 py-10 relative">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 max-w-7xl mx-auto">
                      <div className="space-y-3">
                          <div className="flex items-center gap-3">
                              <div className="p-2.5 rounded-2xl bg-indigo-600/20 text-indigo-400 ring-1 ring-indigo-500/30 shadow-lg shadow-indigo-500/10">
                                  <TrendingUp className="h-5 w-5" />
                              </div>
                              <Badge variant="outline" className="bg-indigo-500/10 text-indigo-400 border-indigo-500/20 text-[10px] font-black uppercase tracking-widest px-3 py-1 animate-in slide-in-from-left-4 duration-700">
                                  Centralized Reporting
                              </Badge>
                          </div>
                          <h1 className="text-4xl font-black text-white tracking-tight sm:text-5xl border-none">
                              Sales <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-blue-400 to-emerald-400">Intelligence</span>
                          </h1>
                          <p className="text-slate-400 font-medium text-sm flex items-center gap-2 max-w-md">
                              <Calculator className="h-4 w-4 opacity-50" />
                              Consolidated financial oversight across all branches and groups.
                          </p>
                      </div>

                      <div className="flex flex-col items-end gap-6">
                          <TabsList className="bg-slate-800/50 p-1.5 rounded-2xl border border-slate-700/50 backdrop-blur-md">
                              <TabsTrigger value="analytics" className="rounded-xl px-8 py-3 text-[11px] font-black uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:text-indigo-600 transition-all duration-300 gap-2">
                                  <LayoutDashboard className="h-3.5 w-3.5" /> Analytics
                              </TabsTrigger>
                              <TabsTrigger value="reports" className="rounded-xl px-8 py-3 text-[11px] font-black uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:text-indigo-600 transition-all duration-300 gap-2">
                                  <Database className="h-3.5 w-3.5" /> Reports
                              </TabsTrigger>
                          </TabsList>
                          
                          <div className="flex items-center gap-3">
                              <Button 
                                  variant="outline" 
                                  onClick={() => { mutateGlobal(); mutateChart(); mutateReport(); }}
                                  className="h-11 bg-slate-800/50 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white rounded-xl px-5 gap-2 transition-all duration-300 group"
                              >
                                  <RefreshCw className={cn("h-4 w-4 transition-transform duration-500 group-hover:rotate-180", (isGlobalLoading || isChartLoading || isReportLoading) && "animate-spin")} />
                                  Synchronize
                              </Button>
                              <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                      <Button className="h-11 bg-indigo-600 hover:bg-indigo-500 text-white border-none rounded-xl px-6 gap-2 shadow-lg shadow-indigo-600/20 transition-all duration-300 font-bold uppercase tracking-widest text-[11px]">
                                          <Download className="h-4 w-4" /> Export
                                      </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-52 bg-slate-900 border-slate-800 text-slate-300 rounded-2xl p-2 shadow-2xl">
                                      <DropdownMenuItem onClick={() => handleExport('csv')} className="gap-3 py-3 rounded-xl hover:bg-slate-800 focus:bg-slate-800 cursor-pointer text-xs font-bold uppercase tracking-wider">
                                          <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500"><FileSpreadsheet className="h-4 w-4" /></div> CSV Spreadsheet
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => handleExport('excel')} className="gap-3 py-3 rounded-xl hover:bg-slate-800 focus:bg-slate-800 cursor-pointer text-xs font-bold uppercase tracking-wider">
                                          <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-500"><FileText className="h-4 w-4" /></div> Excel Workbook
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => handleExport('pdf')} className="gap-3 py-3 rounded-xl hover:bg-slate-800 focus:bg-slate-800 cursor-pointer text-xs font-bold uppercase tracking-wider">
                                          <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-500"><FileText className="h-4 w-4" /></div> PDF Document
                                      </DropdownMenuItem>
                                  </DropdownMenuContent>
                              </DropdownMenu>
                          </div>
                      </div>
                  </div>
              </div>
          </div>

          <TabsContent value="analytics" className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                    {/* ━━━ KPI BENTO GRID ━━━ */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        <KPICard
                            title="Total Revenue"
                            value={formatPKR(totalRevenue / 100)}
                            icon={TrendingUp}
                            colorScheme="emerald"
                            trend={revenueTrend?.value ? Number(revenueTrend.value) * (revenueTrend.isUp ? 1 : -1) : undefined}
                            subtitle="From fulfilled orders"
                            comparisonLabel="Prior Period"
                            comparisonValue={compare && comparison ? formatPKR(comparison.totalSales / 100) : undefined}
                        />
                        <KPICard
                            title="Order Volume"
                            value={orderCount.toLocaleString()}
                            icon={ShoppingBag}
                            colorScheme="blue"
                            trend={orderTrend?.value ? Number(orderTrend.value) * (orderTrend.isUp ? 1 : -1) : undefined}
                            subtitle="Fulfilled + Approved + Partial Orders"
                            comparisonLabel="Prior Period"
                            comparisonValue={compare && comparison ? comparison.orderCount.toLocaleString() : undefined}
                        />
                        <KPICard
                            title="Items Fulfilled"
                            value={totalItemsSold.toLocaleString()}
                            icon={Package}
                            colorScheme="violet"
                            subtitle="Net product units sold"
                        />
                    </div>
                    {/* ━━━ REVENUE TREND CHART WITH FILTERS ━━━ */}
                    <Card className="overflow-hidden border border-slate-200/80 dark:border-slate-800 shadow-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-3xl rounded-[2rem] relative group transition-all duration-700 hover:shadow-indigo-500/10 hover:border-indigo-400/40">
                        <div className="px-8 py-7 border-b border-slate-100 dark:border-slate-800 space-y-5">
                            <div className="flex items-center justify-between">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2.5">
                                        <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-500">
                                            <LineChart className="h-4 w-4" />
                                        </div>
                                        <h3 className="font-black text-sm uppercase tracking-tight text-slate-800 dark:text-slate-200">
                                            Revenue Analytics
                                        </h3>
                                    </div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-11">Comparison vs Prior Period</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button variant="outline" size="sm" onClick={() => mutateChart()} className="h-8 w-8 p-0 rounded-lg border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all duration-300">
                                        <RefreshCw className={cn("h-3.5 w-3.5 text-slate-400", isChartLoading && "animate-spin")} />
                                    </Button>
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2.5 pt-1">
                                <MonthFilter selected={chartMonths} onChange={setChartMonths} />
                                <YearFilter selected={chartYears} onChange={setChartYears} availableYears={chartYearsAvailable} />
                                {(role === "SUPER_ADMIN" || role === "HEAD_OFFICE") && (
                                    <>
                                        <OrganizationFilter selectedIds={chartOrgIds} onChange={setChartOrgIds} />
                                        {(chartOrgIds.length > 0 || (role !== "SUPER_ADMIN" && organizationId)) && (
                                            <>
                                                <GroupFilter 
                                                    selectedIds={chartGroupIds} 
                                                    onChange={setChartGroupIds} 
                                                    organizationIds={chartOrgIds.length > 0 ? chartOrgIds : (organizationId ? [String(organizationId)] : [])}
                                                    disabled={chartBranchIds.length > 0}
                                                />
                                                <BranchFilter 
                                                    selectedIds={chartBranchIds} 
                                                    onChange={setChartBranchIds} 
                                                    organizationIds={chartOrgIds.length > 0 ? chartOrgIds : (organizationId ? [organizationId] : [])} 
                                                    groupIds={chartGroupIds}
                                                />
                                            </>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>

                        <div className="p-8">
                            {isChartLoading ? (
                                <div className="h-[420px] flex flex-col items-center justify-center gap-4">
                                    <div className="relative">
                                        <div className="h-12 w-12 rounded-full border-4 border-indigo-500/20 border-t-indigo-500 animate-spin" />
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <div className="h-4 w-4 bg-indigo-500 rounded-full animate-pulse" />
                                        </div>
                                    </div>
                                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 animate-pulse">Refining Data Stream...</p>
                                </div>
                            ) : chartData?.orders && chartData.orders.length > 0 ? (
                                <div className="h-[420px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <ComposedChart data={normalizedTrend} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                                            <defs>
                                                <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="0%" stopColor="#6366f1" stopOpacity={1} />
                                                    <stop offset="100%" stopColor="#4338ca" stopOpacity={1} />
                                                </linearGradient>
                                                <linearGradient id="compareGradient" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="0%" stopColor="#94a3b8" stopOpacity={0.4} />
                                                    <stop offset="100%" stopColor="#64748b" stopOpacity={0.1} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.4} />
                                            <XAxis 
                                                dataKey="period" 
                                                axisLine={false} 
                                                tickLine={false} 
                                                tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }}
                                                dy={10}
                                            />
                                            <YAxis 
                                                axisLine={false} 
                                                tickLine={false} 
                                                tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }}
                                                tickFormatter={(value) => `₨${value >= 1000 ? (value/1000).toFixed(1)+'k' : value}`}
                                            />
                                            <Tooltip content={<BarTooltip />} cursor={{ fill: '#f1f5f9', opacity: 0.5 }} />
                                            <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ paddingBottom: '30px', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }} />
                                            
                                            <Bar 
                                                name="Revenue (PKR)" 
                                                dataKey="revenue" 
                                                fill="url(#revenueGradient)" 
                                                radius={[6, 6, 0, 0]} 
                                                barSize={compare ? 25 : 40}
                                            />
                                            {compare && (
                                                <Bar 
                                                    name="Prior Period" 
                                                    dataKey="compareRevenue" 
                                                    fill="url(#compareGradient)" 
                                                    radius={[6, 6, 0, 0]} 
                                                    barSize={25}
                                                />
                                            )}
                                        </ComposedChart>
                                    </ResponsiveContainer>
                                </div>
                            ) : (
                                <div className="h-[420px] flex flex-col items-center justify-center text-slate-400 bg-slate-50/50 dark:bg-slate-900/50 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800">
                                    <BarChart3 className="h-12 w-12 opacity-10 mb-4" />
                                    <p className="text-xs font-bold uppercase tracking-widest italic opacity-40">No analytical data available</p>
                                </div>
                            )}
                        </div>
                    </Card>
                </TabsContent>

                <TabsContent value="reports" className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                    {/* ━━━ LOCAL REPORT FILTERS ━━━ */}
                    <div className="flex flex-wrap items-center gap-2.5 p-4 bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl">
                        <MonthFilter selected={reportMonths} onChange={setReportMonths} />
                        <YearFilter selected={reportYears} onChange={setReportYears} availableYears={reportYearsAvailable} />
                        {(role === "SUPER_ADMIN" || role === "HEAD_OFFICE") && (
                            <>
                                <OrganizationFilter selectedIds={reportOrgIds} onChange={setReportOrgIds} />
                                {(reportOrgIds.length > 0 || (role !== "SUPER_ADMIN" && organizationId)) && (
                                    <>
                                        <GroupFilter 
                                            selectedIds={reportGroupIds} 
                                            onChange={setReportGroupIds} 
                                            organizationIds={reportOrgIds.length > 0 ? reportOrgIds : (organizationId ? [String(organizationId)] : [])}
                                            disabled={reportBranchIds.length > 0}
                                        />
                                        <BranchFilter 
                                            selectedIds={reportBranchIds} 
                                            onChange={setReportBranchIds} 
                                            organizationIds={reportOrgIds.length > 0 ? reportOrgIds : (organizationId ? [organizationId] : [])} 
                                            groupIds={reportGroupIds}
                                        />
                                    </>
                                )}
                            </>
                        )}
                        <div className="flex-1" />
                        <Button variant="outline" size="sm" onClick={() => mutateReport()} className="h-9 w-9 p-0 rounded-xl border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all duration-300">
                            <RefreshCw className={cn("h-3.5 w-3.5 text-slate-400", isReportLoading && "animate-spin")} />
                        </Button>
                    </div>

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
                        <Card className="rounded-[2rem] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-2xl overflow-hidden min-h-[600px] flex flex-col">
                            {/* Tab header */}
                            <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-800">
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
                              <FileText className="mr-2 h-3.5 w-3.5 text-rose-500" /> PDF
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
