"use client"

import { useState, useEffect, useMemo } from "react"
import useSWR from "swr"
import { useAppContext } from "@/components/context/app-context"
import { SectionHeader } from "@/components/ui/section-header"
import { Card } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Loader2, User, Package, TrendingUp, FileText, Hash } from "lucide-react"
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

const fetcher = (url: string) => fetch(url).then((r) => r.json())

const ALL_COLUMNS: ColumnDef[] = [
  { key: "date", label: "Date", defaultVisible: true },
  { key: "product", label: "Product", defaultVisible: true },
  { key: "branch", label: "Branch", defaultVisible: true },
  { key: "total", label: "Total", defaultVisible: true },
  { key: "sku", label: "SKU", defaultVisible: false },
  { key: "tid", label: "Trans ID", defaultVisible: false },
  { key: "organization", label: "Organization", defaultVisible: false },
  { key: "group", label: "Group", defaultVisible: false },
  { key: "processedBy", label: "Processed By", defaultVisible: false },
  { key: "qty", label: "Qty", defaultVisible: false },
]

export default function ProductSummaryDetailsReportPage() {
  const { organizationId, branchId } = useAppContext()
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

  const { visibleKeys, isVisible, setVisibleKeys } = useColumnSelector(ALL_COLUMNS, "product-details")

  const queryParams = new URLSearchParams()
  if (branchId) queryParams.set("branchId", branchId)
  if (organizationId) queryParams.set("organizationId", organizationId.toString())
  if (startDate) queryParams.set("startDate", startDate)
  if (endDate) queryParams.set("endDate", endDate)
  if (groupId) queryParams.set("groupId", groupId)
  queryParams.set("limit", "10000")

  const { data, isLoading, mutate } = useSWR(`/api/v1/analytics/products/details?${queryParams.toString()}`, fetcher)

  useEffect(() => {
    setHasMounted(true)
    setGeneratedDate(new Date().toLocaleString())
  }, [])



  const detailsData = data?.items || []

  const filteredDetails = detailsData.filter((d: any) =>
    d.productName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.productCode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.tid?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.createdByName?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const totalRevenue = filteredDetails.reduce((sum: number, d: any) => {
    const status = (d.orderStatus || "").toUpperCase()
    if (status === "REJECTED" || status === "CANCELLED" || status === "REFUNDED") return sum
    return sum + (d.priceCents * d.quantity || 0)
  }, 0)
  const totalItems = filteredDetails.reduce((sum: number, d: any) => sum + (d.quantity || 0), 0)

  const sparklineData = useMemo(() => {
    const daily: Record<string, number> = {}
    filteredDetails.forEach((d: any) => {
      const day = new Date(d.orderDate).toLocaleDateString()
      daily[day] = (daily[day] || 0) + (d.priceCents * d.quantity) / 100
    })
    return Object.values(daily).slice(-14)
  }, [filteredDetails])

  const filterTags: FilterTag[] = []
  if (organizationId) filterTags.push({ key: "org", label: "Org", value: String(organizationId), color: "blue" })
  if (branchId) filterTags.push({ key: "branch", label: "Branch", value: String(branchId), color: "indigo" })
  if (startDate || endDate) filterTags.push({ key: "dates", label: "Period", value: `${startDate || "..."} – ${endDate || "..."}`, color: "emerald" })

  const handleRemoveFilter = (key: string) => {
    if (key === "dates") { setStartDate(""); setEndDate("") }
    if (key === "group") setGroupId("")
  }

  const handleRowClick = (item: any) => {
    setSelectedRow(item)
    setDrawerOpen(true)
  }

  const getDrawerFields = (d: any): DetailField[] => [
    { key: "productName", label: "Product", value: d.productName },
    { key: "sku", label: "SKU", value: d.productCode || "-", type: "mono" },
    { key: "tid", label: "Transaction ID", value: d.tid, type: "mono" },
    { key: "date", label: "Order Date", value: new Date(d.orderDate).toLocaleString(), type: "date" },
    { key: "organization", label: "Organization", value: d.organizationName || "-" },
    { key: "group", label: "Group", value: d.groupName || "-" },
    { key: "branch", label: "Branch", value: d.branchName },
    { key: "employee", label: "Processed By", value: d.createdByName || d.createdByEmail },
    { key: "qty", label: "Quantity", value: d.quantity },
    { key: "total", label: "Total", value: formatPKR((d.priceCents * d.quantity) / 100), type: "currency" },
  ]

  const handleExport = (format: 'csv' | 'excel' | 'pdf') => {
    const headers = ["Date", "Product", "SKU", "Transaction ID", "Organization", "Group", "Branch", "Processed By", "Qty", "Total (PKR)"]
    const rows = filteredDetails.map((d: any) => [
      new Date(d.orderDate).toLocaleDateString(), d.productName, d.productCode || "-", d.tid,
      d.organizationName || "-", d.groupName || "-", d.branchName, d.createdByName || d.createdByEmail,
      d.quantity, ((d.priceCents * d.quantity) / 100).toFixed(2)
    ])

    if (format === 'pdf') {
      const doc = new jsPDF({ orientation: "landscape" })
      doc.setFontSize(20); doc.text("Product Summary Details Report", 14, 20)
      doc.setFontSize(10); doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28)
      autoTable(doc, { startY: 40, head: [headers], body: rows, theme: 'grid', headStyles: { fillColor: [66, 66, 66], fontSize: 8 }, styles: { fontSize: 8 } })
      doc.save(`product-details-${new Date().getTime()}.pdf`)
      return
    }

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows])
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Product Details")
    XLSX.writeFile(workbook, `product-details-${new Date().getTime()}.${format === 'excel' ? 'xlsx' : 'csv'}`)
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
      <SectionHeader title="Product Summary Details" subtitle="Granular audit of every product transaction across locations." />

      <QuickDateRange startDate={startDate} endDate={endDate} onStartDateChange={setStartDate} onEndDateChange={setEndDate} storageKey="product-details-dates" />

      <FilterTagBar tags={filterTags} onRemove={handleRemoveFilter} />

      <ReportFilters
        searchTerm={searchTerm} setSearchTerm={setSearchTerm}
        startDate={startDate} setStartDate={setStartDate}
        endDate={endDate} setEndDate={setEndDate}
        groupId={groupId} setGroupId={setGroupId}
        onRefresh={() => {
          setSearchTerm("")
          setStartDate("")
          setEndDate("")
          setGroupId("")
          mutate()
        }} isLoading={isLoading}
        role={role} organizationId={organizationId || undefined}
        searchPlaceholder="Search Product, TID, or User..."
        onExport={handleExport}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <KPICard title="Total Revenue" value={formatPKR(totalRevenue / 100)} icon={TrendingUp} colorScheme="emerald" trendData={sparklineData} />
        <KPICard title="Transactions" value={filteredDetails.length} icon={FileText} colorScheme="violet" />
      </div>

      <Card className="overflow-hidden border-none shadow-sm bg-white dark:bg-slate-900">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex flex-wrap justify-between items-center gap-3">
          <h3 className="font-bold text-slate-900 dark:text-white text-sm">Transaction Details</h3>
          <div className="flex items-center gap-2">
            <ColumnSelector columns={ALL_COLUMNS} storageKey="product-details" visibleKeys={visibleKeys} onChange={setVisibleKeys} />
            <ScheduleReportModal reportName="Product Details" />
          </div>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              {isVisible("date") && <TableHead>Date</TableHead>}
              {isVisible("product") && <TableHead>Product</TableHead>}
              {isVisible("sku") && <TableHead>SKU</TableHead>}
              {isVisible("tid") && <TableHead>Trans ID</TableHead>}
              {isVisible("organization") && <TableHead>Organization</TableHead>}
              {isVisible("group") && <TableHead>Group</TableHead>}
              {isVisible("branch") && <TableHead>Branch</TableHead>}
              {isVisible("processedBy") && <TableHead>Processed By</TableHead>}
              {isVisible("qty") && <TableHead className="text-right">Qty</TableHead>}
              {isVisible("total") && <TableHead className="text-right">Total</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={10} className="h-24 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
            ) : filteredDetails.length === 0 ? (
              <TableRow><TableCell colSpan={10} className="h-24 text-center text-muted-foreground">No transaction details found.</TableCell></TableRow>
            ) : (
              filteredDetails.map((item: any) => (
                <TableRow key={item.id} className="hover:bg-indigo-50/30 dark:hover:bg-indigo-900/10 cursor-pointer transition-colors" onClick={() => handleRowClick(item)}>
                  {isVisible("date") && <TableCell className="text-[10px] font-mono whitespace-nowrap" suppressHydrationWarning>{new Date(item.orderDate).toLocaleDateString()}</TableCell>}
                  {isVisible("product") && <TableCell className="text-xs font-medium max-w-[150px] truncate">{item.productName}</TableCell>}
                  {isVisible("sku") && <TableCell className="text-[10px] font-mono text-muted-foreground">{item.productCode || "-"}</TableCell>}
                  {isVisible("tid") && <TableCell className="text-[10px] font-mono font-medium">{item.tid}</TableCell>}
                  {isVisible("organization") && <TableCell className="text-[10px] text-muted-foreground">{item.organizationName || "-"}</TableCell>}
                  {isVisible("group") && <TableCell className="text-[10px] text-muted-foreground">{item.groupName || "-"}</TableCell>}
                  {isVisible("branch") && <TableCell className="text-[10px] text-muted-foreground">{item.branchName}</TableCell>}
                  {isVisible("processedBy") && (
                    <TableCell className="text-[10px] font-medium">
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3 opacity-50" />
                        {item.createdByName || item.createdByEmail}
                      </div>
                    </TableCell>
                  )}
                  {isVisible("qty") && <TableCell className="text-right text-xs font-bold">{item.quantity.toLocaleString()}</TableCell>}
                  {isVisible("total") && <TableCell className="text-right text-xs font-bold text-indigo-600">{formatPKR((item.priceCents * item.quantity) / 100)}</TableCell>}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <div className="text-xs text-muted-foreground text-center">Report Generated: {generatedDate}</div>

      <ExpandableRowDrawer
        open={drawerOpen} onClose={() => setDrawerOpen(false)}
        title={selectedRow?.productName || "Transaction Details"}
        subtitle={selectedRow ? `${selectedRow.branchName} • TID: ${selectedRow.tid}` : ""}
        fields={selectedRow ? getDrawerFields(selectedRow).filter(f => !f.key || isVisible(f.key)) : []}
      />
    </div>
  )
}
