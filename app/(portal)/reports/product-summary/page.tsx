"use client"

import { useState, useEffect, useMemo } from "react"
import useSWR from "swr"
import { useAppContext } from "@/components/context/app-context"
import { SectionHeader } from "@/components/ui/section-header"
import { Card } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Loader2, Package, TrendingUp, Layers, BarChart3, Upload } from "lucide-react"
import { formatPKR, cn } from "@/lib/utils"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import * as XLSX from "xlsx"
import { Badge } from "@/components/ui/badge"
import { Role } from "@/lib/rbac"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"

import { KPICard } from "@/components/reports/kpi-card"
import { ColumnSelector, useColumnSelector, type ColumnDef } from "@/components/reports/column-selector"
import { ExpandableRowDrawer, type DetailField } from "@/components/reports/expandable-row-drawer"
import { ScheduleReportModal } from "@/components/reports/schedule-report-modal"
import { ReportFilters } from "@/components/reports/report-filters"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

const ALL_COLUMNS: ColumnDef[] = [
  { key: "orderDate", label: "Order Date", defaultVisible: true },
  { key: "productName", label: "Item Name", defaultVisible: true },
  { key: "branch", label: "Branch", defaultVisible: true },
  { key: "total", label: "Total", defaultVisible: true },
  { key: "employeeId", label: "Employee ID", defaultVisible: false },
  { key: "organization", label: "Organization", defaultVisible: false },
  { key: "group", label: "Group", defaultVisible: false },
  { key: "category", label: "Category", defaultVisible: false },
  { key: "subCategory", label: "Sub-Category", defaultVisible: false },
  { key: "productCode", label: "Item Code", defaultVisible: false },
  { key: "qty", label: "Qty", defaultVisible: false },
  { key: "price", label: "Price", defaultVisible: false },
  { key: "status", label: "Status", defaultVisible: false },
]

