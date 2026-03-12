"use client"
import React, { useState, useMemo, useEffect, useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import useSWR from "swr"
import { useSession } from "next-auth/react"
import { useToast } from "@/hooks/use-toast"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import {
  Package,
  Search,
  Filter,
  CheckCircle,
  Clock,
  AlertTriangle,
  TrendingDown,
  ChevronDown,
  Calendar,
  User,
  MapPin,
  DollarSign,
  RefreshCw,
  Check,
  X,
  Eye,
  Receipt,
  XCircle,
  Activity,
} from "lucide-react"
import { formatPKR } from "@/lib/utils"
import { useAppContext } from "@/components/context/app-context"
import { OrderExport } from "@/components/orders/order-export"
import { ReceiptIconButton } from "@/components/receipts/receipt-icon-button"
import { GlobalDateFilter, type FilterPreset } from "@/components/dashboard/global-date-filter"
import { MultiBranchFilter } from "@/components/dashboard/multi-branch-filter"
import { startOfDay, endOfDay } from "date-fns"

type DateRange = {
  startDate: Date
  endDate: Date
}
const getDefaultDateRange = (): DateRange => ({
  startDate: startOfDay(new Date()),
  endDate: endOfDay(new Date()),
})

const fetcher = (url: string) => fetch(url).then(r => r.json())

interface OrderItem {
  id: number
  tid: string
  organizationId: number
  organizationName?: string | null
  branchId: number
  branchName?: string | null
  status: string
  statusAtRefund?: string | null
  refundedAt?: string | null
  refundAmountCents?: number | null
  subtotalCents: number
  taxCents: number
  totalCents: number
  createdAt: string
  createdByUserId: string
  hasRefundRequests?: number
  rejectionReason?: string | null
  itemNames?: string | null
}

export default function OrdersManagementPage() {
  const router = useRouter()
  const { data: session } = useSession()
  const { toast } = useToast()
  const {
    organizationId,
    branchId,
    branchIds,
    isInitialized,
    setBranchIds: setContextBranchIds
  } = useAppContext()
  const userRole = (session?.user as any)?.role
  const isBranchAdmin = userRole === "BRANCH_ADMIN"
  const isHeadOffice = userRole === "HEAD_OFFICE"
  const isSuperAdmin = userRole === "SUPER_ADMIN"

  const [searchQuery, setSearchQuery] = useState("")
  const [dateRange, setDateRange] = useState<DateRange | null>(getDefaultDateRange())
  const [activePreset, setActivePreset] = useState<FilterPreset>("today")
  // Sync with global context
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [refundFilter, setRefundFilter] = useState<string>("all")
  const [selectedOrder, setSelectedOrder] = useState<OrderItem | null>(null)
  const [showApprovalDialog, setShowApprovalDialog] = useState(false)
  const [showRejectDialog, setShowRejectDialog] = useState(false)
  const [rejectReason, setRejectReason] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)

  // Approval token state (shown once after approval)
  const [showTokenDialog, setShowTokenDialog] = useState(false)
  const [approvalToken, setApprovalToken] = useState<string | null>(null)

  // Fulfillment token state (Super Admin must enter to fulfill)
  const [showFulfillDialog, setShowFulfillDialog] = useState(false)
  const [fulfillToken, setFulfillToken] = useState("")

  // Error dialog state
  const [showErrorDialog, setShowErrorDialog] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")

  const handleBranchChange = useCallback((ids: string[]) => {
    setContextBranchIds(ids)
  }, [setContextBranchIds])

  const handleDateChange = useCallback((range: DateRange | null, preset: FilterPreset) => {
    setDateRange(range)
    setActivePreset(preset)
  }, [])

  // Build orders endpoint with context parameters
  const ordersEndpoint = useMemo(() => {
    if (!isInitialized) return null
    const params = new URLSearchParams()
    if (organizationId && organizationId !== "null" && organizationId !== "0") {
      params.set("organizationId", organizationId)
    }

    if (branchIds.length > 0) {
      params.set("branchIds", branchIds.join(","))
    } else if (branchId) {
      params.set("branchId", branchId)
    }

    if (dateRange) {
      params.set("startDate", dateRange.startDate.toISOString())
      params.set("endDate", dateRange.endDate.toISOString())
    }

    return `/api/v1/orders${params.toString() ? `?${params.toString()}` : ""}`
  }, [organizationId, branchId, branchIds, dateRange, isInitialized])

  // Fetch orders scoped by context
  const { data: ordersData, mutate: mutateOrders, isLoading } = useSWR<any>(
    ordersEndpoint,
    fetcher
  )

  const orders = ordersData?.items || []

  // Filter and search orders
  const filteredOrders = useMemo(() => {
    let filtered = orders

    if (statusFilter !== "all") {
      if (statusFilter === "refunded") {
        filtered = filtered.filter((o: OrderItem) =>
          o.status.toLowerCase() === "refunded" ||
          (o.refundAmountCents && o.refundAmountCents > 0)
        )
      } else if (statusFilter === "rejected") {
        filtered = filtered.filter((o: OrderItem) =>
          o.status.toLowerCase() === "rejected" || o.status.toLowerCase() === "cancelled"
        )
      } else {
        filtered = filtered.filter((o: OrderItem) => o.status.toLowerCase() === statusFilter)
      }
    }

    if (refundFilter !== "all") {
      if (refundFilter === "full") {
        filtered = filtered.filter((o: OrderItem) => o.status.toLowerCase() === "refunded")
      } else if (refundFilter === "partial") {
        filtered = filtered.filter((o: OrderItem) =>
          o.refundAmountCents && o.refundAmountCents > 0 && o.status.toLowerCase() !== "refunded"
        )
      }
    }

    if (searchQuery) {
      filtered = filtered.filter((o: OrderItem) =>
        o.tid.includes(searchQuery) ||
        o.id.toString().includes(searchQuery)
      )
    }

    return filtered.sort((a: OrderItem, b: OrderItem) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
  }, [orders, statusFilter, refundFilter, searchQuery])

  // Approve order
  const handleApproveOrder = async (orderId: number) => {
    setIsProcessing(true)
    try {
      const res = await fetch("/api/v1/orders", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: orderId,
          action: "approve"
        })
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Failed to approve order")
      }

      // Show approval token in modal (SECURITY: shown once, must be copied)
      if (data.approvalToken) {
        setApprovalToken(data.approvalToken)
        setShowTokenDialog(true)
      }

      toast({ title: "Success", description: "Order approved successfully" })
      mutateOrders()
      setShowApprovalDialog(false)
      setSelectedOrder(null)
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } finally {
      setIsProcessing(false)
    }
  }

  // Reject order
  const handleRejectOrder = async (orderId: number) => {
    if (!rejectReason.trim()) {
      toast({ title: "Error", description: "Please provide a rejection reason", variant: "destructive" })
      return
    }

    setIsProcessing(true)
    try {
      const res = await fetch("/api/v1/orders", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: orderId,
          action: "reject",
          rejectionReason: rejectReason
        })
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to reject order")
      }

      toast({ title: "Success", description: "Order rejected successfully" })
      mutateOrders()
      setShowRejectDialog(false)
      setSelectedOrder(null)
      setRejectReason("")
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } finally {
      setIsProcessing(false)
    }
  }

  // Fulfill order (requires approval token)
  const handleFulfillOrder = async (orderId: number) => {
    if (!fulfillToken.trim()) {
      setErrorMessage("Please enter the approval token to fulfill this order")
      setShowErrorDialog(true)
      return
    }

    setIsProcessing(true)
    try {
      const res = await fetch("/api/v1/orders", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: orderId,
          action: "fulfill",
          approvalToken: fulfillToken.trim().toUpperCase()
        })
      })

      const data = await res.json()

      if (!res.ok) {
        setErrorMessage(data.error || "Invalid approval token. Please verify the token and try again.")
        setShowErrorDialog(true)
        return
      }

      toast({
        title: "✅ Order Fulfilled",
        description: "The order has been successfully fulfilled",
        duration: 4000
      })
      mutateOrders()
      setSelectedOrder(null)
      setShowFulfillDialog(false)
      setFulfillToken("")
    } catch (error: any) {
      setErrorMessage(error.message || "Failed to fulfill order. Please try again.")
      setShowErrorDialog(true)
    } finally {
      setIsProcessing(false)
    }
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, { bg: string; text: string; icon: any }> = {
      pending: { bg: "bg-yellow-50 dark:bg-yellow-950", text: "text-yellow-700 dark:text-yellow-300", icon: Clock },
      approved: { bg: "bg-blue-50 dark:bg-slate-800", text: "text-blue-700 dark:text-slate-200", icon: CheckCircle },
      fulfilled: { bg: "bg-green-50 dark:bg-green-950", text: "text-green-700 dark:text-green-300", icon: CheckCircle },
      rejected: { bg: "bg-red-50 dark:bg-red-950", text: "text-red-700 dark:text-red-300", icon: AlertTriangle },
      refunded: { bg: "bg-slate-50 dark:bg-slate-950", text: "text-slate-700 dark:text-slate-300", icon: TrendingDown },
    }
    return colors[status?.toLowerCase()] || colors.pending
  }

  // Derive scope display from context + org/branch metadata
  // These hooks must be called before any conditional returns
  const { data: orgsData } = useSWR(organizationId ? "/api/v1/organizations" : null, fetcher)
  const { data: branchesData } = useSWR(
    organizationId ? `/api/v1/branches?organizationId=${organizationId}` : null,
    fetcher
  )
  const organizations = orgsData?.items || []
  const branches = branchesData?.items || []
  const selectedOrg = organizations.find((o: any) => o.id.toString() === organizationId)
  const selectedBranch = branches.find((b: any) => b.id.toString() === branchId)

  const statusCounts = {
    all: orders.length,
    pending: orders.filter((o: OrderItem) => o.status.toLowerCase() === "pending").length,
    approved: orders.filter((o: OrderItem) => o.status.toLowerCase() === "approved").length,
    fulfilled: orders.filter((o: OrderItem) => o.status.toLowerCase() === "fulfilled").length,
    refunded: orders.filter((o: OrderItem) => o.status.toLowerCase() === "refunded").length,
    rejected: orders.filter((o: OrderItem) => o.status.toLowerCase() === "rejected" || o.status.toLowerCase() === "cancelled").length,
  }

  const scopeText = branchId
    ? selectedBranch?.name || `Branch #${branchId}`
    : organizationId
      ? selectedOrg?.name || "Selected organization"
      : "All organizations"

  if (!isInitialized || !ordersEndpoint) {
    return (
      <div className="py-24 text-center text-muted-foreground">
        Loading your context…
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-[#f8fafc] dark:bg-[#020617] p-4 md:p-8 space-y-8">
      {/* ═══ PREMIUM HEADER ═══ */}
      <section className="shrink-0 animate-in fade-in slide-in-from-top-4 duration-700 ease-out">
        <div className="relative overflow-hidden rounded-[2.5rem] border border-white/20 dark:border-white/5 shadow-2xl">
          {/* Midnight Aurora Background */}
          <div className="absolute inset-0 bg-[#020617]">
            <div className="absolute top-[-10%] left-[-10%] h-[120%] w-[120%] bg-[radial-gradient(circle_at_20%_30%,_rgba(79,70,229,0.15)_0%,_transparent_50%)]" />
            <div className="absolute top-[-10%] left-[-10%] h-[120%] w-[120%] bg-[radial-gradient(circle_at_80%_70%,_rgba(16,185,129,0.1)_0%,_transparent_50%)]" />
            <div className="absolute top-[10%] right-[10%] h-[40%] w-[40%] bg-indigo-500/10 blur-[120px] rounded-full animate-pulse" />
            <div className="absolute bottom-[10%] left-[20%] h-[30%] w-[30%] bg-emerald-500/5 blur-[100px] rounded-full animate-pulse [animation-delay:2s]" />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#020617]/40 to-[#020617]" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#020617]/60 via-transparent to-[#020617]/60" />
          </div>
          <div className="absolute inset-0 backdrop-blur-[120px]" />

          <div className="relative px-8 py-10 lg:py-14 text-white">
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-12">
              <div className="space-y-6 flex-1">
                <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 backdrop-blur-md">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
                  </span>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.4em] text-indigo-300">
                    {isBranchAdmin ? "Branch · Orders" : "Control · Orders"}
                  </p>
                </div>

                <div className="space-y-3">
                  <h1 className="text-4xl md:text-5xl font-semibold tracking-tighter text-white lg:text-7xl">
                    Order <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 via-white to-emerald-300">Intelligence</span>
                  </h1>
                  <p className="text-lg md:text-xl text-slate-300 max-w-2xl font-medium leading-relaxed">
                    {isBranchAdmin
                      ? "Review orders placed from your branch's Order Portal."
                      : `Monitor approvals and fulfillment pipelines across ${scopeText.toLowerCase()}.`}
                  </p>
                </div>

                <div className="flex flex-wrap gap-4 pt-4">
                  <div className="h-14 flex items-center px-6 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 backdrop-blur-xl text-sm font-medium uppercase tracking-wider text-indigo-200">
                    {scopeText}
                  </div>
                </div>
              </div>

              <div className="flex gap-6 self-start xl:self-center">
                {[
                  { label: "Total Orders", value: statusCounts.all, icon: <Package className="w-6 h-6 text-indigo-400" />, helper: "All Records" },
                  { label: "Approved", value: statusCounts.approved, icon: <CheckCircle className="w-6 h-6 text-blue-400" />, helper: "Ready for Fulfillment" },
                  { label: "Fulfilled", value: statusCounts.fulfilled, icon: <CheckCircle className="w-6 h-6 text-emerald-400" />, helper: "Completed" },
                ].map((stat) => (
                  <div key={stat.label} className="flex flex-col items-center gap-2 px-6 py-5 rounded-[1.75rem] bg-white/5 border border-white/10 backdrop-blur-xl min-w-[120px] hover:bg-white/10 transition-all duration-300 hover:scale-105">
                    <div className="flex items-center gap-3">
                      {stat.icon}
                      <span className="text-3xl font-semibold text-white">{stat.value}</span>
                    </div>
                    <p className="text-[9px] font-medium uppercase tracking-[0.3em] text-white/60">{stat.label}</p>
                    <p className="text-[8px] font-medium text-white/40 uppercase tracking-wider">{stat.helper}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ PREMIUM STATS ROW ═══ */}
      <section className="grid grid-cols-2 md:grid-cols-5 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100 fill-mode-both">
        {[
          { label: "Total Orders", count: statusCounts.all, accent: "indigo", icon: <Package className="h-5 w-5" /> },
          { label: "Approved", count: statusCounts.approved, accent: "blue", icon: <CheckCircle className="h-5 w-5" /> },
          { label: "Fulfilled", count: statusCounts.fulfilled, accent: "emerald", icon: <CheckCircle className="h-5 w-5" /> },
          { label: "Rejected", count: statusCounts.rejected, accent: "rose", icon: <XCircle className="h-5 w-5" /> },
          { label: "Refunded", count: statusCounts.refunded, accent: "amber", icon: <TrendingDown className="h-5 w-5" /> },
        ].map((stat) => (
          <div
            key={stat.label}
            className={`group relative overflow-hidden rounded-[2rem] border border-white/10 dark:border-white/5 bg-white/70 dark:bg-[#030712]/70 backdrop-blur-[40px] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.3)] hover:shadow-xl transition-all duration-300 hover:scale-[1.02]`}
          >
            <div className={`absolute top-0 right-0 h-24 w-24 bg-${stat.accent}-500/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 group-hover:bg-${stat.accent}-500/10 transition-all`} />
            <div className="relative">
              <div className={`h-10 w-10 rounded-xl bg-${stat.accent}-500/10 dark:bg-${stat.accent}-500/10 flex items-center justify-center text-${stat.accent}-600 dark:text-${stat.accent}-400 mb-3`}>
                {stat.icon}
              </div>
              <p className="text-3xl font-semibold tracking-tighter text-slate-900 dark:text-white">{stat.count}</p>
              <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400 mt-1">{stat.label}</p>
            </div>
          </div>
        ))}
      </section>

      {/* ═══ UNIFIED COMMAND BAR ═══ */}
      <section className="relative z-50 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200 fill-mode-both">
        <div className="flex items-center gap-2 flex-wrap bg-white/70 dark:bg-[#030712]/70 backdrop-blur-[40px] border border-slate-200 dark:border-slate-800 rounded-3xl p-4 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.3)] w-full">
          <Filter className="h-4 w-4 text-slate-400 shrink-0 ml-2" />
          <GlobalDateFilter value={dateRange} onChange={handleDateChange} activePreset={activePreset} />
          {organizationId && (isSuperAdmin || isHeadOffice) && (
            <>
              <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-2" />
              <MultiBranchFilter organizationId={organizationId} selectedBranchIds={branchIds} onChange={handleBranchChange} />
            </>
          )}
        </div>
      </section>

      {/* ═══ FILTERS + TABLE ═══ */}
      <section className="animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-300 fill-mode-both">
        <Card className="border-none shadow-[0_15px_60px_rgb(0,0,0,0.06)] dark:shadow-[0_15px_60px_rgb(0,0,0,0.4)] bg-white/70 dark:bg-[#030712]/70 backdrop-blur-[40px] rounded-[3rem] overflow-hidden">
          {/* Filter Bar */}
          <div className="px-8 pt-8 pb-6 space-y-5">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
              {/* Search */}
              <div className="relative group w-full lg:max-w-sm">
                <Search className="absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400 transition-all group-focus-within:text-indigo-500 group-focus-within:scale-110" />
                <Input
                  placeholder="Search by TID or Order ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-14 h-14 bg-slate-100/50 dark:bg-slate-900/50 border-transparent focus:bg-white dark:focus:bg-slate-900 transition-all duration-300 text-base font-medium rounded-2xl"
                />
              </div>

              {/* Status Tabs */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1 p-1.5 bg-slate-100/60 dark:bg-slate-800/50 rounded-2xl border border-slate-200/50 dark:border-slate-700/50">
                  {["all", "approved", "fulfilled", "rejected", "refunded"].map((status) => (
                    <Button
                      key={status}
                      onClick={() => setStatusFilter(status)}
                      variant={statusFilter === status ? "secondary" : "ghost"}
                      size="sm"
                      className={`capitalize px-4 h-10 text-xs font-medium rounded-xl transition-all duration-200 ${statusFilter === status
                        ? "bg-white dark:bg-slate-700 shadow-md text-slate-900 dark:text-white scale-[1.02]"
                        : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-white/50 dark:hover:bg-slate-700/50"
                        }`}
                    >
                      {status}
                    </Button>
                  ))}
                </div>

                <div className="h-8 w-px bg-slate-200 dark:bg-slate-800 hidden md:block" />
                <OrderExport orders={filteredOrders} role={userRole} />
              </div>
            </div>

            {/* Refund Filter Pills */}
            <div className="flex items-center gap-4 pt-2 border-t border-slate-100 dark:border-slate-800/50">
              <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Refund</span>
              <div className="flex gap-2">
                {["all", "partial", "full"].map((refund) => (
                  <Button
                    key={refund}
                    onClick={() => setRefundFilter(refund)}
                    variant={refundFilter === refund ? "default" : "outline"}
                    size="sm"
                    className={`h-8 px-4 text-[11px] capitalize rounded-full font-medium transition-all ${refundFilter === refund
                      ? "bg-slate-900 dark:bg-white dark:text-slate-900 shadow-lg"
                      : "border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800"
                      }`}
                  >
                    {refund}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {/* ═══ ORDERS TABLE ═══ */}
          <div className="px-8 pb-8">
            {filteredOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                <div className="h-20 w-20 rounded-[2rem] bg-slate-100 dark:bg-slate-900 flex items-center justify-center rotate-6">
                  <Package className="h-10 w-10 text-slate-300 dark:text-slate-600" />
                </div>
                <div className="space-y-1">
                  <p className="text-xl font-semibold text-slate-400 tracking-tight">No orders found</p>
                  <p className="text-sm text-slate-500 font-medium">Adjust your filters or date range</p>
                </div>
              </div>
            ) : (
              <div className="w-full">
                <table className="w-full text-sm border-collapse table-fixed">
                  <thead>
                    <tr className="text-left text-[10px] uppercase tracking-[0.2em] text-slate-400 font-medium border-b border-slate-100 dark:border-slate-800/60">
                      <th className="pb-4 pr-2 font-medium w-[14%]">TID</th>
                      {isSuperAdmin && (
                        <th className="pb-4 pr-2 font-medium w-[12%]">Org</th>
                      )}
                      <th className="pb-4 pr-2 font-medium w-[14%]">Branch</th>
                      <th className="pb-4 pr-2 font-medium w-[10%]">Stage</th>
                      <th className="pb-4 pr-2 font-medium w-[12%]">Status</th>
                      <th className="pb-4 pr-2 font-medium w-[10%]">Refund</th>
                      <th className="pb-4 pr-2 font-medium w-[10%] text-right">Amount</th>
                      <th className="pb-4 pr-2 font-medium w-[8%] text-right">Date</th>
                      <th className="pb-4 font-medium w-[10%] text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-800/40">
                    {filteredOrders.map((order: OrderItem) => {
                      const statusInfo = getStatusColor(order.status)
                      const StatusIcon = statusInfo.icon

                      return (
                        <tr key={order.id} className="group hover:bg-slate-50/80 dark:hover:bg-indigo-500/[0.03] transition-all duration-300">
                          <td className="py-4 pr-2">
                            <div>
                              <p className="text-xs font-semibold text-slate-900 dark:text-white uppercase font-mono tracking-wider">{order.tid}</p>
                              <p className="text-[10px] text-slate-400 font-medium">#{order.id}</p>
                            </div>
                          </td>
                          {isSuperAdmin && (
                            <td className="py-4 pr-2">
                              <p className="text-xs text-slate-600 dark:text-slate-400 font-semibold truncate">
                                {order.organizationName || `#${order.organizationId}`}
                              </p>
                            </td>
                          )}
                          <td className="py-4 pr-2">
                            <p className="text-xs text-slate-700 dark:text-slate-300 font-medium truncate">
                              {order.branchName || `#${order.branchId}`}
                            </p>
                          </td>
                          <td className="py-4 pr-2">
                            {order.status.toLowerCase() === "refunded" ? (
                              <Badge variant="outline" className="bg-slate-500/5 text-slate-500 border-slate-500/20 text-[8px] px-2 py-0.5 rounded-full font-medium uppercase tracking-widest">
                                Refunded
                              </Badge>
                            ) : order.status.toLowerCase() === "fulfilled" ? (
                              <Badge variant="outline" className="bg-emerald-500/5 text-emerald-500 border-emerald-500/20 text-[8px] px-2 py-0.5 rounded-full font-medium uppercase tracking-widest">
                                Fulfilled
                              </Badge>
                            ) : order.status.toLowerCase() === "approved" ? (
                              <Badge variant="outline" className="bg-blue-500/5 text-blue-500 border-blue-500/20 text-[8px] px-2 py-0.5 rounded-full font-medium uppercase tracking-widest">
                                Approved
                              </Badge>
                            ) : order.status.toLowerCase() === "pending" ? (
                              <Badge variant="outline" className="bg-amber-500/5 text-amber-500 border-amber-500/20 text-[8px] px-2 py-0.5 rounded-full font-medium uppercase tracking-widest">
                                Pending
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-rose-500/5 text-rose-500 border-rose-500/20 text-[8px] px-2 py-0.5 rounded-full font-medium uppercase tracking-widest">
                                Rejected
                              </Badge>
                            )}
                          </td>
                          <td className="py-4 pr-2">
                            <Badge variant="outline" className={`${statusInfo.bg} ${statusInfo.text} border-0 text-[8px] px-2 py-0.5 rounded-full font-medium uppercase tracking-widest`}>
                              {order.status.toUpperCase()}
                            </Badge>
                            {order.status.toLowerCase() === 'refunded' && order.statusAtRefund && (
                              <p className="text-[9px] text-slate-500 mt-0.5 font-medium">
                                Was: {order.statusAtRefund.toUpperCase()}
                              </p>
                            )}
                            {(order.status.toLowerCase() === 'rejected' || order.status === 'REJECTED') && order.rejectionReason && (
                              <div className="mt-1 text-[10px] text-rose-500 max-w-[140px] leading-tight font-medium truncate" title={order.rejectionReason}>
                                {order.rejectionReason}
                              </div>
                            )}
                          </td>
                          <td className="py-4 pr-2">
                            <div className="flex flex-wrap gap-1">
                              {order.status.toLowerCase() === "refunded" ? (
                                <Badge variant="outline" className="bg-rose-500/5 text-rose-500 border-rose-500/20 text-[8px] uppercase font-bold px-2 rounded-full">
                                  Full
                                </Badge>
                              ) : (
                                <>
                                  {(order.refundAmountCents ?? 0) > 0 && (
                                    <Badge variant="outline" className="bg-amber-500/5 text-amber-500 border-amber-500/20 text-[8px] uppercase font-bold px-2 rounded-full">
                                      Partial
                                    </Badge>
                                  )}
                                  {(order.hasRefundRequests ?? 0) > 0 && (
                                    <Badge variant="outline" className="bg-sky-500/5 text-sky-500 border-sky-500/20 text-[8px] uppercase font-bold px-2 rounded-full">
                                      Requested
                                    </Badge>
                                  )}
                                  {!(order.refundAmountCents && (order.refundAmountCents ?? 0) > 0) && !(order.hasRefundRequests && (order.hasRefundRequests ?? 0) > 0) && (
                                    <span className="text-[10px] text-slate-400">—</span>
                                  )}
                                </>
                              )}
                            </div>
                          </td>
                          <td className="py-4 pr-2 text-right">
                            <p className="text-xs font-semibold text-slate-900 dark:text-white tracking-tight">
                              {formatPKR(order.totalCents / 100)}
                            </p>
                          </td>
                          <td className="py-4 pr-2 text-right whitespace-nowrap">
                            <p className="text-[10px] font-bold text-slate-400">
                              {new Date(order.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                            </p>
                          </td>
                          <td className="py-4 text-right">
                            <div className="inline-flex items-center gap-1.5 opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0 transition-all duration-300">
                              <ReceiptIconButton orderId={order.id} />

                              <Button
                                asChild
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 rounded-xl text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/10"
                              >
                                <Link href={`/orders/${order.id}`}>
                                  <Eye className="h-4 w-4" />
                                </Link>
                              </Button>

                              {order.status.toLowerCase() === "pending" && isBranchAdmin && (
                                <>
                                  <Button
                                    onClick={() => {
                                      setSelectedOrder(order)
                                      setShowApprovalDialog(true)
                                    }}
                                    size="sm"
                                    className="h-8 px-3 rounded-xl gap-1 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold shadow-lg shadow-emerald-600/20"
                                  >
                                    <Check className="h-3.5 w-3.5" />
                                    Approve
                                  </Button>
                                  <Button
                                    onClick={() => {
                                      setSelectedOrder(order)
                                      setShowRejectDialog(true)
                                    }}
                                    variant="destructive"
                                    size="sm"
                                    className="h-8 px-3 rounded-xl gap-1 text-[10px] font-bold shadow-lg shadow-rose-600/20"
                                  >
                                    <X className="h-3.5 w-3.5" />
                                    Reject
                                  </Button>
                                </>
                              )}

                              {order.status.toLowerCase() === "approved" && isSuperAdmin && (
                                <Button
                                  onClick={() => {
                                    setSelectedOrder(order)
                                    setShowFulfillDialog(true)
                                  }}
                                  size="sm"
                                  className="h-8 px-3 rounded-xl gap-1 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold shadow-lg shadow-indigo-600/20"
                                >
                                  <CheckCircle className="h-3.5 w-3.5" />
                                  Fulfill
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Card>
      </section>

      {/* Approval Dialog */}
      <Dialog open={showApprovalDialog} onOpenChange={setShowApprovalDialog}>
        <DialogContent className="max-w-md border-0 shadow-2xl bg-white/90 dark:bg-slate-900/95 backdrop-blur-xl rounded-[2rem]">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-slate-900 dark:text-slate-100 tracking-tight">Approve Order</DialogTitle>
            <DialogDescription className="text-slate-500 dark:text-slate-400 font-medium">
              Confirm approval for this order
            </DialogDescription>
          </DialogHeader>

          {selectedOrder && (
            <div className="space-y-3">
              <div className="p-4 bg-indigo-500/5 dark:bg-indigo-500/10 rounded-2xl border border-indigo-500/10">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-500 mb-1">Order TID</p>
                <p className="font-mono text-lg font-black text-slate-900 dark:text-white tracking-wider">{selectedOrder.tid}</p>
              </div>
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-1">Total Amount</p>
                <p className="text-3xl font-semibold text-slate-900 dark:text-white tracking-tight">
                  {formatPKR(selectedOrder.totalCents / 100)}
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowApprovalDialog(false)}
              disabled={isProcessing}
              className="rounded-xl h-11 font-bold"
            >
              Cancel
            </Button>
            <Button
              onClick={() => selectedOrder && handleApproveOrder(selectedOrder.id)}
              disabled={isProcessing}
              className="bg-emerald-600 hover:bg-emerald-500 rounded-xl h-11 font-bold shadow-lg shadow-emerald-600/20"
            >
              Approve Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rejection Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent className="max-w-md border-0 shadow-2xl bg-white/90 dark:bg-slate-900/95 backdrop-blur-xl rounded-[2rem]">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-slate-900 dark:text-slate-100 tracking-tight">Reject Order</DialogTitle>
            <DialogDescription className="text-slate-500 dark:text-slate-400 font-medium">
              Provide a reason for rejecting this order
            </DialogDescription>
          </DialogHeader>

          {selectedOrder && (
            <div className="space-y-4">
              <div className="p-4 bg-rose-500/5 dark:bg-rose-500/10 rounded-2xl border border-rose-500/10">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-rose-500 mb-1">Order TID</p>
                <p className="font-mono text-lg font-black text-slate-900 dark:text-white tracking-wider">{selectedOrder.tid}</p>
              </div>

              <div>
                <label className="text-sm font-bold mb-2 block text-slate-900 dark:text-slate-200">Rejection Reason</label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Explain why this order is being rejected..."
                  className="w-full p-4 border border-slate-200 dark:border-slate-700 rounded-2xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white min-h-24 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500/30 transition-all"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowRejectDialog(false)
                setRejectReason("")
              }}
              disabled={isProcessing}
              className="rounded-xl h-11 font-bold"
            >
              Cancel
            </Button>
            <Button
              onClick={() => selectedOrder && handleRejectOrder(selectedOrder.id)}
              disabled={isProcessing}
              variant="destructive"
              className="rounded-xl h-11 font-bold shadow-lg shadow-rose-600/20"
            >
              Reject Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* SECURITY: Approval Token Display Dialog - Shown ONCE after approval */}
      <Dialog open={showTokenDialog} onOpenChange={(open) => {
        if (!open) {
          setShowTokenDialog(false)
          setApprovalToken(null)
        }
      }}>
        <DialogContent className="max-w-md border-0 shadow-2xl bg-white/90 dark:bg-slate-900/95 backdrop-blur-xl rounded-[2rem]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight">
              <CheckCircle className="h-5 w-5" />
              Order Approved
            </DialogTitle>
            <DialogDescription className="text-amber-600 dark:text-amber-400 font-bold">
              ⚠️ This token will NOT be shown again. Copy it now!
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 text-center">
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500 mb-3">Approval Token</p>
              <p className="font-mono text-3xl font-black tracking-[0.3em] text-slate-900 dark:text-white select-all">
                {approvalToken}
              </p>
            </div>

            <div className="bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/10 rounded-2xl p-4">
              <p className="text-sm text-amber-700 dark:text-amber-300 font-medium">
                <strong>Important:</strong> Share this token securely with the Super Admin who will fulfill this order. They will need to enter it to complete fulfillment.
              </p>
            </div>

            <Button
              className="w-full gap-2 h-12 rounded-xl font-bold bg-slate-900 dark:bg-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100"
              onClick={() => {
                if (approvalToken) {
                  navigator.clipboard.writeText(approvalToken)
                  toast({ title: "Copied!", description: "Token copied to clipboard" })
                }
              }}
            >
              <Receipt className="h-4 w-4" />
              Copy Token to Clipboard
            </Button>
          </div>

          <DialogFooter>
            <Button variant="outline" className="rounded-xl h-11 font-bold" onClick={() => {
              setShowTokenDialog(false)
              setApprovalToken(null)
            }}>
              I've Saved the Token
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Fulfillment Token Input Dialog - Super Admin must enter token */}
      <Dialog open={showFulfillDialog} onOpenChange={(open) => {
        if (!open) {
          setShowFulfillDialog(false)
          setFulfillToken("")
          setSelectedOrder(null)
        }
      }}>
        <DialogContent className="max-w-md border-0 shadow-2xl bg-white/90 dark:bg-slate-900/95 backdrop-blur-xl rounded-[2rem]">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-slate-900 dark:text-slate-100 tracking-tight">Enter Approval Token</DialogTitle>
            <DialogDescription className="text-slate-500 dark:text-slate-400 font-medium">
              To fulfill this order, enter the approval token provided by the Branch Admin who approved it.
            </DialogDescription>
          </DialogHeader>

          {selectedOrder && (
            <div className="space-y-4">
              <div className="p-4 bg-indigo-500/5 dark:bg-indigo-500/10 rounded-2xl border border-indigo-500/10">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-500 mb-1">Order TID</p>
                <p className="font-mono text-lg font-black text-slate-900 dark:text-white tracking-wider">{selectedOrder.tid}</p>
              </div>

              <div>
                <label className="text-sm font-bold mb-2 block text-slate-900 dark:text-slate-200">Approval Token</label>
                <input
                  type="text"
                  value={fulfillToken}
                  onChange={(e) => setFulfillToken(e.target.value.toUpperCase())}
                  placeholder="Enter 10-character token..."
                  className="w-full p-4 border border-slate-200 dark:border-slate-700 rounded-2xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-xl tracking-[0.3em] uppercase focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/30 transition-all"
                  maxLength={10}
                  autoComplete="off"
                />
                <p className="text-xs text-slate-400 mt-2 font-medium">
                  Token is case-insensitive
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowFulfillDialog(false)
                setFulfillToken("")
                setSelectedOrder(null)
              }}
              disabled={isProcessing}
              className="rounded-xl h-11 font-bold"
            >
              Cancel
            </Button>
            <Button
              onClick={() => selectedOrder && handleFulfillOrder(selectedOrder.id)}
              disabled={isProcessing || !fulfillToken.trim()}
              className="bg-indigo-600 hover:bg-indigo-500 rounded-xl h-11 font-bold shadow-lg shadow-indigo-600/20"
            >
              Fulfill Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Professional Error Dialog */}
      <Dialog open={showErrorDialog} onOpenChange={setShowErrorDialog}>
        <DialogContent className="max-w-md border-0 shadow-2xl bg-white/90 dark:bg-slate-900/95 backdrop-blur-xl rounded-[2rem]">
          <DialogHeader className="text-center pb-2">
            <div className="mx-auto w-16 h-16 rounded-[1.5rem] bg-amber-500/10 flex items-center justify-center mb-4">
              <AlertTriangle className="h-8 w-8 text-amber-500" />
            </div>
            <DialogTitle className="text-xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
              Attention Required
            </DialogTitle>
          </DialogHeader>

          <div className="py-4">
            <p className="text-center text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
              {errorMessage}
            </p>
          </div>

          <DialogFooter className="sm:justify-center">
            <Button
              onClick={() => setShowErrorDialog(false)}
              className="w-full sm:w-auto px-8 h-12 rounded-xl font-bold bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 dark:text-slate-900"
            >
              Understood
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  )
}
