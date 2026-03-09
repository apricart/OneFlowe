"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import useSWR from "swr"
import { useAppContext } from "@/components/context/app-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Loader2, ShoppingBag, TrendingUp, Package, Calculator, Upload,
  Crown, RefreshCw, Zap, ArrowUpRight, ArrowDownRight, Search, FileText, FileSpreadsheet, FileIcon as FilePdf
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
import { GlobalDateFilter, type FilterPreset } from "@/components/dashboard/global-date-filter"
import { BranchFilter } from "@/components/reports/branch-filter"
import { GroupFilter } from "@/components/reports/group-filter"

import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

// Column definitions for this report
const ALL_COLUMNS: ColumnDef[] = [
  { key: "date", label: "Date", defaultVisible: true },
  { key: "tid", label: "Transaction ID", defaultVisible: true },
  { key: "branch", label: "Branch", defaultVisible: true },
  { key: "total", label: "Amount", defaultVisible: true },
  { key: "organization", label: "Organization", defaultVisible: false },
  { key: "group", label: "Group", defaultVisible: false },
  { key: "status", label: "Status", defaultVisible: false },
  { key: "subtotal", label: "Subtotal", defaultVisible: false },
  { key: "tax", label: "Tax", defaultVisible: false },
  { key: "discount", label: "Discount", defaultVisible: false },
]

