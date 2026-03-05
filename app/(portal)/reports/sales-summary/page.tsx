"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import useSWR from "swr"
import { useAppContext } from "@/components/context/app-context"
import { SectionHeader } from "@/components/ui/section-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Search, Download, Upload, RefreshCw, Loader2, Building, Building2, Calendar, ShoppingBag, TrendingUp, Landmark, Calculator, Package } from "lucide-react"
import * as XLSX from "xlsx"
import { formatPKR } from "@/lib/utils"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import { Badge } from "@/components/ui/badge"
import { GroupFilter } from "@/components/reports/group-filter"
import { Role } from "@/lib/rbac"
import { useSession } from "next-auth/react"

import { ReportFilters } from "@/components/reports/report-filters"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

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

  const { data: session } = useSession()
  const role = (session?.user as any)?.role as Role
  const [hasMounted, setHasMounted] = useState(false)

  // Sync with global context
  const branchIds = contextBranchIds

  const handleBranchChange = useCallback((ids: string[]) => {
    setContextBranchIds(ids)
  }, [setContextBranchIds])

  // Build query string based on GLOBAL context (AppContext) and LOCAL filters
  const queryParams = new URLSearchParams()
  if (organizationId) queryParams.set("organizationId", organizationId.toString())
  if (startDate) queryParams.set("startDate", startDate)
  if (endDate) queryParams.set("endDate", endDate)
  if (groupId) queryParams.set("groupId", groupId)

  // Handle multiple branch IDs
  if (branchIds.length > 0) {
    queryParams.set("branchIds", branchIds.join(","))
  } else if (contextBranchId) {
    queryParams.set("branchId", contextBranchId)
  }

  queryParams.set("limit", "10000") // Fetch more records for the report

  const { data, isLoading, mutate } = useSWR(`/api/v1/analytics/summary?${queryParams.toString()}`, fetcher)

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

  const summary = data?.summary || { totalSales: 0, totalTax: 0, totalSubtotal: 0, orderCount: 0 }
  const orders = data?.orders || []

  const filteredOrders = orders.filter((order: any) =>
    order.tid?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.status?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (order.branchName && order.branchName.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  const handleExportPDF = () => {
    const doc = new jsPDF()
    doc.setFontSize(20)
    const reportTitle = role === "HEAD_OFFICE" ? "Purchase Summary Report" : "Sales Summary Report"
    doc.text(reportTitle, 14, 20)
    doc.setFontSize(10)
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28)

    let filterText = ""
    if (organizationId) filterText += `Org ID: ${organizationId} `
    if (branchIds.length > 0) filterText += `Branch IDs: ${branchIds.join(', ')} `
    else if (contextBranchId) filterText += `Branch ID: ${contextBranchId} `
    if (startDate || endDate) filterText += `Range: ${startDate || 'Start'} to ${endDate || 'End'}`
    if (filterText) doc.text(filterText, 14, 33)

    doc.setFillColor(240, 240, 240)
    doc.rect(14, 40, 180, 25, 'F')
    doc.setFontSize(12)
    doc.text(`Total Sales: ${formatPKR(summary.totalSales / 100)}`, 20, 50)
    doc.text(`Total Tax: ${formatPKR(summary.totalTax / 100)}`, 100, 50)
    doc.text(`Total Orders: ${summary.orderCount}`, 20, 60)

    const tableData = filteredOrders.map((order: any) => [
      new Date(order.createdAt).toLocaleDateString(),
      order.tid,
      order.organizationName || '-',
      order.groupName || '-',
      order.branchName || `ID: ${order.branchId}`,
      order.status,
      formatPKR((order.totalCents || 0) / 100)
    ])

    autoTable(doc, {
      startY: 75,
      head: [["Date", "Transaction ID", "Organization", "Group", "Branch", "Status", "Amount"]],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [66, 66, 66] }
    })

    const fileName = role === "HEAD_OFFICE" ? "purchase-summary-report" : "sales-summary-report"
    doc.save(`${fileName}.pdf`)
  }

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

      autoTable(doc, {
        startY: 40,
        head: [headers],
        body: rows,
        theme: 'grid',
        headStyles: { fillColor: [66, 66, 66] }
      })
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

  return (
    <div className="space-y-6 pb-12">
      <SectionHeader
        title={role === "HEAD_OFFICE" ? "Product Purchase Summary" : "Product Sales Summary"}
        subtitle={role === "HEAD_OFFICE" ? "Comprehensive view of purchase, taxes, and order volume." : "Comprehensive view of sales, taxes, and order volume."}
      />

      {/* Context Indicator */}
      {(organizationId || branchIds.length > 0 || contextBranchId || startDate || endDate) && (
        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
          <span className="font-semibold uppercase tracking-wider text-[10px] text-slate-400">Active Filters:</span>
          {organizationId && (
            <Badge variant="outline" className="gap-1 bg-white dark:bg-slate-950 font-medium">
              <Building className="h-3 w-3 text-blue-500" /> Org: {organizationId}
            </Badge>
          )}
          {branchIds.length > 0 ? (
            <Badge variant="outline" className="gap-1 bg-white dark:bg-slate-950 font-medium border-blue-200 text-blue-700">
              <Building2 className="h-3 w-3 text-indigo-500" /> {branchIds.length} Branches Selected
            </Badge>
          ) : contextBranchId && (
            <Badge variant="outline" className="gap-1 bg-white dark:bg-slate-950 font-medium">
              <Building2 className="h-3 w-3 text-indigo-500" /> Branch: {contextBranchId}
            </Badge>
          )}
          {(startDate || endDate) && (
            <Badge variant="outline" className="gap-1 bg-white dark:bg-slate-950 font-medium">
              <Calendar className="h-3 w-3 text-emerald-500" /> {startDate || "..."} — {endDate || "..."}
            </Badge>
          )}
        </div>
      )}

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
        onRefresh={() => mutate()}
        onExport={handleExport}
        isLoading={isLoading}
        role={role}
        organizationId={organizationId || undefined}
        searchPlaceholder="Filter by ID or Branch..."
        showBranchFilter={true}
      />

      {/* Unified Branch Metrics (KPIs) - Shown when 1 branch is selected */}
      {(branchIds.length === 1 || (branchIds.length === 0 && contextBranchId)) && summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-none shadow-sm bg-white dark:bg-slate-900 border-l-4 border-l-blue-500 hover:shadow-md transition-shadow">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
                <ShoppingBag className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Total Orders</p>
                <h4 className="text-xl font-semibold text-slate-900 dark:text-white">{summary.orderCount || 0}</h4>
              </div>
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm bg-white dark:bg-slate-900 border-l-4 border-l-emerald-500 hover:shadow-md transition-shadow">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Gross Revenue</p>
                <h4 className="text-xl font-semibold text-slate-900 dark:text-white">{formatPKR((summary.totalSales || 0) / 100)}</h4>
              </div>
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm bg-white dark:bg-slate-900 border-l-4 border-l-indigo-500 hover:shadow-md transition-shadow">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center">
                <Package className="h-5 w-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Items Sold</p>
                <h4 className="text-xl font-semibold text-slate-900 dark:text-white">
                  {summary.totalItemsSold || 0}
                </h4>
              </div>
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm bg-white dark:bg-slate-900 border-l-4 border-l-rose-500 hover:shadow-md transition-shadow">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-rose-50 dark:bg-rose-900/20 flex items-center justify-center">
                <Calculator className="h-5 w-5 text-rose-600" />
              </div>
              <div>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Avg. Order Value</p>
                <h4 className="text-xl font-semibold text-slate-900 dark:text-white">
                  {formatPKR(((summary.totalSales || 0) / (summary.orderCount || 1)) / 100)}
                </h4>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Top Performing Branches Section */}
      {data?.topPerformers && data.topPerformers.length > 0 && (
        <Card className="overflow-hidden border-none shadow-sm bg-white dark:bg-slate-900">
          <CardHeader className="pb-2 border-b border-slate-50 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 uppercase tracking-tight">
                <TrendingUp className="h-4 w-4 text-emerald-500" />
                Top Performing Branches
              </CardTitle>
              <Badge variant="secondary" className="text-[10px] font-semibold">BY SALES VOLUME</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 divide-x divide-slate-50 dark:divide-slate-800">
              {data.topPerformers.slice(0, 5).map((performer: any, index: number) => (
                <div key={performer.branchId} className="p-4 flex flex-col gap-1 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-semibold text-slate-400">RANK #{index + 1}</span>
                    <Badge variant="outline" className="text-[9px] h-4 px-1.5 border-slate-200">{performer.orderCount} Orders</Badge>
                  </div>
                  <h5 className="text-xs font-semibold text-slate-900 dark:text-white truncate">{performer.branchName || `Branch #${performer.branchId}`}</h5>
                  <p className="text-sm font-mono font-semibold text-indigo-600">{formatPKR(performer.sales / 100)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="overflow-hidden border-none shadow-sm bg-white dark:bg-slate-900 mb-8 pt-6">
        <div className="px-6 pb-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
          <h3 className="font-semibold text-slate-900 dark:text-white">Transaction Logs</h3>
          <Button variant="ghost" size="sm" onClick={() => handleExport('pdf')} className="text-xs font-semibold text-slate-500 hover:text-indigo-600">
            <Upload className="h-3.5 w-3.5 mr-2" />
            PDF VERSION
          </Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/50 dark:bg-slate-800/50">
              <TableHead className="pl-6">Date</TableHead>
              <TableHead>Transaction ID</TableHead>
              <TableHead>Organization</TableHead>
              <TableHead>Group</TableHead>
              <TableHead>Branch</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right pr-6">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : filteredOrders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No orders found for the selected criteria.
                </TableCell>
              </TableRow>
            ) : (
              filteredOrders.map((order: any) => (
                <TableRow key={order.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <TableCell className="font-mono text-xs pl-6" suppressHydrationWarning>
                    {new Date(order.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="font-mono text-xs font-medium">{order.tid}</TableCell>
                  <TableCell className="text-xs text-muted-foreground font-medium">
                    {order.organizationName || '-'}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground font-medium">
                    {order.groupName || '-'}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground font-medium">
                    {order.branchName || `ID: ${order.branchId}`}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px] uppercase font-semibold tracking-tighter">
                      {order.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs pr-6">
                    {formatPKR((order.totalCents || 0) / 100)}
                  </TableCell>
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
    </div>
  )
}
