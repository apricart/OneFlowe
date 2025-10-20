"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { 
  FileText,
  User,
  Calendar,
  Filter,
  Download,
  RefreshCw,
} from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import useSWR from "swr"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
// Date formatting helper
const formatDate = (dateString: string) => {
  try {
    const date = new Date(dateString)
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return 'N/A'
  }
}

const ACTION_COLORS: Record<string, string> = {
  CREATE: "bg-green-500",
  UPDATE: "bg-blue-500",
  DELETE: "bg-red-500",
  LOGIN: "bg-purple-500",
  LOGOUT: "bg-gray-500",
  APPROVE: "bg-emerald-500",
  REJECT: "bg-orange-500",
}

export function AuditLogViewer() {
  const [entityFilter, setEntityFilter] = useState<string>("all")
  const [actionFilter, setActionFilter] = useState<string>("all")
  const [limit, setLimit] = useState(50)

  const queryParams = new URLSearchParams()
  if (entityFilter && entityFilter !== "all") queryParams.set("entity", entityFilter)
  if (actionFilter && actionFilter !== "all") queryParams.set("action", actionFilter)
  queryParams.set("limit", limit.toString())

  const { data, isLoading, mutate } = useSWR(
    `/api/v1/audit-logs?${queryParams.toString()}`
  )

  const logs = data?.data || []

  const handleExport = () => {
    const csv = [
      ["Timestamp", "User", "Action", "Entity", "Entity ID", "Details"].join(","),
      ...logs.map((log: any) => [
        log.createdAt,
        log.userEmail || "System",
        log.action,
        log.entity,
        log.entityId || "",
        JSON.stringify(log.metadata || {}),
      ].join(",")),
    ].join("\n")

    const blob = new Blob([csv], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `audit-logs-${Date.now()}.csv`
    a.click()
  }

  const getActionColor = (action: string) => {
    for (const [key, color] of Object.entries(ACTION_COLORS)) {
      if (action.includes(key)) return color
    }
    return "bg-gray-500"
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 flex-wrap items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium mb-2 block">Entity Type</label>
              <Select value={entityFilter} onValueChange={setEntityFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All entities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All entities</SelectItem>
                  <SelectItem value="roles">Roles</SelectItem>
                  <SelectItem value="role_permissions">Role Permissions</SelectItem>
                  <SelectItem value="organization_settings">Organization Settings</SelectItem>
                  <SelectItem value="users">Users</SelectItem>
                  <SelectItem value="organizations">Organizations</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium mb-2 block">Action Type</label>
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All actions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All actions</SelectItem>
                  <SelectItem value="CREATE_PERMISSION">Create Permission</SelectItem>
                  <SelectItem value="UPDATE_ROLE_PERMISSIONS">Update Permissions</SelectItem>
                  <SelectItem value="DELETE_PERMISSION">Delete Permission</SelectItem>
                  <SelectItem value="CREATE_SETTING">Create Setting</SelectItem>
                  <SelectItem value="UPDATE_SETTING">Update Setting</SelectItem>
                  <SelectItem value="DELETE_SETTING">Delete Setting</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1 min-w-[150px]">
              <label className="text-sm font-medium mb-2 block">Limit</label>
              <Select value={limit.toString()} onValueChange={(v) => setLimit(parseInt(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="25">25 entries</SelectItem>
                  <SelectItem value="50">50 entries</SelectItem>
                  <SelectItem value="100">100 entries</SelectItem>
                  <SelectItem value="200">200 entries</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button variant="outline" onClick={() => mutate()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>

            <Button variant="outline" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Audit Logs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Audit Trail
          </CardTitle>
          <CardDescription>
            System activity log showing {logs.length} recent entries
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading audit logs...
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No audit logs found
            </div>
          ) : (
            <ScrollArea className="h-[600px] pr-4">
              <div className="space-y-3">
                {logs.map((log: any) => (
                  <div
                    key={log.id}
                    className="p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-start gap-4">
                      {/* Timeline indicator */}
                      <div className="flex flex-col items-center">
                        <div
                          className={`w-3 h-3 rounded-full ${getActionColor(
                            log.action
                          )}`}
                        />
                        <div className="w-0.5 h-full bg-border mt-2" />
                      </div>

                      {/* Content */}
                      <div className="flex-1 space-y-2">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge
                                variant="outline"
                                className={`${getActionColor(log.action)} text-white`}
                              >
                                {log.action}
                              </Badge>
                              <Badge variant="secondary">{log.entity}</Badge>
                              {log.entityId && (
                                <code className="text-xs bg-muted px-2 py-1 rounded">
                                  ID: {log.entityId}
                                </code>
                              )}
                            </div>
                            
                            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {log.userEmail || log.userFullName || "System"}
                              </div>
                              <div className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {log.createdAt ? formatDate(log.createdAt) : "N/A"}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Metadata */}
                        {log.metadata && Object.keys(log.metadata).length > 0 && (
                          <details className="group">
                            <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                              Show details
                            </summary>
                            <pre className="mt-2 text-xs bg-muted p-3 rounded overflow-auto">
                              {JSON.stringify(log.metadata, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

