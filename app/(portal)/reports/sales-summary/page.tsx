"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import useSWR from "swr"
import { useAppContext } from "@/components/context/app-context"
import { SectionHeader } from "@/components/ui/section-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Loader2, ShoppingBag, TrendingUp, Package, Calculator, Upload, Building, Building2, Calendar, Users, Crown } from "lucide-react"
import * as XLSX from "xlsx"
import { formatPKR, cn } from "@/lib/utils"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import { Badge } from "@/components/ui/badge"
import { Role } from "@/lib/rbac"
import { useSession } from "next-auth/react"

import { KPICard } from "@/components/reports/kpi-card"
import { ColumnSelector, useColumnSelector, type ColumnDef } from "@/components/reports/column-selector"
import { ExpandableRowDrawer, type DetailField } from "@/components/reports/expandable-row-drawer"
import { ScheduleReportModal } from "@/components/reports/schedule-report-modal"
import { ReportFilters } from "@/components/reports/report-filters"

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

export default function SalesSummaryReportPage() {
  const {
    organizationId,
    branchId: contextBranchId,
    branchIds: contextBranchIds,
    setBranchId: setContextBranchId,
    setBranchIds: setContextBranchIds
  } = useAppContext()
  const [searchTerm, setSearchTerm] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [groupId, setGroupId] = useState("")
  const [generatedDate, setGeneratedDate] = useState("")
  const [selectedRow, setSelectedRow] = useState<any>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const { data: session } = useSession()
  const role = (session?.user as any)?.role as Role
  const [hasMounted, setHasMounted] = useState(false)

  // Column selector
  const { visibleKeys, toggleColumn, resetToDefaults, isVisible, setVisibleKeys } = useColumnSelector(ALL_COLUMNS, "sales-summary")

  // Sync with global context
  const branchIds = contextBranchIds

  const handleBranchChange = useCallback((ids: string[]) => {
    setContextBranchIds(ids)
  }, [setContextBranchIds])

  // Build query string
  const queryParams = new URLSearchParams()
  if (organizationId) queryParams.set("organizationId", organizationId.toString())
  if (startDate) queryParams.set("startDate", startDate)
  if (endDate) queryParams.set("endDate", endDate)
  if (groupId) queryParams.set("groupId", groupId)

  if (branchIds.length > 0) {
    queryParams.set("branchIds", branchIds.join(","))
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

  // Use backend summary totals directly — single source of truth
  const calculatedTotalRevenue = summary.totalSales || 0
  const calculatedOrderVolume = summary.orderCount || 0
  const calculatedAvgOrderValue = calculatedOrderVolume > 0 ? calculatedTotalRevenue / calculatedOrderVolume : 0

  // Generate sparkline data from filtered orders (visual only, not for KPI values)
  const sparklineData = useMemo(() => {
    if (!filteredOrders.length) return []
    const daily: Record<string, number> = {}
    filteredOrders.forEach((o: any) => {
      if ((o.status || "").toUpperCase() === "FULFILLED") {
        const day = new Date(o.createdAt).toLocaleDateString()
        daily[day] = (daily[day] || 0) + (o.totalCents || 0) / 100
      }
    })
    return Object.values(daily).slice(-14)
  }, [filteredOrders])

  const orderCountSparkline = useMemo(() => {
    if (!filteredOrders.length) return []
    const daily: Record<string, number> = {}
    filteredOrders.forEach((o: any) => {
      if ((o.status || "").toUpperCase() === "FULFILLED") {
        const day = new Date(o.createdAt).toLocaleDateString()
        daily[day] = (daily[day] || 0) + 1
      }
    })
    return Object.values(daily).slice(-14)
  }, [filteredOrders])



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

  // Top performers with progress bars
  const topPerformers = data?.topPerformers || []
  const maxSales = topPerformers.length > 0 ? Math.max(...topPerformers.map((p: any) => p.sales)) : 0

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
      const reportTitle = role === "HEAD_OFFICE" ? "Purchase Summary Report" : "Sales Summary Report"
      doc.text(reportTitle, 14, 20)
      doc.setFontSize(10)
      doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28)
      autoTable(doc, { startY: 40, head: [headers], body: rows, theme: 'grid', headStyles: { fillColor: [66, 66, 66] } })
      const fileNameBase = role === "HEAD_OFFICE" ? "purchase-summary" : "sales-summary"
      doc.save(`${fileNameBase}-${new Date().getTime()}.pdf`)
      return
    }

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows])
    const workbook = XLSX.utils.book_new()
    const sheetName = role === "HEAD_OFFICE" ? "Purchase Summary" : "Sales Summary"
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)

    const fileNameBase = role === "HEAD_OFFICE" ? "purchase-summary" : "sales-summary"
    if (format === 'excel') {
      XLSX.writeFile(workbook, `${fileNameBase}-${new Date().getTime()}.xlsx`)
    } else {
      XLSX.writeFile(workbook, `${fileNameBase}-${new Date().getTime()}.csv`)
    }
  }

  if (!hasMounted) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    )
  }

  return (
    <div className="space-y-5 pb-12">
      <SectionHeader
        title={role === "HEAD_OFFICE" ? "Product Purchase Summary" : "Sales Summary"}
        subtitle={role === "HEAD_OFFICE" ? "Comprehensive view of purchase, taxes, and order volume." : "Comprehensive view of sales, taxes, and order volume."}
      />

      {/* Filters Row */}
      <ReportFilters
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        startDate={startDate}
        setStartDate={setStartDate}
        endDate={endDate}
        setEndDate={setEndDate}
        groupId={groupId}
        setGroupId={setGroupId}
        selectedBranchIds={branchIds}
        onBranchChange={handleBranchChange}
        onRefresh={() => {
          setSearchTerm("")
          setStartDate("")
          setEndDate("")
          setGroupId("")
          handleBranchChange([])
          mutate()
        }}
        onExport={handleExport}
        isLoading={isLoading}
        role={role}
        organizationId={organizationId || undefined}
        searchPlaceholder="Filter by ID or Branch..."
        showBranchFilter={true}
      />

      {/* Bento Box KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <KPICard
          title="Total Revenue (Fulfilled)"
          value={formatPKR((summary?.totalSales ?? 0) / 100)}
          icon={TrendingUp}
          colorScheme="emerald"
          trendData={sparklineData}
        />
        <KPICard
          title="Order Volume (Fulfilled)"
          value={summary?.totalOrders ?? 0}
          icon={ShoppingBag}
          colorScheme="blue"
          trendData={orderCountSparkline}
        />
      </div>

      {/* Top Performing Branches — Progress Bar Style */}
      {topPerformers.length > 0 && (
        <Card className="overflow-hidden border-none shadow-sm bg-white dark:bg-slate-900">
          <CardHeader className="pb-3 border-b border-slate-50 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 uppercase tracking-tight">
                <Crown className="h-4 w-4 text-amber-500" />
                Top Performing Branches
              </CardTitle>
              <Badge variant="secondary" className="text-[10px] font-semibold">BY SALES VOLUME</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-5">
            <div className="space-y-4">
              {topPerformers.slice(0, 5).map((performer: any, index: number) => {
                const percentage = maxSales > 0 ? (performer.sales / maxSales) * 100 : 0
                const colors = [
                  "bg-gradient-to-r from-indigo-500 to-indigo-600",
                  "bg-gradient-to-r from-blue-500 to-blue-600",
                  "bg-gradient-to-r from-cyan-500 to-cyan-600",
                  "bg-gradient-to-r from-teal-500 to-teal-600",
                  "bg-gradient-to-r from-emerald-500 to-emerald-600",
                ]
                return (
                  <div key={performer.branchId} className="group">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-semibold text-slate-400 w-6">#{index + 1}</span>
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                          {performer.branchName || `Branch #${performer.branchId}`}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="text-[9px] h-4 px-1.5 border-slate-200 dark:border-slate-700">
                          {performer.orderCount} orders
                        </Badge>
                        <span className="text-xs font-mono font-semibold text-indigo-600 dark:text-indigo-400">
                          {formatPKR(performer.sales / 100)}
                        </span>
                      </div>
                    </div>
                    <div className="relative h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className={`absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out ${colors[index] || colors[4]}`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Transaction Table */}
      <Card className="overflow-hidden border-none shadow-sm bg-white dark:bg-slate-900 mb-8 pt-6">
        <div className="px-6 pb-4 border-b border-slate-100 dark:border-slate-800 flex flex-wrap justify-between items-center gap-3">
          <h3 className="font-semibold text-slate-900 dark:text-white">Transaction Logs</h3>
          <div className="flex items-center gap-2">
            <ColumnSelector
              columns={ALL_COLUMNS}
              storageKey="sales-summary"
              visibleKeys={visibleKeys}
              onChange={setVisibleKeys}
            />
            <ScheduleReportModal reportName="Sales Summary" />
            <Button variant="ghost" size="sm" onClick={() => handleExport('pdf')} className="text-xs font-semibold text-slate-500 hover:text-indigo-600">
              <Upload className="h-3.5 w-3.5 mr-2" />
              PDF
            </Button>
          </div>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/50 dark:bg-slate-800/50">
              {isVisible("date") && <TableHead className="pl-6">Date</TableHead>}
              {isVisible("tid") && <TableHead>Transaction ID</TableHead>}
              {isVisible("organization") && <TableHead>Organization</TableHead>}
              {isVisible("group") && <TableHead>Group</TableHead>}
              {isVisible("branch") && <TableHead>Branch</TableHead>}
              {isVisible("status") && <TableHead>Status</TableHead>}
              {isVisible("subtotal") && <TableHead className="text-right">Subtotal</TableHead>}
              {isVisible("tax") && <TableHead className="text-right">Tax</TableHead>}
              {isVisible("discount") && <TableHead className="text-right">Discount</TableHead>}
              {isVisible("total") && <TableHead className="text-right pr-6">Total</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={visibleKeys.length} className="h-24 text-center">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : filteredOrders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={visibleKeys.length} className="h-24 text-center text-muted-foreground">
                  No orders found for the selected criteria.
                </TableCell>
              </TableRow>
            ) : (
              filteredOrders.map((order: any) => (
                <TableRow
                  key={order.id}
                  className="hover:bg-indigo-50/30 dark:hover:bg-indigo-900/10 transition-colors cursor-pointer"
                  onClick={() => handleRowClick(order)}
                >
                  {isVisible("date") && (
                    <TableCell className="font-mono text-xs pl-6" suppressHydrationWarning>
                      {new Date(order.createdAt).toLocaleDateString()}
                    </TableCell>
                  )}
                  {isVisible("tid") && (
                    <TableCell className="font-mono text-xs font-medium">{order.tid}</TableCell>
                  )}
                  {isVisible("organization") && (
                    <TableCell className="text-xs text-muted-foreground font-medium">
                      {order.organizationName || '-'}
                    </TableCell>
                  )}
                  {isVisible("group") && (
                    <TableCell className="text-xs text-muted-foreground font-medium">
                      {order.groupName || '-'}
                    </TableCell>
                  )}
                  {isVisible("branch") && (
                    <TableCell className="text-xs text-muted-foreground font-medium">
                      {order.branchName || `ID: ${order.branchId}`}
                    </TableCell>
                  )}
                  {isVisible("status") && (
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] uppercase font-semibold tracking-tighter">
                        {order.status}
                      </Badge>
                    </TableCell>
                  )}
                  {isVisible("subtotal") && (
                    <TableCell className="text-right font-mono text-xs text-muted-foreground">
                      {formatPKR((order.subtotalCents || 0) / 100)}
                    </TableCell>
                  )}
                  {isVisible("tax") && (
                    <TableCell className="text-right font-mono text-xs text-muted-foreground">
                      {formatPKR((order.taxCents || 0) / 100)}
                    </TableCell>
                  )}
                  {isVisible("discount") && (
                    <TableCell className="text-right font-mono text-xs text-rose-500">
                      -{formatPKR((order.discountCents || 0) / 100)}
                    </TableCell>
                  )}
                  {isVisible("total") && (
                    <TableCell className="text-right font-mono font-medium text-xs pr-6">
                      {formatPKR((order.totalCents || 0) / 100)}
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 text-center">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.2em]">
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
  )
}
