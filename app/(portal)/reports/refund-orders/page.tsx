"use client"

import { useState, useEffect, useMemo } from "react"
import useSWR from "swr"
import { useAppContext } from "@/components/context/app-context"
import { SectionHeader } from "@/components/ui/section-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Loader2, MapPin, TrendingDown, Hash, DollarSign, PercentCircle, Upload } from "lucide-react"
import { formatPKR } from "@/lib/utils"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import * as XLSX from "xlsx"
import { Badge } from "@/components/ui/badge"
import { Role } from "@/lib/rbac"
import { useSession } from "next-auth/react"

import { QuickDateRange } from "@/components/reports/quick-date-range"
import { KPICard } from "@/components/reports/kpi-card"
import { FilterTagBar, type FilterTag } from "@/components/reports/filter-tag-bar"
import { ColumnSelector, useColumnSelector, type ColumnDef } from "@/components/reports/column-selector"
import { ExpandableRowDrawer, type DetailField } from "@/components/reports/expandable-row-drawer"
import { ScheduleReportModal } from "@/components/reports/schedule-report-modal"
import { ReportFilters } from "@/components/reports/report-filters"
import { fetcher } from "@/lib/fetcher"
import { cn } from "@/lib/utils"

const ALL_COLUMNS: ColumnDef[] = [
  { key: "date", label: "Refund Date", defaultVisible: true },
  { key: "tid", label: "Transaction ID", defaultVisible: true },
  { key: "branch", label: "Branch", defaultVisible: true },
  { key: "refundAmount", label: "Refund Amount", defaultVisible: true },
  { key: "organization", label: "Organization", defaultVisible: false },
  { key: "refundType", label: "Refund Type", defaultVisible: false },
  { key: "prevStatus", label: "Previous Status", defaultVisible: false },
  { key: "orderTotal", label: "Order Total", defaultVisible: false },
  { key: "reason", label: "Reason", defaultVisible: false },
]

type StatusFilter = "all" | "fulfilled" | "refunded" | "rejected"

