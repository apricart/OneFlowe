"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import useSWR from "swr"
import { useAppContext } from "@/components/context/app-context"
import { SectionHeader } from "@/components/ui/section-header"
import { Card } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Loader2, ShoppingBag, TrendingUp, Clock, CheckCircle, Upload } from "lucide-react"
import { formatPKR, cn } from "@/lib/utils"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import * as XLSX from "xlsx"
import { Badge } from "@/components/ui/badge"
import { Role } from "@/lib/rbac"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"

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
    { key: "tid", label: "Transaction ID", defaultVisible: true },
    { key: "branch", label: "Branch", defaultVisible: true },
    { key: "total", label: "Amount", defaultVisible: true },
    { key: "organization", label: "Organization", defaultVisible: false },
    { key: "group", label: "Group", defaultVisible: false },
    { key: "status", label: "Status", defaultVisible: false },
]

type StatusFilter = "all" | "approved" | "fulfilled" | "pending"

export default function OrderReportPage() {
    const {
        organizationId,
        branchId: contextBranchId,
        branchIds: contextBranchIds,
        setBranchIds: setContextBranchIds
    } = useAppContext()
    const [searchTerm, setSearchTerm] = useState("")
    const [startDate, setStartDate] = useState("")
    const [endDate, setEndDate] = useState("")
    const [groupId, setGroupId] = useState("")
    const [generatedDate, setGeneratedDate] = useState("")
    const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
    const [selectedRow, setSelectedRow] = useState<any>(null)
    const [drawerOpen, setDrawerOpen] = useState(false)

    const { data: session } = useSession()
    const role = (session?.user as any)?.role as Role
    const [hasMounted, setHasMounted] = useState(false)

    const { visibleKeys, isVisible, setVisibleKeys } = useColumnSelector(ALL_COLUMNS, "order-report")

    const branchIds = contextBranchIds

    const handleBranchChange = useCallback((ids: string[]) => {
        setContextBranchIds(ids)
    }, [setContextBranchIds])

    const queryParams = new URLSearchParams()
    if (organizationId) queryParams.set("organizationId", organizationId.toString())
    if (startDate) queryParams.set("startDate", startDate)
    if (endDate) queryParams.set("endDate", endDate)
    if (groupId) queryParams.set("groupId", groupId)
    if (branchIds.length > 0) {
        queryParams.set("branchIds", branchIds.join(","))
    } else if (contextBranchId) {
        queryParams.set("branchId", contextBranchId)
    }
    queryParams.set("limit", "10000")

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

    const summary = data?.summary || { totalSales: 0, orderCount: 0 }
    const orders = data?.orders || []

    // Status filter
    const statusFiltered = statusFilter === "all"
        ? orders
        : orders.filter((o: any) => {
            const s = (o.status || "").toLowerCase()
            return s === statusFilter
        })

    const filteredOrders = statusFiltered.filter((order: any) =>
        order.tid?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.status?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (order.branchName && order.branchName.toLowerCase().includes(searchTerm.toLowerCase()))
    )

    const sparklineData = useMemo(() => {
        const daily: Record<string, number> = {}
        orders.forEach((o: any) => {
            const day = new Date(o.createdAt).toLocaleDateString()
            daily[day] = (daily[day] || 0) + (o.totalCents || 0) / 100
        })
        return Object.values(daily).slice(-14)
    }, [orders])

    const filterTags: FilterTag[] = []
    if (organizationId) filterTags.push({ key: "org", label: "Org", value: String(organizationId), color: "blue" })
    if (branchIds.length > 0) filterTags.push({ key: "branches", label: "Branches", value: `${branchIds.length} selected`, color: "indigo" })
    if (startDate || endDate) filterTags.push({ key: "dates", label: "Period", value: `${startDate || "..."} – ${endDate || "..."}`, color: "emerald" })

    const handleRemoveFilter = (key: string) => {
        if (key === "branches") setContextBranchIds([])
        if (key === "dates") { setStartDate(""); setEndDate("") }
        if (key === "group") setGroupId("")
    }

    const handleRowClick = (order: any) => {
        setSelectedRow(order)
        setDrawerOpen(true)
    }

    const getDrawerFields = (order: any): DetailField[] => [
        { label: "Transaction ID", value: order.tid, type: "mono" },
        { label: "Date", value: new Date(order.createdAt).toLocaleString(), type: "date" },
        { label: "Organization", value: order.organizationName || "-" },
        { label: "Group", value: order.groupName || "-" },
        { label: "Branch", value: order.branchName || `ID: ${order.branchId}` },
        { label: "Status", value: order.status, type: "badge" },
        { label: "Amount", value: formatPKR((order.totalCents || 0) / 100), type: "currency" },
    ]

    const statusTabs: { key: StatusFilter; label: string; count: number }[] = [
        { key: "all", label: "All Orders", count: orders.length },
        { key: "approved", label: "Approved", count: orders.filter((o: any) => o.status?.toLowerCase() === "approved").length },
        { key: "fulfilled", label: "Fulfilled", count: orders.filter((o: any) => o.status?.toLowerCase() === "fulfilled" || o.status?.toLowerCase() === "completed").length },
        { key: "pending", label: "Pending", count: orders.filter((o: any) => o.status?.toLowerCase() === "pending").length },
    ]

    const handleExport = (format: 'csv' | 'excel' | 'pdf') => {
        const headers = ["Date", "Transaction ID", "Organization", "Group", "Branch", "Status", "Amount (PKR)"]
        const rows = filteredOrders.map((order: any) => [
            new Date(order.createdAt).toLocaleDateString(), order.tid, order.organizationName || '-',
            order.groupName || '-', order.branchName || `ID: ${order.branchId}`,
            order.status?.toUpperCase(), (order.totalCents / 100).toFixed(2)
        ])

        if (format === 'pdf') {
            const doc = new jsPDF()
            doc.setFontSize(20); doc.text("Order Report", 14, 20)
            doc.setFontSize(10); doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28)
            autoTable(doc, { startY: 40, head: [headers], body: rows, theme: 'grid', headStyles: { fillColor: [66, 66, 66] } })
            doc.save(`order-report-${new Date().getTime()}.pdf`)
            return
        }

        const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows])
        const workbook = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(workbook, worksheet, "Orders")
        XLSX.writeFile(workbook, `order-report-${new Date().getTime()}.${format === 'excel' ? 'xlsx' : 'csv'}`)
    }

    return (
        <div className="space-y-5 pb-12">
            <SectionHeader title="Order Report" subtitle="Comprehensive view of all orders with advanced filtering and insights." />

            <QuickDateRange startDate={startDate} endDate={endDate} onStartDateChange={setStartDate} onEndDateChange={setEndDate} storageKey="order-report-dates" />

            <FilterTagBar tags={filterTags} onRemove={handleRemoveFilter} />

            <ReportFilters
                searchTerm={searchTerm} setSearchTerm={setSearchTerm}
                startDate={startDate} setStartDate={setStartDate}
                endDate={endDate} setEndDate={setEndDate}
                groupId={groupId} setGroupId={setGroupId}
                selectedBranchIds={branchIds} onBranchChange={handleBranchChange}
                onRefresh={() => mutate()} onExport={handleExport}
                isLoading={isLoading} role={role}
                organizationId={organizationId || undefined}
                searchPlaceholder="Search by TID, Branch, or Status..."
                showBranchFilter={true}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <KPICard title="Total Revenue" value={formatPKR((summary.totalSales || 0) / 100)} icon={TrendingUp} colorScheme="emerald" trendData={sparklineData} />
                <KPICard title="Order Count" value={summary.orderCount || 0} icon={ShoppingBag} colorScheme="blue" />
                <KPICard title="Avg. Order" value={formatPKR(((summary.totalSales || 0) / (summary.orderCount || 1)) / 100)} icon={CheckCircle} colorScheme="amber" />
                <KPICard title="Active Period" value={startDate && endDate ? `${startDate} – ${endDate}` : "All Time"} icon={Clock} colorScheme="violet" />
            </div>

            {/* Status Tabs */}
            <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/50 w-fit">
                {statusTabs.map((tab) => (
                    <button
                        key={tab.key}
                        onClick={() => setStatusFilter(tab.key)}
                        className={cn(
                            "px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200 flex items-center gap-2",
                            statusFilter === tab.key
                                ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm ring-1 ring-slate-200 dark:ring-slate-600"
                                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                        )}
                    >
                        {tab.label}
                        <span className={cn(
                            "text-[10px] px-1.5 py-0.5 rounded-md font-bold",
                            statusFilter === tab.key
                                ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400"
                                : "bg-slate-200/50 dark:bg-slate-700/50 text-slate-400"
                        )}>
                            {tab.count}
                        </span>
                    </button>
                ))}
            </div>

            <Card className="overflow-hidden border-none shadow-sm bg-white dark:bg-slate-900">
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex flex-wrap justify-between items-center gap-3">
                    <h3 className="font-bold text-slate-900 dark:text-white text-sm">Order Details</h3>
                    <div className="flex items-center gap-2">
                        <ColumnSelector columns={ALL_COLUMNS} storageKey="order-report" visibleKeys={visibleKeys} onChange={setVisibleKeys} />
                        <ScheduleReportModal reportName="Order Report" />
                    </div>
                </div>
                <Table>
                    <TableHeader>
                        <TableRow className="bg-slate-50/50 dark:bg-slate-800/50">
                            {isVisible("date") && <TableHead className="pl-6">Date</TableHead>}
                            {isVisible("tid") && <TableHead>Transaction ID</TableHead>}
                            {isVisible("organization") && <TableHead>Organization</TableHead>}
                            {isVisible("group") && <TableHead>Group</TableHead>}
                            {isVisible("branch") && <TableHead>Branch</TableHead>}
                            {isVisible("status") && <TableHead>Status</TableHead>}
                            {isVisible("total") && <TableHead className="text-right pr-6">Amount</TableHead>}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow><TableCell colSpan={7} className="h-24 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
                        ) : filteredOrders.length === 0 ? (
                            <TableRow><TableCell colSpan={7} className="h-24 text-center text-muted-foreground">No orders found.</TableCell></TableRow>
                        ) : (
                            filteredOrders.map((order: any) => (
                                <TableRow key={order.id} className="hover:bg-indigo-50/30 dark:hover:bg-indigo-900/10 cursor-pointer transition-colors" onClick={() => handleRowClick(order)}>
                                    {isVisible("date") && <TableCell className="font-mono text-xs pl-6" suppressHydrationWarning>{new Date(order.createdAt).toLocaleDateString()}</TableCell>}
                                    {isVisible("tid") && <TableCell className="font-mono text-xs font-medium">{order.tid}</TableCell>}
                                    {isVisible("organization") && <TableCell className="text-xs text-muted-foreground">{order.organizationName || '-'}</TableCell>}
                                    {isVisible("group") && <TableCell className="text-xs text-muted-foreground">{order.groupName || '-'}</TableCell>}
                                    {isVisible("branch") && <TableCell className="text-xs text-muted-foreground">{order.branchName || `ID: ${order.branchId}`}</TableCell>}
                                    {isVisible("status") && <TableCell><Badge variant="outline" className="text-[10px] uppercase font-bold">{order.status}</Badge></TableCell>}
                                    {isVisible("total") && <TableCell className="text-right font-mono text-xs pr-6">{formatPKR((order.totalCents || 0) / 100)}</TableCell>}
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
                <div className="p-4 border-t border-slate-100 dark:border-slate-800 text-center">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Report Generated: {generatedDate}</p>
                </div>
            </Card>

            <ExpandableRowDrawer
                open={drawerOpen} onClose={() => setDrawerOpen(false)}
                title={selectedRow?.tid || "Order Details"}
                subtitle={selectedRow ? `${selectedRow.branchName || 'Unknown'} • ${new Date(selectedRow.createdAt).toLocaleDateString()}` : ""}
                fields={selectedRow ? getDrawerFields(selectedRow) : []}
            />
        </div>
    )
}
