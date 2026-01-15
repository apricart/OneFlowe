"use client"

import { useState } from "react"
import useSWR from "swr"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { formatDistanceToNow } from "date-fns"
import { RefreshCw, Search, Filter } from "lucide-react"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export function AuditLogViewer() {
  const [page, setPage] = useState(1)
  const [actionFilter, setActionFilter] = useState("all")
  const [resourceFilter, setResourceFilter] = useState("all")

  // Construct URL query
  const query = new URLSearchParams()
  query.set("page", page.toString())
  query.set("limit", "50")
  if (actionFilter !== "all") query.set("action", actionFilter)
  if (resourceFilter !== "all") query.set("resourceType", resourceFilter)

  const { data, error, mutate, isLoading } = useSWR(`/api/v1/audit-logs?${query.toString()}`, fetcher)

  const logs = data?.items || []

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div className="flex gap-2 items-center w-full sm:w-auto">
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by Action" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Actions</SelectItem>
              <SelectItem value="ORDER_CREATE">Order Create</SelectItem>
              <SelectItem value="ORDER_APPROVE">Order Approve</SelectItem>
              <SelectItem value="ORDER_REJECT">Order Reject</SelectItem>
              <SelectItem value="ORDER_FULFILL">Order Fulfill</SelectItem>
              <SelectItem value="USER_CREATE">User Create</SelectItem>
              <SelectItem value="USER_UPDATE">User Update</SelectItem>
              <SelectItem value="USER_DELETE">User Delete</SelectItem>
            </SelectContent>
          </Select>

          <Select value={resourceFilter} onValueChange={setResourceFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by Resource" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Resources</SelectItem>
              <SelectItem value="order">Order</SelectItem>
              <SelectItem value="user">User</SelectItem>
              <SelectItem value="inventory">Inventory</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" size="icon" onClick={() => mutate()}>
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Resource</TableHead>
                <TableHead>Details</TableHead>
                <TableHead>IP Address</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    No logs found.
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log: any) => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                      <div className="text-[10px] opacity-70">{new Date(log.createdAt).toLocaleString()}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium text-xs">{log.userId}</span>
                        <span className="text-[10px] text-muted-foreground">{log.userRole}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-xs">
                        {log.action}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold uppercase">{log.resourceType}</span>
                        <span className="text-[10px] text-muted-foreground font-mono">{log.resourceId}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="text-[10px] bg-slate-100 dark:bg-slate-800 p-1 rounded max-w-[200px] block truncate">
                        {JSON.stringify(log.details)}
                      </code>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {log.ipAddress}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <div className="flex justify-between items-center text-sm text-muted-foreground">
        <div>Showing recent logs</div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => p + 1)}
            disabled={logs.length < 50}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  )
}