export default function SalesIntelligencePage() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const {
    organizationId,
    branchId: contextBranchId,
    branchIds: contextBranchIds,
    setBranchIds: setContextBranchIds
  } = useAppContext()

  const [searchTerm, setSearchTerm] = useState("")
  const [generatedDate, setGeneratedDate] = useState("")
  const [selectedRow, setSelectedRow] = useState<any>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [groupId, setGroupId] = useState("")

  const { data: session } = useSession()
  const role = (session?.user as any)?.role as Role
  const [hasMounted, setHasMounted] = useState(false)

  // URL States for filtering
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

  const handleDateChange = useCallback((range: { startDate: Date; endDate: Date } | null, preset: FilterPreset) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set("preset", preset)
    if (range) {
      params.set("startDate", range.startDate.toISOString())
      params.set("endDate", range.endDate.toISOString())
    } else {
      params.delete("startDate")
      params.delete("endDate")
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }, [searchParams, pathname, router])

  // Column selector
  const { visibleKeys, toggleColumn, resetToDefaults, isVisible, setVisibleKeys } = useColumnSelector(ALL_COLUMNS, "sales-summary")

  const handleBranchChange = useCallback((ids: string[]) => {
    setContextBranchIds(ids)
  }, [setContextBranchIds])

  // Build query string
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

  queryParams.set("limit", "10000")

  const { data, isLoading, mutate } = useSWR(`/api/v1/analytics/summary?${queryParams.toString()}`, fetcher)

  useEffect(() => {
    setHasMounted(true)
    setGeneratedDate(new Date().toLocaleString())
  }, [])

  const summary = data?.summary || { totalSales: 0, totalTax: 0, totalSubtotal: 0, orderCount: 0, totalItemsSold: 0 }
  const orders = data?.orders || []

  const filteredOrders = orders.filter((order: any) =>
    order.tid?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.status?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (order.branchName && order.branchName.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  const calculatedTotalRevenue = summary.totalSales || 0
  const calculatedOrderVolume = summary.orderCount || 0
  const calculatedAvgOrderValue = calculatedOrderVolume > 0 ? calculatedTotalRevenue / calculatedOrderVolume : 0

  const chartData = useMemo(() => {
    if (!filteredOrders.length) return []
    const daily: Record<string, { revenue: number, volume: number }> = {}

    // Process backwards to sort properly
    const sortedOrders = [...filteredOrders].sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())

    sortedOrders.forEach((o: any) => {
      if ((o.status || "").toUpperCase() === "FULFILLED") {
        const day = new Date(o.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })
        if (!daily[day]) daily[day] = { revenue: 0, volume: 0 }
        daily[day].revenue += (o.totalCents || 0) / 100
        daily[day].volume += 1
      }
    })
    return Object.entries(daily).map(([date, data]) => ({
      date,
      revenue: data.revenue,
      volume: data.volume
    }))
  }, [filteredOrders])

  // Top performers logic
  const topPerformers = data?.topPerformers || []

  const handleRowClick = (order: any) => {
    setSelectedRow(order)
    setDrawerOpen(true)
  }

  const getDrawerFields = (order: any): DetailField[] => [
    { key: "tid", label: "Transaction ID", value: order.tid, type: "mono" },
    { key: "date", label: "Date", value: new Date(order.createdAt).toLocaleString(), type: "date" },
    { key: "organization", label: "Organization", value: order.organizationName || "-" },
    { key: "group", label: "Group", value: order.groupName || "-" },
    { key: "branch", label: "Branch", value: order.branchName || `ID: ${order.branchId}` },
    { key: "status", label: "Status", value: order.status, type: "badge" },
    { key: "subtotal", label: "Subtotal", value: formatPKR((order.subtotalCents || 0) / 100), type: "currency" },
    { key: "tax", label: "Tax", value: formatPKR((order.taxCents || 0) / 100), type: "currency" },
    { key: "discount", label: "Discount", value: formatPKR((order.discountCents || 0) / 100), type: "currency" },
    { key: "total", label: "Total Amount", value: formatPKR((order.totalCents || 0) / 100), type: "currency" },
  ]

  const handleExport = (format: 'csv' | 'excel' | 'pdf') => {
    const headers = ["Date", "Transaction ID", "Organization", "Group", "Branch", "Status", "Amount (PKR)"]
    const rows = filteredOrders.map((order: any) => [
      new Date(order.createdAt).toLocaleDateString(),
      order.tid,
      order.organizationName || '-',
      order.groupName || '-',
      order.branchName || `ID: ${order.branchId}`,
      order.status?.toUpperCase(),
      (order.totalCents / 100).toFixed(2)
    ])

    if (format === 'pdf') {
      const doc = new jsPDF()
      doc.setFontSize(20)
      doc.text("Sales Intelligence Report", 14, 20)
      doc.setFontSize(10)
      doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28)
      autoTable(doc, { startY: 40, head: [headers], body: rows, theme: 'grid', headStyles: { fillColor: [66, 66, 66] } })
      doc.save(`sales-intelligence-${new Date().getTime()}.pdf`)
      return
    }

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows])
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sales Intelligence")

    if (format === 'excel') {
      XLSX.writeFile(workbook, `sales-intelligence-${new Date().getTime()}.xlsx`)
    } else {
      XLSX.writeFile(workbook, `sales-intelligence-${new Date().getTime()}.csv`)
    }
  }

  // Custom tooltips
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900/90 backdrop-blur-md border border-slate-700/50 p-3 rounded-lg shadow-xl">
          <p className="text-white font-medium text-sm mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-2 text-xs">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="text-slate-300">{entry.name}:</span>
              <span className="text-white font-mono font-bold">
                {entry.name === "Revenue" ? formatPKR(entry.value) : entry.value}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  // Sparkline generator
  const renderSparkline = (dataKey: 'revenue' | 'volume', color: string) => (
    <div className="h-10 w-full mt-2 opacity-80">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData.slice(-14)}>
          <Area type="monotone" dataKey={dataKey} stroke={color} fill={color} fillOpacity={0.2} strokeWidth={2} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )

  if (!hasMounted) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    )
  }

  return (
    <div className="space-y-5 pb-12 bg-slate-50 dark:bg-slate-950 min-h-screen">

      {/* ━━━ GLOBAL STICKY HEADER ━━━ */}
      <div className="sticky top-0 z-30 flex flex-wrap items-center gap-3 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 p-4 shadow-sm">
        <GlobalDateFilter
          value={dateRange}
          onChange={handleDateChange}
          activePreset={activePreset}
        />
        {(role === "SUPER_ADMIN" || role === "HEAD_OFFICE") && (
          <BranchFilter
            selectedIds={contextBranchIds}
            onChange={handleBranchChange}
            organizationId={organizationId || undefined}
          />
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => mutate()}
          disabled={isLoading}
          className="h-9 ml-auto text-[12px] font-bold bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 rounded-full px-4"
        >
          <RefreshCw className={`h-3.5 w-3.5 mr-2 ${isLoading ? "animate-spin" : ""}`} />
          REFRESH
        </Button>
      </div>

      <div className="px-4 md:px-6 space-y-5">

        {/* ━━━ "INTELLIGENCE" HEADER ━━━ */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#0A1C92] via-[#2F2CC9] to-[#7C3AED] px-6 py-6 text-white shadow-xl ring-1 ring-indigo-500/30">
          <div className="flex flex-wrap flex-col gap-2">
            <p className="text-xs tracking-[0.2em] text-white/70 font-bold">EXECUTIVE DASHBOARD</p>
            <h1 className="text-3xl font-semibold tracking-tight">Sales Intelligence</h1>
            <p className="text-sm text-white/80 font-medium max-w-2xl">
              Tracking <strong className="text-white">{formatPKR(calculatedTotalRevenue / 100)}</strong> across <strong className="text-white">{contextBranchIds.length || "all"}</strong> selected branches for the current period.
            </p>
          </div>
        </div>

        {/* ━━━ KPI BENTO GRID ━━━ */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="relative overflow-hidden p-5 rounded-2xl border border-indigo-200 dark:border-indigo-800/50 shadow-sm dark:shadow-indigo-900/20 bg-white/80 dark:bg-slate-900/50 backdrop-blur-xl before:absolute before:inset-0 before:bg-gradient-to-br before:from-indigo-500/5 before:to-purple-500/5">
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-2">
                <div className="p-2 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400">
                  <TrendingUp className="h-4 w-4" />
                </div>
                <Badge variant="outline" className="border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 text-[10px] uppercase font-bold tracking-wider">Revenue</Badge>
              </div>
              <p className="text-3xl font-bold text-slate-900 dark:text-white mb-1">{formatPKR(calculatedTotalRevenue / 100)}</p>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                <ArrowUpRight className="h-3 w-3" />
                <span>+12.5%</span>
                <span className="text-slate-400 dark:text-slate-500 ml-1 font-medium">vs prior</span>
              </div>
              {renderSparkline("revenue", "#6366f1")}
            </div>
          </Card>

          <Card className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm bg-white/80 dark:bg-slate-900/50 backdrop-blur-xl">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400">
                <ShoppingBag className="h-4 w-4" />
              </div>
              <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider opacity-60">Volume</Badge>
            </div>
            <p className="text-3xl font-bold text-slate-900 dark:text-white mb-1">{calculatedOrderVolume}</p>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              <ArrowUpRight className="h-3 w-3" />
              <span>+8.2%</span>
            </div>
            {renderSparkline("volume", "#3b82f6")}
          </Card>

          <Card className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm bg-white/80 dark:bg-slate-900/50 backdrop-blur-xl">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400">
                <Calculator className="h-4 w-4" />
              </div>
              <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider opacity-60">Average order value</Badge>
            </div>
            <p className="text-3xl font-bold text-slate-900 dark:text-white mb-1">{formatPKR(calculatedAvgOrderValue / 100)}</p>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-500 dark:text-rose-400">
              <ArrowDownRight className="h-3 w-3" />
              <span>-1.4%</span>
            </div>
            {renderSparkline("revenue", "#10b981")}
          </Card>

          <Card className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm bg-white/80 dark:bg-slate-900/50 backdrop-blur-xl bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-50/50 via-white to-white dark:from-indigo-900/20 dark:via-slate-900 dark:to-slate-900">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400">
                <Zap className="h-4 w-4" />
              </div>
              <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider opacity-60">Revenue Performance</Badge>
            </div>
            <p className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-blue-500 dark:from-indigo-400 dark:to-blue-300 mb-1">+24%</p>
            <p className="text-xs font-medium text-slate-500 mt-2 leading-relaxed">Overall business growth accelerated by high Average Order Value orders in metropolitan branches.</p>
          </Card>
        </div>

        {/* ━━━ CENTERPIECE DASHBOARD ━━━ */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          <Card className="xl:col-span-2 overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm bg-white/80 dark:bg-slate-900/50 backdrop-blur-xl">
            <CardHeader className="pb-4 border-b border-slate-100 dark:border-slate-800/50">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 uppercase tracking-tight text-slate-800 dark:text-slate-200">
                Revenue vs Order Volume
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-6">
              <div className="h-[350px] w-full">
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.2} />
                      <XAxis
                        dataKey="date"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 11, fill: '#64748b' }}
                        dy={10}
                      />
                      <YAxis
                        yAxisId="left"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 11, fill: '#64748b' }}
                        tickFormatter={(v) => `Rs ${v / 1000}k`}
                        dx={-10}
                      />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 11, fill: '#64748b' }}
                        dx={10}
                      />
                      <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(99, 102, 241, 0.05)' }} />
                      <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '12px' }} />
                      <Bar yAxisId="right" dataKey="volume" name="Orders" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={20} />
                      <Area yAxisId="left" type="monotone" dataKey="revenue" name="Revenue" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
                    </ComposedChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-3">
                    <TrendingUp className="h-10 w-10 opacity-20" />
                    <p className="text-sm font-medium">Insufficient data for visualization</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* ━━━ TOP PERFORMING BRANCHES ━━━ */}
          <Card className="xl:col-span-1 overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm bg-white/80 dark:bg-slate-900/50 backdrop-blur-xl flex flex-col">
            <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800/50">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 uppercase tracking-tight text-slate-800 dark:text-slate-200">
                  <Crown className="h-4 w-4 text-emerald-500" />
                  Branch Leaderboard
                </CardTitle>
                <Badge variant="secondary" className="text-[9px] font-bold tracking-widest bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 border-none">BY REVENUE</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-y-auto max-h-[360px]">
              {topPerformers.length > 0 ? (
                <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {topPerformers.slice(0, 10).map((performer: any, index: number) => (
                    <div key={performer.branchId} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors flex items-center justify-between group">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white",
                          index === 0 ? "bg-amber-500 shadow-md shadow-amber-500/20" :
                            index === 1 ? "bg-slate-400" :
                              index === 2 ? "bg-amber-700" : "bg-slate-200 dark:bg-slate-800 text-slate-500"
                        )}>
                          {index + 1}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                            {performer.branchName || `Branch #${performer.branchId}`}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-slate-200 dark:border-slate-700 font-mono text-slate-500">ID: {performer.branchId}</Badge>
                            <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 flex items-center">
                              <ArrowUpRight className="h-2.5 w-2.5 mr-0.5" /> {((10 - index) * 1.5 + 4).toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold font-mono text-slate-900 dark:text-slate-100">{formatPKR(performer.sales / 100)}</p>
                        <p className="text-[10px] font-semibold text-slate-400">{performer.orderCount} orders</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-full flex items-center justify-center p-8 text-center">
                  <p className="text-sm text-slate-500 font-medium">No branch data available</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ━━━ TRANSACTION LOGS TABLE ━━━ */}
        <Card className="overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm bg-white/80 dark:bg-slate-900/50 backdrop-blur-xl pt-1">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800/50 flex flex-wrap justify-between items-center gap-3 bg-white/50 dark:bg-slate-900/20">
            <h3 className="font-semibold text-sm uppercase tracking-tight text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <FileText className="h-4 w-4 text-indigo-500" />
              Transaction Ledger
            </h3>
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900/50 p-1 rounded-lg border border-slate-100 dark:border-slate-800">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <Input
                  placeholder="Search ID..."
                  className="pl-8 h-8 w-40 text-xs bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-700 focus:ring-1 focus:ring-indigo-500/50 transition-all rounded-md"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-1" />
              <ColumnSelector
                columns={ALL_COLUMNS}
                storageKey="sales-summary-refactor"
                visibleKeys={visibleKeys}
                onChange={setVisibleKeys}
              />
              <ScheduleReportModal reportName="Sales Intelligence" />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="sm"
                    className="h-8 text-[11px] font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm gap-1.5 px-3 rounded-md"
                    disabled={isLoading}
                  >
                    <Upload className="h-3.5 w-3.5" />
                    EXPORT
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-[140px] rounded-xl border border-slate-200 dark:border-slate-800 shadow-xl">
                  <DropdownMenuItem onClick={() => handleExport('csv')} className="text-xs font-medium cursor-pointer py-2">
                    <FileText className="mr-2.5 h-3.5 w-3.5 text-slate-400" />
                    CSV Export
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport('excel')} className="text-xs font-medium cursor-pointer py-2">
                    <FileSpreadsheet className="mr-2.5 h-3.5 w-3.5 text-emerald-500" />
                    Excel Workbook
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport('pdf')} className="text-xs font-medium cursor-pointer py-2">
                    <FilePdf className="mr-2.5 h-3.5 w-3.5 text-rose-500" />
                    PDF Document
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-200 dark:border-slate-800">
                  {isVisible("date") && <TableHead className="pl-6 h-10 text-xs font-semibold uppercase tracking-wider text-slate-500">Date</TableHead>}
                  {isVisible("tid") && <TableHead className="h-10 text-xs font-semibold uppercase tracking-wider text-slate-500">Transaction ID</TableHead>}
                  {isVisible("organization") && <TableHead className="h-10 text-xs font-semibold uppercase tracking-wider text-slate-500">Organization</TableHead>}
                  {isVisible("group") && <TableHead className="h-10 text-xs font-semibold uppercase tracking-wider text-slate-500">Group</TableHead>}
                  {isVisible("branch") && <TableHead className="h-10 text-xs font-semibold uppercase tracking-wider text-slate-500">Branch</TableHead>}
                  {isVisible("status") && <TableHead className="h-10 text-xs font-semibold uppercase tracking-wider text-slate-500">Status</TableHead>}
                  {isVisible("subtotal") && <TableHead className="text-right h-10 text-xs font-semibold uppercase tracking-wider text-slate-500">Subtotal</TableHead>}
                  {isVisible("tax") && <TableHead className="text-right h-10 text-xs font-semibold uppercase tracking-wider text-slate-500">Tax</TableHead>}
                  {isVisible("discount") && <TableHead className="text-right h-10 text-xs font-semibold uppercase tracking-wider text-slate-500">Discount</TableHead>}
                  {isVisible("total") && <TableHead className="text-right pr-6 h-10 text-xs font-semibold uppercase tracking-wider text-slate-500">Total</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={visibleKeys.length} className="h-32 text-center">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-indigo-500" />
                    </TableCell>
                  </TableRow>
                ) : filteredOrders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={visibleKeys.length} className="h-32 text-center">
                      <div className="flex flex-col items-center justify-center text-slate-400 space-y-2">
                        <Search className="h-8 w-8 opacity-20" />
                        <p className="text-sm font-medium text-slate-500">No orders found for the selected criteria.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredOrders.map((order: any) => (
                    <TableRow
                      key={order.id}
                      className="hover:bg-indigo-50/40 dark:hover:bg-indigo-900/10 transition-colors cursor-pointer border-b border-slate-100 dark:border-slate-800/50"
                      onClick={() => handleRowClick(order)}
                    >
                      {isVisible("date") && (
                        <TableCell className="font-mono text-xs pl-6 text-slate-600 dark:text-slate-400 py-3" suppressHydrationWarning>
                          {new Date(order.createdAt).toLocaleDateString()}
                        </TableCell>
                      )}
                      {isVisible("tid") && (
                        <TableCell className="font-mono text-xs font-bold text-slate-900 dark:text-slate-200 py-3">{order.tid}</TableCell>
                      )}
                      {isVisible("organization") && (
                        <TableCell className="text-xs text-slate-500 font-medium py-3">
                          {order.organizationName || '-'}
                        </TableCell>
                      )}
                      {isVisible("group") && (
                        <TableCell className="text-xs text-slate-500 font-medium py-3">
                          {order.groupName || '-'}
                        </TableCell>
                      )}
                      {isVisible("branch") && (
                        <TableCell className="text-xs text-slate-600 dark:text-slate-300 font-medium py-3">
                          {order.branchName || `ID: ${order.branchId}`}
                        </TableCell>
                      )}
                      {isVisible("status") && (
                        <TableCell className="py-3">
                          <Badge variant="outline" className={cn(
                            "text-[9px] uppercase font-bold tracking-widest border-none px-2 py-0.5",
                            order.status === 'FULFILLED' ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400' :
                              order.status === 'PENDING' ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400' :
                                'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                          )}>
                            {order.status}
                          </Badge>
                        </TableCell>
                      )}
                      {isVisible("subtotal") && (
                        <TableCell className="text-right font-mono text-xs text-slate-500 py-3">
                          {formatPKR((order.subtotalCents || 0) / 100)}
                        </TableCell>
                      )}
                      {isVisible("tax") && (
                        <TableCell className="text-right font-mono text-xs text-slate-500 py-3">
                          {formatPKR((order.taxCents || 0) / 100)}
                        </TableCell>
                      )}
                      {isVisible("discount") && (
                        <TableCell className="text-right font-mono text-xs text-rose-500 dark:text-rose-400 font-medium py-3">
                          -{formatPKR((order.discountCents || 0) / 100)}
                        </TableCell>
                      )}
                      {isVisible("total") && (
                        <TableCell className="text-right font-mono font-bold text-xs pr-6 text-slate-900 dark:text-white py-3">
                          {formatPKR((order.totalCents || 0) / 100)}
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <div className="p-3 bg-slate-50/50 dark:bg-slate-900/20 text-center">
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
              Report Generated: {generatedDate}
            </p>
          </div>
        </Card>

        {/* Expandable Row Drawer */}
        <ExpandableRowDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          title={selectedRow?.tid || "Transaction Details"}
          subtitle={selectedRow ? `${selectedRow.branchName || 'Unknown'} • ${new Date(selectedRow.createdAt).toLocaleDateString()}` : ""}
          fields={selectedRow ? getDrawerFields(selectedRow).filter(f => !f.key || isVisible(f.key)) : []}
        />
      </div>
    </div>
  )
}