export default function ProductSummaryReportPage() {
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

  const { visibleKeys, isVisible, setVisibleKeys } = useColumnSelector(ALL_COLUMNS, "product-summary")

  const queryParams = new URLSearchParams()
  if (branchId) queryParams.set("branchId", branchId)
  if (organizationId) queryParams.set("organizationId", organizationId)
  if (startDate) queryParams.set("startDate", startDate)
  if (endDate) queryParams.set("endDate", endDate)
  if (groupId) queryParams.set("groupId", groupId)
  queryParams.set("limit", "10000")

  const { data, isLoading, mutate } = useSWR(`/api/v1/analytics/products/summary?${queryParams.toString()}`, fetcher)

  useEffect(() => {
    setHasMounted(true)
    setGeneratedDate(new Date().toLocaleString())
  }, [])



  const orderItems = data?.items || []

  const filteredItems = orderItems.filter((item: any) =>
    item.productName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.productCode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.branchName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.userEmail?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const totalRevenue = filteredItems.reduce((sum: number, item: any) => {
    const status = (item.orderStatus || "").toUpperCase()
    if (status === "REJECTED" || status === "CANCELLED" || status === "REFUNDED") return sum
    return sum + (item.totalAmount || 0)
  }, 0)
  const totalVolume = filteredItems.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0)
  const uniqueProducts = new Set(filteredItems.map((item: any) => item.productName)).size

  // Top category
  const categoryCounts: Record<string, number> = {}
  filteredItems.forEach((item: any) => {
    const cat = item.categoryName || "Uncategorized"
    categoryCounts[cat] = (categoryCounts[cat] || 0) + (item.totalAmount || 0)
  })
  const topCategory = Object.entries(categoryCounts).sort(([, a], [, b]) => b - a)[0]?.[0] || "N/A"

  // Sparkline data
  const sparklineData = useMemo(() => {
    const daily: Record<string, number> = {}
    filteredItems.forEach((item: any) => {
      const day = new Date(item.orderDate).toLocaleDateString()
      daily[day] = (daily[day] || 0) + (item.totalAmount || 0) / 100
    })
    return Object.values(daily).slice(-14)
  }, [filteredItems])


  const handleRowClick = (item: any) => {
    setSelectedRow(item)
    setDrawerOpen(true)
  }

  const getDrawerFields = (item: any): DetailField[] => [
    { key: "productName", label: "Product Name", value: item.productName },
    { key: "productCode", label: "Product Code", value: item.productCode || "-", type: "mono" },
    { key: "orderDate", label: "Order Date", value: new Date(item.orderDate).toLocaleString(), type: "date" },
    { key: "employeeId", label: "Employee ID", value: item.employeeId || "-", type: "mono" },
    { key: "organization", label: "Organization", value: item.organizationName || "-" },
    { key: "group", label: "Group", value: item.groupName || "-" },
    { key: "category", label: "Category", value: item.categoryName || "-" },
    { key: "subCategory", label: "Sub-Category", value: item.subCategoryName || "-" },
    { key: "branch", label: "Branch", value: item.branchName },
    { key: "qty", label: "Quantity", value: item.quantity },
    { key: "price", label: "Unit Price", value: formatPKR(item.priceCents / 100), type: "currency" },
    { key: "total", label: "Total", value: formatPKR(item.totalAmount / 100), type: "currency" },
    { key: "status", label: "Status", value: item.orderStatus, type: "badge" },
  ]

  const handleExport = (format: 'csv' | 'excel' | 'pdf') => {
    const headers = ["Order Date", "Employee ID", "Organization", "Group", "Item Name", "Category", "Sub-Category", "Item Code", "Branch", "Qty", "Price", "Total", "Status"]
    const rows = filteredItems.map((item: any) => [
      new Date(item.orderDate).toLocaleDateString(), item.employeeId || "N/A", item.organizationName || "-", item.groupName || "-",
      item.productName, item.categoryName || "-", item.subCategoryName || "-", item.productCode || "N/A",
      item.branchName, item.quantity, (item.priceCents / 100).toFixed(2), (item.totalAmount / 100).toFixed(2), item.orderStatus
    ])

    if (format === 'pdf') {
      const doc = new jsPDF({ orientation: "landscape" })
      doc.setFontSize(20); doc.text("Product Summary Report", 14, 20)
      doc.setFontSize(10); doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28)
      autoTable(doc, { startY: 40, head: [headers], body: rows, theme: 'grid', headStyles: { fillColor: [66, 66, 66], fontSize: 8 }, styles: { fontSize: 8 } })
      doc.save(`product-summary-${new Date().getTime()}.pdf`)
      return
    }

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows])
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Product Summary")
    XLSX.writeFile(workbook, `product-summary-${new Date().getTime()}.${format === 'excel' ? 'xlsx' : 'csv'}`)
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
      <SectionHeader title="Product Summary" subtitle="Analyze product performance and category-wise breakdown." />


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
        searchPlaceholder="Search Product, SKU, Branch, or User..."
        onExport={handleExport}
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <KPICard title="Total Revenue" value={formatPKR(totalRevenue / 100)} icon={TrendingUp} colorScheme="emerald" trendData={sparklineData} />
        <KPICard title="Unique Products" value={uniqueProducts} icon={Layers} colorScheme="violet" />
      </div>

      {/* Table */}
      <Card className="overflow-hidden border-none shadow-sm bg-white dark:bg-slate-900">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex flex-wrap justify-between items-center gap-3">
          <h3 className="font-bold text-slate-900 dark:text-white text-sm">Product Transactions</h3>
          <div className="flex items-center gap-2">
            <ColumnSelector columns={ALL_COLUMNS} storageKey="product-summary" visibleKeys={visibleKeys} onChange={setVisibleKeys} />
            <ScheduleReportModal reportName="Product Summary" />
          </div>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              {isVisible("orderDate") && <TableHead>Order Date</TableHead>}
              {isVisible("employeeId") && <TableHead>Employee ID</TableHead>}
              {isVisible("organization") && <TableHead>Organization</TableHead>}
              {isVisible("group") && <TableHead>Group</TableHead>}
              {isVisible("productName") && <TableHead>Item Name</TableHead>}
              {isVisible("category") && <TableHead>Category</TableHead>}
              {isVisible("subCategory") && <TableHead>Sub-Category</TableHead>}
              {isVisible("productCode") && <TableHead>Item Code</TableHead>}
              {isVisible("branch") && <TableHead>Branch</TableHead>}
              {isVisible("qty") && <TableHead className="text-right">Qty</TableHead>}
              {isVisible("price") && <TableHead className="text-right">Price</TableHead>}
              {isVisible("total") && <TableHead className="text-right">Total</TableHead>}
              {isVisible("status") && <TableHead>Status</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={13} className="h-24 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
            ) : filteredItems.length === 0 ? (
              <TableRow><TableCell colSpan={13} className="h-24 text-center text-muted-foreground">No order items found.</TableCell></TableRow>
            ) : (
              filteredItems.map((item: any, idx: number) => (
                <TableRow key={idx} className="hover:bg-indigo-50/30 dark:hover:bg-indigo-900/10 cursor-pointer transition-colors" onClick={() => handleRowClick(item)}>
                  {isVisible("orderDate") && <TableCell className="text-xs font-mono" suppressHydrationWarning>{new Date(item.orderDate).toLocaleDateString()}</TableCell>}
                  {isVisible("employeeId") && <TableCell className="text-xs font-mono text-muted-foreground">{item.employeeId || "-"}</TableCell>}
                  {isVisible("organization") && <TableCell className="text-xs text-muted-foreground">{item.organizationName || "-"}</TableCell>}
                  {isVisible("group") && <TableCell className="text-xs text-muted-foreground">{item.groupName || "-"}</TableCell>}
                  {isVisible("productName") && <TableCell className="text-xs font-medium">{item.productName}</TableCell>}
                  {isVisible("category") && <TableCell className="text-xs text-muted-foreground">{item.categoryName || "-"}</TableCell>}
                  {isVisible("subCategory") && <TableCell className="text-xs text-muted-foreground">{item.subCategoryName || "-"}</TableCell>}
                  {isVisible("productCode") && <TableCell className="text-xs font-mono text-muted-foreground">{item.productCode || "-"}</TableCell>}
                  {isVisible("branch") && <TableCell className="text-xs text-muted-foreground">{item.branchName}</TableCell>}
                  {isVisible("qty") && <TableCell className="text-right text-xs font-bold">{item.quantity.toLocaleString()}</TableCell>}
                  {isVisible("price") && <TableCell className="text-right text-xs">{formatPKR(item.priceCents / 100)}</TableCell>}
                  {isVisible("total") && <TableCell className="text-right text-xs font-bold text-blue-600">{formatPKR(item.totalAmount / 100)}</TableCell>}
                  {isVisible("status") && <TableCell className="text-xs"><Badge variant="outline" className="text-[10px]">{item.orderStatus}</Badge></TableCell>}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <div className="text-xs text-muted-foreground text-center">Report Generated: {generatedDate}</div>

      <ExpandableRowDrawer
        open={drawerOpen} onClose={() => setDrawerOpen(false)}
        title={selectedRow?.productName || "Product Details"}
        subtitle={selectedRow ? `${selectedRow.branchName} • ${selectedRow.productCode || "N/A"}` : ""}
        fields={selectedRow ? getDrawerFields(selectedRow).filter(f => !f.key || isVisible(f.key)) : []}
      />
    </div>
  )
}
