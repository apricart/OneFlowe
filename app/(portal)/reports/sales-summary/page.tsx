"use client"

import { useState, useEffect } from "react"
import useSWR from "swr"
import { useAppContext } from "@/components/context/app-context"
import { SectionHeader } from "@/components/ui/section-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Search, Download, RefreshCw, Loader2, Building, Building2, Calendar } from "lucide-react"
import { formatPKR } from "@/lib/utils"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import { Badge } from "@/components/ui/badge"
import { GroupFilter } from "@/components/reports/group-filter"
import { Role } from "@/lib/rbac"
import { useSession } from "next-auth/react"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export default function SalesSummaryReportPage() {
  const { organizationId, branchId } = useAppContext()
  const [searchTerm, setSearchTerm] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [groupId, setGroupId] = useState("")
  const [generatedDate, setGeneratedDate] = useState("")

  const { data: session } = useSession()
  const role = (session?.user as any)?.role as Role
  const [hasMounted, setHasMounted] = useState(false)

  // Build query string based on GLOBAL context (AppContext) and LOCAL date filters
  const queryParams = new URLSearchParams()
  if (branchId) {
    queryParams.set("branchId", branchId)
  }
  if (organizationId) {
    queryParams.set("organizationId", organizationId)
  }
  if (startDate) {
    queryParams.set("startDate", startDate)
  }
  if (endDate) {
    queryParams.set("endDate", endDate)
  }
  if (groupId) {
    queryParams.set("groupId", groupId)
  }

  // All hooks must be called before any conditional returns
  const { data, isLoading, mutate } = useSWR(`/api/v1/analytics/summary?${queryParams.toString()}`, fetcher)

  // Set date on mount to avoid hydration mismatch
  useEffect(() => {
    setHasMounted(true)
    setGeneratedDate(new Date().toLocaleString())
  }, [])

  // Now safe to return early after all hooks are called
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

    // Header
    doc.setFontSize(20)
    doc.text("Sales Summary Report", 14, 20)
    doc.setFontSize(10)
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28)

    // Add Context Info to PDF
    let filterText = ""
    if (organizationId) filterText += `Org ID: ${organizationId} `
    if (branchId) filterText += `Branch ID: ${branchId} `
    if (startDate || endDate) {
      filterText += `Range: ${startDate || 'Start'} to ${endDate || 'End'}`
    }
    if (filterText) doc.text(filterText, 14, 33)

    // Summary Section
    doc.setFillColor(240, 240, 240)
    doc.rect(14, 40, 180, 25, 'F')
    doc.setFontSize(12)
    doc.text(`Total Sales: ${formatPKR(summary.totalSales / 100)}`, 20, 50)
    doc.text(`Total Tax: ${formatPKR(summary.totalTax / 100)}`, 100, 50)
    doc.text(`Total Orders: ${summary.orderCount}`, 20, 60)

    // Table
    const tableData = filteredOrders.map((order: any) => [
      new Date(order.createdAt).toLocaleDateString(),
      order.tid,
      order.branchName || `ID: ${order.branchId}`,
      order.status,
      formatPKR((order.totalCents || 0) / 100)
    ])

    autoTable(doc, {
      startY: 75,
      head: [["Date", "Transaction ID", "Branch", "Status", "Amount"]],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [66, 66, 66] }
    })

    doc.save("sales-summary-report.pdf")
  }

  return (
    <div className="space-y-6">
      <SectionHeader title="Product Sales Summary" subtitle="Comprehensive view of sales, taxes, and order volume." />

      {/* Context Indicator */}
      {(organizationId || branchId || startDate || endDate) && (
        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground bg-muted/30 p-2 rounded-md border border-dashed">
          <span className="font-medium">Active Filters:</span>
          {organizationId && (
            <span className="flex items-center gap-1">
              <Building className="h-3 w-3" /> Org ID: {organizationId}
            </span>
          )}
          {branchId && (
            <span className="flex items-center gap-1">
              <Building2 className="h-3 w-3" /> Branch ID: {branchId}
            </span>
          )}
          {(startDate || endDate) && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" /> {startDate || "..."} — {endDate || "..."}
            </span>
          )}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <span className="text-muted-foreground">💰</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoading ? "..." : formatPKR((summary.totalSales || 0) / 100)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tax</CardTitle>
            <span className="text-muted-foreground">🏦</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoading ? "..." : formatPKR((summary.totalTax || 0) / 100)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Orders</CardTitle>
            <span className="text-muted-foreground">📦</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoading ? "..." : summary.orderCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Order Value</CardTitle>
            <span className="text-muted-foreground">📊</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? "..." : formatPKR((summary.orderCount > 0 ? (summary.totalSales / summary.orderCount) : 0) / 100)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="p-4">
        <div className="flex flex-col md:flex-row items-start md:items-center gap-3">

          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-[150px]">
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full text-xs"
                placeholder="Start Date"
                suppressHydrationWarning
              />
            </div>
            <span className="text-muted-foreground text-xs">to</span>
            <div className="relative flex-1 md:w-[150px]">
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full text-xs"
                placeholder="End Date"
                suppressHydrationWarning
              />
            </div>
          </div>

          <div className="relative w-full md:w-auto flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search Transaction ID or Branch..."
              className="pl-9 w-full md:max-w-[300px]"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              suppressHydrationWarning
            />
          </div>

          {(role === "SUPER_ADMIN" || role === "HEAD_OFFICE") && (
            <GroupFilter
              onGroupChange={setGroupId}
              organizationId={organizationId || undefined}
            />
          )}

          <div className="flex-1 hidden md:block" />

          <div className="flex gap-2 w-full md:w-auto">
            <Button variant="outline" onClick={() => mutate()} className="flex-1 md:flex-none">
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>

            <Button className="gap-2 flex-1 md:flex-none" onClick={handleExportPDF} disabled={isLoading || filteredOrders.length === 0}>
              <Download className="h-4 w-4" />
              PDF
            </Button>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Transaction ID</TableHead>
              <TableHead>Branch</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : filteredOrders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  No orders found for the selected criteria.
                </TableCell>
              </TableRow>
            ) : (
              filteredOrders.map((order: any) => (
                <TableRow key={order.id}>
                  <TableCell className="font-mono text-xs" suppressHydrationWarning>{new Date(order.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell className="font-mono text-xs font-medium">{order.tid}</TableCell>
                  <TableCell className="text-xs text-muted-foreground font-medium">
                    {order.branchName || `ID: ${order.branchId}`}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px]">{order.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {formatPKR((order.totalCents || 0) / 100)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <div className="text-xs text-muted-foreground text-center">
        Report Generated: {generatedDate}
      </div>
    </div>
  )
}
