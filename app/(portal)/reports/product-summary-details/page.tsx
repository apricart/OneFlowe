"use client"

import { useState, useEffect } from "react"
import useSWR from "swr"
import { useAppContext } from "@/components/context/app-context"
import { SectionHeader } from "@/components/ui/section-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Search, Download, Upload, RefreshCw, Loader2, Building, Building2, Calendar, User } from "lucide-react"
import { formatPKR } from "@/lib/utils"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import * as XLSX from "xlsx"
import { Badge } from "@/components/ui/badge"
import { Role } from "@/lib/rbac"
import { useSession } from "next-auth/react"

import { ReportFilters } from "@/components/reports/report-filters"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export default function ProductSummaryDetailsReportPage() {
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
  if (organizationId) queryParams.set("organizationId", organizationId.toString())
  if (startDate) queryParams.set("startDate", startDate)
  if (endDate) queryParams.set("endDate", endDate)
  if (groupId) queryParams.set("groupId", groupId)

  const { data, isLoading, mutate } = useSWR(`/api/v1/analytics/products/details?${queryParams.toString()}`, fetcher)

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

  const detailsData = data?.items || []

  const filteredDetails = detailsData.filter((d: any) =>
    d.productName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.productCode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.tid?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.createdByName?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const totalRevenue = filteredDetails.reduce((sum: number, d: any) => sum + (d.priceCents * d.quantity || 0), 0)
  const totalItems = filteredDetails.reduce((sum: number, d: any) => sum + (d.quantity || 0), 0)

  const handleExport = (format: 'csv' | 'excel' | 'pdf') => {
    const headers = ["Date", "Product", "SKU", "Transaction ID", "Organization", "Group", "Branch", "Processed By", "Qty", "Total (PKR)"]

    const rows = filteredDetails.map((d: any) => [
      new Date(d.orderDate).toLocaleDateString(),
      d.productName,
      d.productCode || "-",
      d.tid,
      d.organizationName || "-",
      d.groupName || "-",
      d.branchName,
      d.createdByName || d.createdByEmail,
      d.quantity,
      ((d.priceCents * d.quantity) / 100).toFixed(2)
    ])

    if (format === 'pdf') {
      const doc = new jsPDF({ orientation: "landscape" })
      doc.setFontSize(20)
      doc.text("Product Summary Details Report", 14, 20)
      doc.setFontSize(10)
      doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28)

      autoTable(doc, {
        startY: 40,
        head: [headers],
        body: rows,
        theme: 'grid',
        headStyles: { fillColor: [66, 66, 66], fontSize: 8 },
        styles: { fontSize: 8 }
      })
      doc.save(`product-details-${new Date().getTime()}.pdf`)
      return
    }

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows])
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Product Details")

    if (format === 'excel') {
      XLSX.writeFile(workbook, `product-details-${new Date().getTime()}.xlsx`)
    } else {
      XLSX.writeFile(workbook, `product-details-${new Date().getTime()}.csv`)
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeader title="Product Summary Details" subtitle="Granular audit of every product transaction across locations." />

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
        searchPlaceholder="Search Product, TID, or User..."
        onExport={handleExport}
      />

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Trans ID</TableHead>
              <TableHead>Organization</TableHead>
              <TableHead>Group</TableHead>
              <TableHead>Branch</TableHead>
              <TableHead>Processed By</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={9} className="h-24 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
            ) : filteredDetails.length === 0 ? (
              <TableRow><TableCell colSpan={9} className="h-24 text-center text-muted-foreground">No transaction details found.</TableCell></TableRow>
            ) : (
              filteredDetails.map((item: any) => (
                <TableRow key={item.id}>
                  <TableCell className="text-[10px] font-mono whitespace-nowrap" suppressHydrationWarning>{new Date(item.orderDate).toLocaleDateString()}</TableCell>
                  <TableCell className="text-xs font-medium max-w-[150px] truncate">{item.productName}</TableCell>
                  <TableCell className="text-[10px] font-mono text-muted-foreground">{item.productCode || "-"}</TableCell>
                  <TableCell className="text-[10px] font-mono font-medium">{item.tid}</TableCell>
                  <TableCell className="text-[10px] text-muted-foreground">{item.organizationName || "-"}</TableCell>
                  <TableCell className="text-[10px] text-muted-foreground">{item.groupName || "-"}</TableCell>
                  <TableCell className="text-[10px] text-muted-foreground">{item.branchName}</TableCell>
                  <TableCell className="text-[10px] font-medium">
                    <div className="flex items-center gap-1">
                      <User className="h-3 w-3 opacity-50" />
                      {item.createdByName || item.createdByEmail}
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-xs font-bold">{item.quantity.toLocaleString()}</TableCell>
                  <TableCell className="text-right text-xs font-bold text-indigo-600">{formatPKR((item.priceCents * item.quantity) / 100)}</TableCell>
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
