"use client"

import { useState, useEffect } from "react"
import useSWR from "swr"
import { useAppContext } from "@/components/context/app-context"
import { SectionHeader } from "@/components/ui/section-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Search, Download, RefreshCw, Loader2, Building, Building2, Calendar, AlertCircle, MapPin } from "lucide-react"
import { formatPKR } from "@/lib/utils"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import { Badge } from "@/components/ui/badge"
import { Role } from "@/lib/rbac"
import { useSession } from "next-auth/react"

import { ReportFilters } from "@/components/reports/report-filters"

import { fetcher } from "@/lib/fetcher"

export default function RefundOrdersReportPage() {
  const { organizationId, branchId } = useAppContext()
  const [searchTerm, setSearchTerm] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [selectedBranchId, setSelectedBranchId] = useState("")
  const [generatedDate, setGeneratedDate] = useState("")

  const { data: session } = useSession()
  const role = (session?.user as any)?.role as Role
  const [hasMounted, setHasMounted] = useState(false)

  const queryParams = new URLSearchParams()
  // Preference order: Selected filter > App context
  const targetBranchId = selectedBranchId || branchId
  if (targetBranchId) queryParams.set("branchId", String(targetBranchId))
  if (organizationId) queryParams.set("organizationId", String(organizationId))
  if (startDate) queryParams.set("startDate", startDate)
  if (endDate) queryParams.set("endDate", endDate)

  const { data, isLoading, mutate } = useSWR(`/api/v1/analytics/refunds?${queryParams.toString()}`, fetcher)

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

  const filteredRefunds = refundsData.filter((r: any) =>
    r.tid?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.branchName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.reason?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const totalRefunded = filteredRefunds.reduce((sum: number, r: any) => sum + (r.refundAmount || 0), 0)

  const handleExportPDF = () => {
    const doc = new jsPDF({ orientation: "landscape" })

    doc.setFontSize(20)
    doc.text("Refund Order Report", 14, 20)
    doc.setFontSize(10)
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28)

    const tableHead = ["Refund Date", "Transaction ID"]
    if (role === "SUPER_ADMIN") tableHead.push("Organization")
    tableHead.push("Branch", "Refund Type", "Previous Status", "Order Total", "Refund Amount", "Reason")

    const tableData = filteredRefunds.map((r: any) => {
      const row = [
        new Date(r.refundedAt || r.createdAt).toLocaleDateString(),
        r.tid,
      ]
      if (role === "SUPER_ADMIN") row.push(r.organizationName || `Org #${r.organizationId}`)
      row.push(
        r.branchName,
        r.refundType || "N/A",
        r.statusAtRefund || r.status,
        formatPKR(r.orderTotal / 100),
        formatPKR(r.refundAmount / 100),
        r.reason || "N/A"
      )
      return row
    })

    autoTable(doc, {
      startY: 40,
      head: [tableHead],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [153, 0, 0] }
    })

    doc.save("refund-order-report.pdf")
  }

  return (
    <div className="space-y-6">
      <SectionHeader title="Refund Order Report" subtitle="Analyze refund trends and transaction reversals." />

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
        branchId={selectedBranchId}
        setBranchId={setSelectedBranchId}
        onRefresh={() => mutate()}
        isLoading={isLoading}
        role={role}
        organizationId={organizationId || undefined}
        showGroupFilter={false}
        showBranchFilter={true}
        searchPlaceholder="Search TID, Branch, or Reason..."
        onExport={handleExportPDF}
      />

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Refund Date</TableHead>
              <TableHead>Transaction ID</TableHead>
              {role === "SUPER_ADMIN" && <TableHead>Organization</TableHead>}
              <TableHead>Branch</TableHead>
              <TableHead>Refund Type</TableHead>
              <TableHead>Previous Status</TableHead>
              <TableHead className="text-right">Order Total</TableHead>
              <TableHead className="text-right">Refund Amount</TableHead>
              <TableHead>Reason</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={role === "SUPER_ADMIN" ? 8 : 7} className="h-24 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
            ) : filteredRefunds.length === 0 ? (
              <TableRow><TableCell colSpan={role === "SUPER_ADMIN" ? 8 : 7} className="h-24 text-center text-muted-foreground">No refunds found.</TableCell></TableRow>
            ) : (
              filteredRefunds.map((refund: any) => (
                <TableRow key={refund.id}>
                  <TableCell className="text-xs" suppressHydrationWarning>{refund.refundedAt ? new Date(refund.refundedAt).toLocaleDateString() : new Date(refund.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell className="text-xs font-medium">{refund.tid}</TableCell>
                  {role === "SUPER_ADMIN" && (
                    <TableCell className="text-xs font-medium">
                      {refund.organizationName || `Org #${refund.organizationId}`}
                    </TableCell>
                  )}
                  <TableCell className="text-xs text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {refund.branchName}
                  </TableCell>
                  <TableCell>
                    <Badge variant={refund.refundType === 'FULL' ? 'destructive' : 'outline'} className="text-[10px]">
                      {refund.refundType || 'PARTIAL'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-[10px]">
                      {refund.statusAtRefund || refund.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-xs">{formatPKR(refund.orderTotal / 100)}</TableCell>
                  <TableCell className="text-right text-xs font-bold text-red-600">{formatPKR(refund.refundAmount / 100)}</TableCell>
                  <TableCell className="text-xs max-w-[200px] truncate">{refund.reason || "-"}</TableCell>
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
