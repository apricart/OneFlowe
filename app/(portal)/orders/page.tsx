"use client"
import React, { useState, useMemo } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import useSWR from "swr"
import { useSession } from "next-auth/react"
import { useToast } from "@/components/ui/use-toast"
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
} from "lucide-react"
import { formatPKR } from "@/lib/utils"
import { useAppContext } from "@/components/context/app-context"
import { OrderExport } from "@/components/orders/order-export"
import { ReceiptIconButton } from "@/components/receipts/receipt-icon-button"

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
  const { organizationId, branchId, isInitialized } = useAppContext()
  const userRole = (session?.user as any)?.role
  const isBranchAdmin = userRole === "BRANCH_ADMIN"
  const isHeadOffice = userRole === "HEAD_OFFICE"
  const isSuperAdmin = userRole === "SUPER_ADMIN"

  const [searchQuery, setSearchQuery] = useState("")
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

  // Build orders endpoint with context parameters
  const ordersEndpoint = useMemo(() => {
    if (!isInitialized) return null
    const params = new URLSearchParams()
    if (organizationId) params.set("organizationId", organizationId)
    if (branchId) params.set("branchId", branchId)
    return `/api/v1/orders${params.toString() ? `?${params.toString()}` : ""}`
  }, [organizationId, branchId, isInitialized])

  // Fetch orders scoped by context
  const { data: ordersData, mutate: mutateOrders } = useSWR<any>(
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
      } else if (refundFilter === "none") {
        filtered = filtered.filter((o: OrderItem) =>
          !o.refundAmountCents || o.refundAmountCents === 0
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
    refunded: orders.filter((o: OrderItem) =>
      o.status.toLowerCase() === "refunded" ||
      (o.refundAmountCents && o.refundAmountCents > 0)
    ).length,
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
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-6 space-y-6">
      {/* Gradient Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#141EAE] via-[#4427CA] to-[#7C3AED] px-6 py-6 text-white shadow-xl ring-1 ring-indigo-500/30">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs tracking-[0.2em] text-white/70">
              {isBranchAdmin ? "BRANCH · ORDERS" : "CONTROL · ORDERS"}
            </p>
            <h1 className="text-3xl font-semibold">
              {isBranchAdmin ? "Branch order overview" : "Order intelligence overview"}
            </h1>
            <p className="text-sm text-white/80">
              {isBranchAdmin
                ? "Review orders placed from your branch's Order Portal."
                : `Monitor approvals and fulfillment pipelines across ${scopeText.toLowerCase()}.`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => mutateOrders()}
              variant="secondary"
              size="sm"
              className="gap-2 bg-white/15 text-white hover:bg-white/25 border-0"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh data
            </Button>
            <div className="rounded-full bg-white/20 px-4 py-2 text-sm font-semibold uppercase tracking-wide">
              {scopeText}
            </div>
          </div>
        </div>
      </div>

      {/* Stats & Filters – shown for all roles; data is branch-scoped for branch admins */}
      <div className="flex flex-wrap gap-4">
        {[
          {
            label: "Total Orders",
            count: statusCounts.all,
            gradient: "from-slate-50 to-slate-100 dark:from-slate-900/30 dark:to-slate-800/20",
            border: "border-slate-200 dark:border-slate-800",
            textColor: "text-slate-900 dark:text-slate-200",
            textSecondary: "text-slate-700 dark:text-slate-400",
            iconColor: "text-slate-600 dark:text-slate-400"
          },
          {
            label: "Pending",
            count: statusCounts.pending,
            gradient: "from-yellow-50 to-yellow-100 dark:from-yellow-900/30 dark:to-yellow-800/20",
            border: "border-yellow-200 dark:border-yellow-800",
            textColor: "text-yellow-900 dark:text-yellow-200",
            textSecondary: "text-yellow-700 dark:text-yellow-400",
            iconColor: "text-yellow-600 dark:text-yellow-400"
          },
          {
            label: "Approved",
            count: statusCounts.approved,
            gradient: "from-blue-50 to-blue-100 dark:from-slate-900/30 dark:to-slate-800/20",
            border: "border-blue-200 dark:border-slate-800",
            textColor: "text-blue-900 dark:text-slate-200",
            textSecondary: "text-blue-700 dark:text-slate-400",
            iconColor: "text-blue-600 dark:text-slate-400"
          },
          {
            label: "Fulfilled",
            count: statusCounts.fulfilled,
            gradient: "from-emerald-50 to-emerald-100 dark:from-emerald-900/30 dark:to-emerald-800/20",
            border: "border-emerald-200 dark:border-emerald-800",
            textColor: "text-emerald-900 dark:text-emerald-200",
            textSecondary: "text-emerald-700 dark:text-emerald-400",
            iconColor: "text-emerald-600 dark:text-emerald-400"
          },
          {
            label: "Refunded",
            count: statusCounts.refunded,
            gradient: "from-rose-50 to-rose-100 dark:from-rose-900/30 dark:to-rose-800/20",
            border: "border-rose-200 dark:border-rose-800",
            textColor: "text-rose-900 dark:text-rose-200",
            textSecondary: "text-rose-700 dark:text-rose-400",
            iconColor: "text-rose-600 dark:text-rose-400"
          },
        ].filter(stat => !(isSuperAdmin || isHeadOffice) || stat.label !== "Pending").map((stat) => (
          <div
            key={stat.label}
            className={`flex-1 min-w-[200px] bg-gradient-to-br border ${stat.gradient} ${stat.border} rounded-lg p-5 hover:shadow-md transition-shadow`}
          >
            <p className={`text-xs font-semibold uppercase tracking-wider ${stat.textColor} mb-1`}>{stat.label}</p>
            <p className={`text-3xl font-bold ${stat.textColor} mb-1`}>{stat.count}</p>
            <p className={`text-xs ${stat.textSecondary}`}>Order count</p>
          </div>
        ))}
      </div>

      <Card className="p-4 space-y-4 border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-slate-900/50 bg-white dark:bg-slate-900">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-semibold text-slate-900 dark:text-slate-100">Filters</h3>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="relative w-full lg:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
            <Input
              placeholder="Search by TID or Order ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 w-full bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1 p-1 bg-slate-100/50 dark:bg-slate-800/50 rounded-lg border border-slate-200/50 dark:border-slate-800">
              {["all", "pending", "approved", "fulfilled", "refunded"].filter(s => !(isSuperAdmin || isHeadOffice) || s !== "pending").map((status) => (
                <Button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  variant={statusFilter === status ? "secondary" : "ghost"}
                  size="sm"
                  className={`capitalize px-3 h-8 text-xs font-medium transition-all ${statusFilter === status
                      ? "bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white"
                      : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
                    }`}
                >
                  {status}
                </Button>
              ))}
            </div>
            <div className="h-6 w-[1px] bg-slate-200 dark:bg-slate-800 hidden md:block mx-1" />
            <OrderExport orders={filteredOrders} role={userRole} />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 pt-4 border-t border-slate-100 dark:border-slate-800/50">
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Refund state</span>
            <div className="flex gap-1.5">
              {["all", "none", "partial", "full"].map((refund) => (
                <Button
                  key={refund}
                  onClick={() => setRefundFilter(refund)}
                  variant={refundFilter === refund ? "default" : "outline"}
                  size="sm"
                  className={`h-7 px-3 text-[11px] capitalize rounded-full ${refundFilter === refund
                      ? "bg-slate-900 dark:bg-slate-100"
                      : "border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800"
                    }`}
                >
                  {refund}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* Orders Table */}
      <Card className="overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-slate-900/50 bg-white dark:bg-slate-900">
        {filteredOrders.length === 0 ? (
          <div className="p-8 text-center bg-white dark:bg-slate-900">
            <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <p className="text-muted-foreground">No orders found</p>
          </div>
        ) : (
          <div className="overflow-x-auto bg-white dark:bg-slate-900">
            <table className="w-full bg-white dark:bg-slate-900">
              <thead className="border-b bg-slate-50 dark:bg-slate-900 dark:border-slate-800">
                <tr className="bg-slate-50 dark:bg-slate-900 border-b dark:border-slate-800">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">TID</th>
                  {isSuperAdmin && (
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Org</th>
                  )}
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Branch</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Stage</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Refund</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Amount</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Date</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700 bg-white dark:bg-slate-900">
                {filteredOrders.map((order: OrderItem) => {
                  const statusInfo = getStatusColor(order.status)
                  const StatusIcon = statusInfo.icon

                  return (
                    <tr key={order.id} className="bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border-b dark:border-slate-800">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div>
                          <p className="text-xs font-semibold text-slate-900 dark:text-white uppercase font-mono">{order.tid}</p>
                          <p className="text-[10px] text-muted-foreground">ID: #{order.id}</p>
                        </div>
                      </td>
                      {isSuperAdmin && (
                        <td className="px-4 py-3">
                          <p className="text-xs text-slate-700 dark:text-slate-300">
                            {order.organizationName || `#${order.organizationId}`}
                          </p>
                        </td>
                      )}
                      <td className="px-4 py-3">
                        <p className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                          {order.branchName || `#${order.branchId}`}
                        </p>
                      </td>
                      <td className="px-2 py-2 bg-white dark:bg-slate-900">
                        {order.status.toLowerCase() === "refunded" ? (
                          <Badge variant="outline" className="bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 border-0 text-[10px] px-1.5 py-0.5">
                            REFUNDED
                          </Badge>
                        ) : order.status.toLowerCase() === "fulfilled" ? (
                          <Badge variant="outline" className="bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 border-0 text-[10px] px-1.5 py-0.5">
                            FULFILLED
                          </Badge>
                        ) : order.status.toLowerCase() === "approved" ? (
                          <Badge variant="outline" className="bg-blue-50 dark:bg-slate-800 text-blue-700 dark:text-slate-200 border-0 text-[10px] px-1.5 py-0.5">
                            APPROVED
                          </Badge>
                        ) : order.status.toLowerCase() === "pending" ? (
                          <Badge variant="outline" className="bg-yellow-50 dark:bg-yellow-950 text-yellow-700 dark:text-yellow-300 border-0 text-[10px] px-1.5 py-0.5">
                            PENDING
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 border-0 text-[10px] px-1.5 py-0.5">
                            REJECTED
                          </Badge>
                        )}
                      </td>
                      <td className="px-2 py-2 bg-white dark:bg-slate-900">
                        <Badge variant="outline" className={`${statusInfo.bg} ${statusInfo.text} border-0 text-[10px] px-1.5 py-0.5`}>
                          {order.status.toUpperCase()}
                        </Badge>
                        {order.status.toLowerCase() === 'refunded' && order.statusAtRefund && (
                          <p className="text-[9px] text-slate-500 dark:text-slate-500 mt-0.5">
                            Was: {order.statusAtRefund.toUpperCase()}
                          </p>
                        )}
                        {(order.status.toLowerCase() === 'rejected' || order.status === 'REJECTED') && order.rejectionReason && (
                          <div className="mt-1 text-[10px] text-red-600 dark:text-red-400 max-w-[150px] leading-tight">
                            {order.rejectionReason}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {order.status.toLowerCase() === "refunded" ? (
                            <Badge variant="outline" className="bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800 text-[10px] uppercase font-bold px-2">
                              FULL
                            </Badge>
                          ) : (
                            <>
                              {(order.refundAmountCents ?? 0) > 0 && (
                                <Badge variant="outline" className="bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800 text-[10px] uppercase font-bold px-2">
                                  PARTIAL
                                </Badge>
                              )}
                              {(order.hasRefundRequests ?? 0) > 0 && (
                                <Badge variant="outline" className="bg-sky-50 dark:bg-sky-950 text-sky-700 dark:text-sky-400 border-sky-200 dark:border-sky-800 text-[10px] uppercase font-bold px-2">
                                  REQUESTED
                                </Badge>
                              )}
                              {!(order.refundAmountCents && (order.refundAmountCents ?? 0) > 0) && !(order.hasRefundRequests && (order.hasRefundRequests ?? 0) > 0) && (
                                <span className="text-[10px] text-muted-foreground">—</span>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <p className="text-xs font-bold text-slate-900 dark:text-white font-mono">
                          {formatPKR(order.totalCents / 100)}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                          {new Date(order.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <ReceiptIconButton orderId={order.id} />

                          <Button
                            asChild
                            variant="ghost"
                            size="sm"
                            className="gap-1"
                          >
                            <Link href={`/orders/${order.id}`}>
                              <Eye className="h-4 w-4" />
                              View
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
                                className="gap-1 bg-green-600 hover:bg-green-700"
                              >
                                <Check className="h-4 w-4" />
                                Approve
                              </Button>
                              <Button
                                onClick={() => {
                                  setSelectedOrder(order)
                                  setShowRejectDialog(true)
                                }}
                                variant="destructive"
                                size="sm"
                                className="gap-1"
                              >
                                <X className="h-4 w-4" />
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
                              className="gap-1 bg-blue-600 hover:bg-blue-700 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-white"
                            >
                              <CheckCircle className="h-4 w-4" />
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
      </Card>

      {/* Approval Dialog */}
      <Dialog open={showApprovalDialog} onOpenChange={setShowApprovalDialog}>
        <DialogContent className="max-w-md border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-slate-900/50 bg-white dark:bg-slate-900">
          <DialogHeader>
            <DialogTitle className="text-slate-900 dark:text-slate-100">Approve Order</DialogTitle>
            <DialogDescription className="text-slate-600 dark:text-slate-400">
              Are you sure you want to approve this order? (Super Admin Override)
            </DialogDescription>
          </DialogHeader>

          {selectedOrder && (
            <div className="space-y-3">
              <div className="p-3 bg-blue-50 dark:bg-slate-800 rounded-lg border border-blue-200 dark:border-slate-700">
                <p className="text-sm font-semibold text-blue-900 dark:text-slate-200 mb-1">Order TID</p>
                <p className="font-mono text-blue-700 dark:text-slate-300">{selectedOrder.tid}</p>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                <p className="text-sm text-muted-foreground mb-1">Total Amount</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">
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
            >
              Cancel
            </Button>
            <Button
              onClick={() => selectedOrder && handleApproveOrder(selectedOrder.id)}
              disabled={isProcessing}
              className="bg-green-600 hover:bg-green-700"
            >
              Approve Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rejection Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent className="max-w-md border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-slate-900/50 bg-white dark:bg-slate-900">
          <DialogHeader>
            <DialogTitle className="text-slate-900 dark:text-slate-100">Reject Order</DialogTitle>
            <DialogDescription className="text-slate-600 dark:text-slate-400">
              Provide a reason for rejecting this order
            </DialogDescription>
          </DialogHeader>

          {selectedOrder && (
            <div className="space-y-4">
              <div className="p-3 bg-red-50 dark:bg-red-950/50 rounded-lg border border-red-200 dark:border-red-800">
                <p className="text-sm font-semibold text-red-900 dark:text-red-300 mb-1">Order TID</p>
                <p className="font-mono text-red-700 dark:text-red-400">{selectedOrder.tid}</p>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block text-slate-900 dark:text-slate-200">Rejection Reason</label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Explain why this order is being rejected..."
                  className="w-full p-3 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white min-h-24 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
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
            >
              Cancel
            </Button>
            <Button
              onClick={() => selectedOrder && handleRejectOrder(selectedOrder.id)}
              disabled={isProcessing}
              variant="destructive"
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-700 dark:text-green-400">
              <CheckCircle className="h-5 w-5" />
              Order Approved - Save This Token!
            </DialogTitle>
            <DialogDescription className="text-amber-600 dark:text-amber-400 font-medium">
              ⚠️ This token will NOT be shown again. Copy it now!
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-600 text-center">
              <p className="text-xs text-muted-foreground mb-2">Approval Token</p>
              <p className="font-mono text-2xl font-bold tracking-widest text-slate-900 dark:text-white select-all">
                {approvalToken}
              </p>
            </div>

            <div className="bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
              <p className="text-sm text-amber-800 dark:text-amber-200">
                <strong>Important:</strong> Share this token securely with the Super Admin who will fulfill this order. They will need to enter it to complete fulfillment.
              </p>
            </div>

            <Button
              className="w-full gap-2"
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
            <Button variant="outline" onClick={() => {
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Enter Approval Token</DialogTitle>
            <DialogDescription>
              To fulfill this order, enter the approval token provided by the Branch Admin who approved it.
            </DialogDescription>
          </DialogHeader>

          {selectedOrder && (
            <div className="space-y-4">
              <div className="p-3 bg-blue-50 dark:bg-blue-950/50 rounded-lg border border-blue-200 dark:border-blue-800">
                <p className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-1">Order TID</p>
                <p className="font-mono text-blue-700 dark:text-blue-400">{selectedOrder.tid}</p>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Approval Token</label>
                <input
                  type="text"
                  value={fulfillToken}
                  onChange={(e) => setFulfillToken(e.target.value.toUpperCase())}
                  placeholder="Enter 10-character token..."
                  className="w-full p-3 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-lg tracking-widest uppercase"
                  maxLength={10}
                  autoComplete="off"
                />
                <p className="text-xs text-muted-foreground mt-1">
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
            >
              Cancel
            </Button>
            <Button
              onClick={() => selectedOrder && handleFulfillOrder(selectedOrder.id)}
              disabled={isProcessing || !fulfillToken.trim()}
              className="bg-green-600 hover:bg-green-700"
            >
              Fulfill Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Professional Error Dialog */}
      <Dialog open={showErrorDialog} onOpenChange={setShowErrorDialog}>
        <DialogContent className="max-w-md border-0 shadow-2xl bg-white dark:bg-slate-900">
          <DialogHeader className="text-center pb-2">
            <div className="mx-auto w-16 h-16 rounded-full bg-amber-50 dark:bg-amber-950 flex items-center justify-center mb-4">
              <AlertTriangle className="h-8 w-8 text-amber-600 dark:text-amber-400" />
            </div>
            <DialogTitle className="text-xl font-semibold text-slate-900 dark:text-slate-100">
              Attention Required
            </DialogTitle>
          </DialogHeader>

          <div className="py-4">
            <p className="text-center text-slate-600 dark:text-slate-400 leading-relaxed">
              {errorMessage}
            </p>
          </div>

          <DialogFooter className="sm:justify-center">
            <Button
              onClick={() => setShowErrorDialog(false)}
              className="w-full sm:w-auto px-8 bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-slate-200 dark:text-slate-900"
            >
              Understood
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  )
}