export default function RefundOrdersReportPage() {
  const { organizationId, branchId } = useAppContext()
  const [searchTerm, setSearchTerm] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>([])
  const [generatedDate, setGeneratedDate] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [selectedRow, setSelectedRow] = useState<any>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const { data: session } = useSession()
  const role = (session?.user as any)?.role as Role
  const [hasMounted, setHasMounted] = useState(false)

  const { visibleKeys, isVisible, setVisibleKeys } = useColumnSelector(ALL_COLUMNS, "order-intelligence")

  const queryParams = new URLSearchParams()
  // Preference order: Selected filter > App context
  const targetBranchIds = selectedBranchIds.length > 0 ? selectedBranchIds : (branchId ? [String(branchId)] : [])
  if (targetBranchIds.length > 0) queryParams.set("branchIds", targetBranchIds.join(","))
  if (organizationId) queryParams.set("organizationId", String(organizationId))
  if (startDate) queryParams.set("startDate", startDate)
  if (endDate) queryParams.set("endDate", endDate)
  queryParams.set("limit", "10000")

  const { data, isLoading, mutate } = useSWR<any>(`/api/v1/analytics/refunds?${queryParams.toString()}`, fetcher)

  useEffect(() => {
    setHasMounted(true)
    setGeneratedDate(new Date().toLocaleString())
  }, [])

  if (!hasMounted) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    )
  }

  const refundsData = data?.items || []

  // Apply status filter
  const statusFiltered = statusFilter === "all"
    ? refundsData
    : refundsData.filter((r: any) => {
      const status = (r.statusAtRefund || r.status || "").toLowerCase()
      if (statusFilter === "fulfilled") return status === "fulfilled" || status === "completed" || status === "approved"
      if (statusFilter === "refunded") return status === "refunded"
      if (statusFilter === "rejected") return status === "rejected"
      return true
    })

  const filteredRefunds = statusFiltered.filter((r: any) =>
    r.tid?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.branchName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.reason?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const totalRefunded = filteredRefunds.reduce((sum: number, r: any) => sum + (r.refundAmount || 0), 0)
  const totalOrders = filteredRefunds.length
  const avgRefund = totalOrders > 0 ? totalRefunded / totalOrders : 0
  const refundRate = refundsData.length > 0 ? (filteredRefunds.filter((r: any) => (r.statusAtRefund || r.status || "").toLowerCase() === "refunded").length / refundsData.length) * 100 : 0

  // Sparkline data
  const sparklineData = useMemo(() => {
    const daily: Record<string, number> = {}
    filteredRefunds.forEach((r: any) => {
      const day = new Date(r.refundedAt || r.createdAt).toLocaleDateString()
      daily[day] = (daily[day] || 0) + (r.refundAmount || 0) / 100
    })
    return Object.values(daily).slice(-14)
  }, [filteredRefunds])

  // Filter tags
  const filterTags: FilterTag[] = []
  if (organizationId) filterTags.push({ key: "org", label: "Org", value: String(organizationId), color: "blue" })
  if (targetBranchIds.length > 0) filterTags.push({ key: "branches", label: "Branches", value: `${targetBranchIds.length} selected`, color: "indigo" })
  if (startDate || endDate) filterTags.push({ key: "dates", label: "Period", value: `${startDate || "..."} – ${endDate || "..."}`, color: "emerald" })

  const handleRemoveFilter = (key: string) => {
    if (key === "branches") setSelectedBranchIds([])
    if (key === "dates") { setStartDate(""); setEndDate("") }
  }

  const handleRowClick = (refund: any) => {
    setSelectedRow(refund)
    setDrawerOpen(true)
  }

  const getDrawerFields = (r: any): DetailField[] => [
    { label: "Transaction ID", value: r.tid, type: "mono" },
    { label: "Refund Date", value: new Date(r.refundedAt || r.createdAt).toLocaleString(), type: "date" },
    { label: "Organization", value: r.organizationName || `Org #${r.organizationId}` },
    { label: "Branch", value: r.branchName },
    { label: "Refund Type", value: r.refundType || "PARTIAL", type: "badge" },
    { label: "Status at Refund", value: r.statusAtRefund || r.status, type: "badge" },
    { label: "Order Total", value: formatPKR(r.orderTotal / 100), type: "currency" },
    { label: "Refund Amount", value: formatPKR(r.refundAmount / 100), type: "currency" },
    { label: "Reason", value: r.reason || "N/A" },
  ]

  // Status tabs
  const statusTabs: { key: StatusFilter; label: string; count: number }[] = [
    { key: "all", label: "All", count: refundsData.length },
    { key: "fulfilled", label: "Fulfilled", count: refundsData.filter((r: any) => ["fulfilled", "completed", "approved"].includes((r.statusAtRefund || r.status || "").toLowerCase())).length },
    { key: "refunded", label: "Refunded", count: refundsData.filter((r: any) => (r.statusAtRefund || r.status || "").toLowerCase() === "refunded").length },
    { key: "rejected", label: "Rejected", count: refundsData.filter((r: any) => (r.statusAtRefund || r.status || "").toLowerCase() === "rejected").length },
  ]

  const handleExport = (format: 'csv' | 'excel' | 'pdf') => {
    const isSuperAdmin = role === "SUPER_ADMIN"
    const headers = ["Refund Date", "Transaction ID"]
    if (isSuperAdmin) headers.push("Organization")
    headers.push("Branch", "Refund Type", "Status at Refund", "Order Total", "Refund Amount", "Reason")

    const rows = filteredRefunds.map((r: any) => {
      const row = [new Date(r.refundedAt || r.createdAt).toLocaleDateString(), r.tid]
      if (isSuperAdmin) row.push(r.organizationName || `Org #${r.organizationId}`)
      row.push(r.branchName, r.refundType || "PARTIAL", r.statusAtRefund || r.status, (r.orderTotal / 100).toFixed(2), (r.refundAmount / 100).toFixed(2), r.reason || "N/A")
      return row
    })

    if (format === 'pdf') {
      const doc = new jsPDF({ orientation: "landscape" })
      doc.setFontSize(20)
      doc.text("Order Intelligence Report", 14, 20)
      doc.setFontSize(10)
      doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28)
      autoTable(doc, { startY: 40, head: [headers], body: rows, theme: 'grid', headStyles: { fillColor: [66, 66, 66], fontSize: 8 }, styles: { fontSize: 8 } })
      doc.save(`order-intelligence-${new Date().getTime()}.pdf`)
      return
    }

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows])
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Order Intelligence")
    if (format === 'excel') {
      XLSX.writeFile(workbook, `order-intelligence-${new Date().getTime()}.xlsx`)
    } else {
      XLSX.writeFile(workbook, `order-intelligence-${new Date().getTime()}.csv`)
    }
  }

  return (
    <div className="space-y-5">
      <SectionHeader title="Order Intelligence" subtitle="Analyze order lifecycle, refund trends, and transaction reversal insights." />

      {/* Quick Date Range */}
      <QuickDateRange
        startDate={startDate}
        endDate={endDate}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
        storageKey="order-intelligence-dates"
      />

      {/* Filter Tag Bar */}
      <FilterTagBar tags={filterTags} onRemove={handleRemoveFilter} />

      {/* Filters */}
      <ReportFilters
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        startDate={startDate}
        setStartDate={setStartDate}
        endDate={endDate}
        setEndDate={setEndDate}
        selectedBranchIds={selectedBranchIds}
        onBranchChange={setSelectedBranchIds}
        onRefresh={() => mutate()}
        isLoading={isLoading}
        role={role}
        organizationId={organizationId || undefined}
        showGroupFilter={false}
        showBranchFilter={true}
        searchPlaceholder="Search TID, Branch, or Reason..."
        onExport={handleExport}
      />

      {/* Bento Box KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Total Refunded"
          value={formatPKR(totalRefunded / 100)}
          icon={TrendingDown}
          colorScheme="rose"
          trendData={sparklineData}
        />
        <KPICard
          title="Refund Count"
          value={totalOrders}
          icon={Hash}
          colorScheme="blue"
        />
        <KPICard
          title="Avg. Refund Value"
          value={formatPKR(avgRefund / 100)}
          icon={DollarSign}
          colorScheme="amber"
        />
        <KPICard
          title="Refund Rate"
          value={`${refundRate.toFixed(1)}%`}
          icon={PercentCircle}
          colorScheme="violet"
        />
      </div>

      {/* Status Segmented Toggle */}
      <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/50 w-fit">
        {statusTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setStatusFilter(tab.key)}
            className={cn(
              "px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-200 flex items-center gap-2",
              statusFilter === tab.key
                ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm ring-1 ring-slate-200 dark:ring-slate-600"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
            )}
          >
            {tab.label}
            <span className={cn(
              "text-[10px] px-1.5 py-0.5 rounded-md font-semibold",
              statusFilter === tab.key
                ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400"
                : "bg-slate-200/50 dark:bg-slate-700/50 text-slate-400"
            )}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Table */}
      <Card className="overflow-hidden border-none shadow-sm bg-white dark:bg-slate-900">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex flex-wrap justify-between items-center gap-3">
          <h3 className="font-semibold text-slate-900 dark:text-white text-sm">Transaction Details</h3>
          <div className="flex items-center gap-2">
            <ColumnSelector
              columns={ALL_COLUMNS}
              storageKey="order-intelligence"
              visibleKeys={visibleKeys}
              onChange={setVisibleKeys}
            />
            <ScheduleReportModal reportName="Order Intelligence" />
          </div>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              {isVisible("date") && <TableHead>Refund Date</TableHead>}
              {isVisible("tid") && <TableHead>Transaction ID</TableHead>}
              {isVisible("organization") && role === "SUPER_ADMIN" && <TableHead>Organization</TableHead>}
              {isVisible("branch") && <TableHead>Branch</TableHead>}
              {isVisible("refundType") && <TableHead>Refund Type</TableHead>}
              {isVisible("prevStatus") && <TableHead>Previous Status</TableHead>}
              {isVisible("orderTotal") && <TableHead className="text-right">Order Total</TableHead>}
              {isVisible("refundAmount") && <TableHead className="text-right">Refund Amount</TableHead>}
              {isVisible("reason") && <TableHead>Reason</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={role === "SUPER_ADMIN" ? 9 : 8} className="h-24 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
            ) : filteredRefunds.length === 0 ? (
              <TableRow><TableCell colSpan={role === "SUPER_ADMIN" ? 9 : 8} className="h-24 text-center text-muted-foreground">No refunds found.</TableCell></TableRow>
            ) : (
              filteredRefunds.map((refund: any) => (
                <TableRow key={refund.id} className="hover:bg-indigo-50/30 dark:hover:bg-indigo-900/10 cursor-pointer transition-colors" onClick={() => handleRowClick(refund)}>
                  {isVisible("date") && <TableCell className="text-xs" suppressHydrationWarning>{refund.refundedAt ? new Date(refund.refundedAt).toLocaleDateString() : new Date(refund.createdAt).toLocaleDateString()}</TableCell>}
                  {isVisible("tid") && <TableCell className="text-xs font-semibold font-mono">{refund.tid}</TableCell>}
                  {isVisible("organization") && role === "SUPER_ADMIN" && (
                    <TableCell className="text-xs font-medium">
                      {refund.organizationName || `Org #${refund.organizationId}`}
                    </TableCell>
                  )}
                  {isVisible("branch") && (
                    <TableCell className="text-xs text-muted-foreground flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {refund.branchName}
                    </TableCell>
                  )}
                  {isVisible("refundType") && (
                    <TableCell>
                      <Badge variant={refund.refundType === 'FULL' ? 'destructive' : 'outline'} className="text-[10px]">
                        {refund.refundType || 'PARTIAL'}
                      </Badge>
                    </TableCell>
                  )}
                  {isVisible("prevStatus") && (
                    <TableCell>
                      <Badge variant="secondary" className="text-[10px]">
                        {refund.statusAtRefund || refund.status}
                      </Badge>
                    </TableCell>
                  )}
                  {isVisible("orderTotal") && <TableCell className="text-right text-xs">{formatPKR(refund.orderTotal / 100)}</TableCell>}
                  {isVisible("refundAmount") && <TableCell className="text-right text-xs font-semibold text-red-600">{formatPKR(refund.refundAmount / 100)}</TableCell>}
                  {isVisible("reason") && <TableCell className="text-xs max-w-[200px] truncate">{refund.reason || "-"}</TableCell>}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <div className="text-xs text-muted-foreground text-center pb-4">Report Generated: {generatedDate}</div>

      <ExpandableRowDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={selectedRow?.tid || "Refund Details"}
        subtitle={selectedRow ? `${selectedRow.branchName || 'Unknown'}` : ""}
        fields={selectedRow ? getDrawerFields(selectedRow) : []}
      />
    </div>
  )
}
