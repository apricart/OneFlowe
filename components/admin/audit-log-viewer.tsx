"use client"

import { useState, useEffect } from "react"
import useSWR from "swr"
import { useAppContext } from "@/components/context/app-context"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Download, RefreshCw, Search, Loader2, Building, Building2, Calendar } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"

const fetcher = (url: string) => fetch(url).then(res => res.json())

export function AuditLogViewer() {
  const { organizationId, branchId } = useAppContext()
  const [actionFilter, setActionFilter] = useState<string>("all")
  const [resourceTypeFilter, setResourceTypeFilter] = useState<string>("all")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [searchTerm, setSearchTerm] = useState("")

  // Build query parameters based on global context and local filters
  const queryParams = new URLSearchParams()
  if (organizationId) queryParams.append("organizationId", organizationId)
  if (branchId && branchId !== "all") queryParams.append("branchId", branchId)
  if (actionFilter !== "all") queryParams.append("action", actionFilter)
  if (resourceTypeFilter !== "all") queryParams.append("resourceType", resourceTypeFilter)
  if (startDate) queryParams.append("startDate", startDate)
  if (endDate) queryParams.append("endDate", endDate)

  const { data, error, isLoading, mutate } = useSWR(`/api/v1/audit-logs?${queryParams.toString()}`, fetcher)

  const handleExportPDF = () => {
    const doc = new jsPDF('l', 'mm', 'a4') // Landscape orientation

    doc.setFontSize(20)
    doc.text("Audit Logs Report", 14, 20)

    doc.setFontSize(10)
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28)

    // Context Info
    let filterText = ""
    if (organizationId) filterText += `Org: ${organizationId} `
    if (branchId) filterText += `Branch: ${branchId} `
    if (startDate || endDate) filterText += `Range: ${startDate || "..."} - ${endDate || "..."}`
    if (filterText) doc.text(filterText, 14, 33)

    const tableData = (data?.items || []).map((log: any) => [
      new Date(log.createdAt).toLocaleString(),
      log.userEmail || log.userId,
      log.action,
      log.resourceType,
      log.resourceId || "-",
      typeof log.details === 'object' ? JSON.stringify(log.details) : log.details || "-",
      log.ipAddress || "-"
    ])

    autoTable(doc, {
      startY: 40,
      head: [["Date", "User", "Action", "Resource", "ID", "Details", "IP"]],
      body: tableData,
      theme: 'grid',
      styles: { fontSize: 8 },
      headStyles: { fillColor: [41, 128, 185] }
    })

    doc.save(`audit-logs-${new Date().getTime()}.pdf`)
  }

  const logs = data?.items || []
  const filteredLogs = logs.filter((log: any) =>
    log.userId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.userEmail?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.action?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.resourceType?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    JSON.stringify(log.details).toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="space-y-4">
      {/* Context Indicator */}
      {(organizationId || branchId || startDate || endDate) && (
        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground bg-muted/30 p-2 rounded-md border border-dashed">
          <span className="font-medium">Active Filters:</span>
          {organizationId && (
            <span className="flex items-center gap-1">
              <Building className="h-3 w-3" /> Org ID: {organizationId}
            </span>
          )}
          {branchId && branchId !== "all" && (
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

      {/* Filter Bar */}
      <Card className="p-4">
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {/* Dates */}
            <div className="col-span-1 md:col-span-1">
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="text-xs" />
            </div>
            <div className="col-span-1 md:col-span-1">
              <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="text-xs" />
            </div>

            {/* Action Filter */}
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="text-xs">
                <SelectValue placeholder="Action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                <SelectItem value="LOGIN">LOGIN</SelectItem>
                <SelectItem value="CREATE">CREATE</SelectItem>
                <SelectItem value="UPDATE">UPDATE</SelectItem>
                <SelectItem value="DELETE">DELETE</SelectItem>
              </SelectContent>
            </Select>

            {/* Resource Filter */}
            <Select value={resourceTypeFilter} onValueChange={setResourceTypeFilter}>
              <SelectTrigger className="text-xs">
                <SelectValue placeholder="Resource" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Resources</SelectItem>
                <SelectItem value="ORDER">ORDER</SelectItem>
                <SelectItem value="USER">USER</SelectItem>
                <SelectItem value="BRANCH">BRANCH</SelectItem>
                <SelectItem value="BUDGET">BUDGET</SelectItem>
              </SelectContent>
            </Select>

            {/* Search */}
            <div className="relative col-span-1 md:col-span-2">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search logs..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-8 text-xs"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => mutate()} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button size="sm" onClick={handleExportPDF} disabled={logs.length === 0}>
              <Download className="h-4 w-4 mr-2" />
              Download PDF
            </Button>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden border-none shadow-none">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="w-[180px]">Timestamp</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Resource</TableHead>
              <TableHead>Details</TableHead>
              <TableHead className="text-right">IP Address</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : filteredLogs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                  No logs found for the selected criteria.
                </TableCell>
              </TableRow>
            ) : (
              filteredLogs.map((log: any) => (
                <TableRow key={log.id} className="hover:bg-muted/30 transition-colors">
                  <TableCell className="text-xs font-mono text-muted-foreground">
                    {new Date(log.createdAt).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{log.userEmail || "System"}</span>
                      <span className="text-[10px] text-muted-foreground uppercase">{log.userRole || "unknown"}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={log.action === 'DELETE' ? 'destructive' : log.action === 'CREATE' ? 'default' : 'outline'} className="text-[10px]">
                      {log.action}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-xs font-medium">{log.resourceType}</span>
                      <span className="text-[10px] text-muted-foreground">ID: {log.resourceId || "N/A"}</span>
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[400px]">
                    <div className="text-xs truncate" title={typeof log.details === 'object' ? JSON.stringify(log.details) : log.details}>
                      {typeof log.details === 'object' ? JSON.stringify(log.details) : log.details}
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-xs font-mono text-muted-foreground">
                    {log.ipAddress || "0.0.0.0"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
