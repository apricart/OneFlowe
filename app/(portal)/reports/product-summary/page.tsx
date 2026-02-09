"use client"

import { useState, useEffect } from "react"
import useSWR from "swr"
import { useAppContext } from "@/components/context/app-context"
import { SectionHeader } from "@/components/ui/section-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Search, Download, RefreshCw, Loader2, Building, Building2, Calendar, Package } from "lucide-react"
import { formatPKR } from "@/lib/utils"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import { Badge } from "@/components/ui/badge"
import { Role } from "@/lib/rbac"
import { useSession } from "next-auth/react"

import { ReportFilters } from "@/components/reports/report-filters"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export default function ProductSummaryReportPage() {
  const { organizationId, branchId } = useAppContext()
  const [searchTerm, setSearchTerm] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [groupId, setGroupId] = useState("")
  const [generatedDate, setGeneratedDate] = useState("")

  const { data: session } = useSession()
  const role = (session?.user as any)?.role as Role
  const [hasMounted, setHasMounted] = useState(false)

  const queryParams = new URLSearchParams()
  if (branchId) queryParams.set("branchId", branchId)
  if (organizationId) queryParams.set("organizationId", organizationId)
  if (startDate) queryParams.set("startDate", startDate)
  if (endDate) queryParams.set("endDate", endDate)
  if (groupId) queryParams.set("groupId", groupId)

  const { data, isLoading, mutate } = useSWR(`/api/v1/analytics/products/summary?${queryParams.toString()}`, fetcher)

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

  const orderItems = data?.items || []

  const filteredItems = orderItems.filter((item: any) =>
    item.productName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.productCode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.branchName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.userEmail?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const totalRevenue = filteredItems.reduce((sum: number, item: any) => sum + (item.totalAmount || 0), 0)
  const totalVolume = filteredItems.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0)

  const handleExportPDF = () => {
    const doc = new jsPDF({ orientation: "landscape" })

    doc.setFontSize(20)
    doc.text("Summary Report", 14, 20)
    doc.setFontSize(10)
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28)

    let filterText = ""
    if (organizationId) filterText += `Org ID: ${organizationId} `
    if (branchId) filterText += `Branch ID: ${branchId} `
    if (startDate || endDate) filterText += `Range: ${startDate || 'Start'} to ${endDate || 'End'}`
    if (filterText) doc.text(filterText, 14, 33)

    const tableData = filteredItems.map((item: any) => [
      new Date(item.orderDate).toLocaleDateString(),
      item.employeeId || "N/A",
      item.groupName || "null",
      item.productName,
      item.categoryName || "-",
      item.subCategoryName || "-",
      item.productCode || "N/A",
      item.branchName,
      item.quantity,
      formatPKR(item.priceCents / 100),
      formatPKR(item.totalAmount / 100),
      item.orderStatus
    ])

    autoTable(doc, {
      startY: 40,
      head: [["Order Date", "Employee ID", "Group", "Item Name", "Category", "Sub-Category", "Item Code", "Branch", "Qty", "Price", "Total", "Status"]],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [0, 102, 204], fontSize: 7 },
      styles: { fontSize: 7 }
    })

    doc.save("summary-report.pdf")
  }

  return (
    <div className="space-y-6">
      <SectionHeader title="Summary Report" subtitle={`Report generated on ${new Date().toLocaleDateString()}`} />

      {(organizationId || branchId || startDate || endDate) && (
        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground bg-muted/30 p-2 rounded-md border border-dashed">
          <span className="font-medium">Active Filters:</span>
          {organizationId && <span className="flex items-center gap-1"><Building className="h-3 w-3" /> Org ID: {organizationId}</span>}
          {branchId && <span className="flex items-center gap-1"><Building2 className="h-3 w-3" /> Branch ID: {branchId}</span>}
          {(startDate || endDate) && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {startDate || "..."} — {endDate || "..."}</span>}
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
        onRefresh={() => mutate()}
        isLoading={isLoading}
        role={role}
        organizationId={organizationId || undefined}
        searchPlaceholder="Search Product, SKU, Branch, or User..."
        onExport={handleExportPDF}
      />

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order Date</TableHead>
              <TableHead>Employee ID</TableHead>
              <TableHead>Group</TableHead>
              <TableHead>Item Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Sub-Category</TableHead>
              <TableHead>Item Code</TableHead>
              <TableHead>Branch</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={12} className="h-24 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
            ) : filteredItems.length === 0 ? (
              <TableRow><TableCell colSpan={12} className="h-24 text-center text-muted-foreground">No order items found.</TableCell></TableRow>
            ) : (
              filteredItems.map((item: any, idx: number) => (
                <TableRow key={idx}>
                  <TableCell className="text-xs font-mono" suppressHydrationWarning>{new Date(item.orderDate).toLocaleDateString()}</TableCell>
                  <TableCell className="text-xs font-mono text-muted-foreground">{item.employeeId || "-"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{item.groupName || "null"}</TableCell>
                  <TableCell className="text-xs font-medium">{item.productName}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{item.categoryName || "-"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{item.subCategoryName || "-"}</TableCell>
                  <TableCell className="text-xs font-mono text-muted-foreground">{item.productCode || "-"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{item.branchName}</TableCell>
                  <TableCell className="text-right text-xs font-bold">{item.quantity.toLocaleString()}</TableCell>
                  <TableCell className="text-right text-xs">{formatPKR(item.priceCents / 100)}</TableCell>
                  <TableCell className="text-right text-xs font-bold text-blue-600">{formatPKR(item.totalAmount / 100)}</TableCell>
                  <TableCell className="text-xs"><Badge variant="outline" className="text-[10px]">{item.orderStatus}</Badge></TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <div className="text-xs text-muted-foreground text-center">Report Generated: {generatedDate}</div>
    </div>
  )
}
