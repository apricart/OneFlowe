"use client"
import React, { useState, useMemo } from "react"
import useSWR from "swr"
import { useToast } from "@/components/ui/use-toast"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Package, Search, Filter, CheckCircle, Clock, AlertTriangle, TrendingDown, RefreshCw, Check, X, Eye, ShieldCheck, ArchiveRestore } from "lucide-react"
import { formatPKR } from "@/lib/utils"
import { useAppContext } from "@/components/context/app-context"
import Link from "next/link"
import { getAutoApprovalCountdown } from "@/lib/order-utils"

const fetcher = (url: string) => fetch(url).then(r => r.json())

interface OrderItem {
  id: number
  tid: string
  organizationId: number
  branchId: number
  status: string
  subtotalCents: number
  taxCents: number
  totalCents: number
  createdAt: string
  createdByUserId: string
  branchName?: string | null
}

export default function HeadOfficeOrdersPage() {
  const { toast } = useToast()
  const { organizationId, branchId, isInitialized } = useAppContext()

  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [selectedOrder, setSelectedOrder] = useState<OrderItem | null>(null)
  const [showApprovalDialog, setShowApprovalDialog] = useState(false)
  const [showRejectDialog, setShowRejectDialog] = useState(false)
  const [rejectReason, setRejectReason] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)

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
      filtered = filtered.filter((o: OrderItem) => o.status.toLowerCase() === statusFilter)
    }

    if (searchQuery) {
      filtered = filtered.filter((o: OrderItem) =>
        o.tid.includes(searchQuery) ||
        o.id.toString().includes(searchQuery) ||
        (o.branchName && o.branchName.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    }

    return filtered.sort((a: OrderItem, b: OrderItem) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
  }, [orders, statusFilter, searchQuery])

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

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to approve order")
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
          action: "cancel"
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

  const getStatusColor = (status: string) => {
    const colors: Record<string, { bg: string; text: string; icon: any }> = {
      pending: { bg: "bg-yellow-50 dark:bg-yellow-950", text: "text-yellow-700 dark:text-yellow-300", icon: Clock },
      approved: { bg: "bg-blue-50 dark:bg-blue-950", text: "text-blue-700 dark:text-blue-300", icon: CheckCircle },
      fulfilled: { bg: "bg-green-50 dark:bg-green-950", text: "text-green-700 dark:text-green-300", icon: CheckCircle },
      rejected: { bg: "bg-red-50 dark:bg-red-950", text: "text-red-700 dark:text-red-300", icon: AlertTriangle },
      refunded: { bg: "bg-slate-50 dark:bg-slate-950", text: "text-slate-700 dark:text-slate-300", icon: TrendingDown },
    }
    return colors[status?.toLowerCase()] || colors.pending
  }

  // Derive scope display from context + org/branch metadata, not from orders
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
  }

  if (!isInitialized || !ordersEndpoint) {
    return (
      <div className="py-24 text-center text-muted-foreground">
        Loading your context…
      </div>
    )
  }

  const scopeText = branchId
    ? selectedBranch?.name || `Branch #${branchId}`
    : organizationId
    ? selectedOrg?.name || "Selected organization"
    : "All organizations"

  const statCards = [
    {
      label: "Total orders",
      value: statusCounts.all,
      sub: "Across selection",
      icon: Package,
      gradient: "from-indigo-500 to-purple-500",
    },
    {
      label: "Pending review",
      value: statusCounts.pending,
      sub: "Auto-approval safety net",
      icon: Clock,
      gradient: "from-amber-400 to-orange-500",
    },
    {
      label: "Approved",
      value: statusCounts.approved,
      sub: "Ready for fulfillment",
      icon: ShieldCheck,
      gradient: "from-sky-400 to-blue-600",
    },
    {
      label: "Fulfilled",
      value: statusCounts.fulfilled,
      sub: "Includes refunded",
      icon: ArchiveRestore,
      gradient: "from-emerald-400 to-teal-500",
    },
  ]

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#141EAE] via-[#4427CA] to-[#7C3AED] px-6 py-6 text-white shadow-xl ring-1 ring-indigo-500/30">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs tracking-[0.2em] text-white/70">HEAD OFFICE · ORDERS</p>
            <h1 className="text-3xl font-semibold">Order intelligence overview</h1>
            <p className="text-sm text-white/80">
              Manage approvals and fulfillment pipelines across {scopeText.toLowerCase()}.
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

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => {
          const Icon = card.icon
          return (
            <Card key={card.label} className="rounded-2xl border-0 p-4 shadow-md">
              <div className={`mb-3 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br ${card.gradient} text-white shadow-inner`}>
                <Icon className="h-5 w-5" />
              </div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{card.label}</p>
              <p className="text-3xl font-semibold text-slate-900">{card.value}</p>
              <p className="text-sm text-muted-foreground">{card.sub}</p>
            </Card>
          )
        })}
      </div>

      <Card className="flex flex-col gap-3 border-dashed border-slate-300/70 bg-gradient-to-r from-slate-50 to-white p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <Clock className="h-4 w-4 text-amber-600" />
          Auto-approval safety net
        </div>
        <p className="text-sm text-muted-foreground">
          Pending orders are automatically approved after 2 hours to keep branches moving. Review aging requests here if you
          need to intervene before the timer elapses.
        </p>
      </Card>

      {/* Filters */}
      <Card className="p-4 space-y-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-semibold">Filters</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by TID, Order ID, or Branch..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="flex gap-2 flex-wrap">
            {["all", "pending", "approved", "fulfilled"].map((status) => (
              <Button
                key={status}
                onClick={() => setStatusFilter(status)}
                variant={statusFilter === status ? "default" : "outline"}
                size="sm"
                className="capitalize"
              >
                {status}
              </Button>
            ))}
          </div>
        </div>
      </Card>

      {/* Orders Table */}
      <Card className="overflow-hidden">
        {filteredOrders.length === 0 ? (
          <div className="p-8 text-center">
            <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <p className="text-muted-foreground">No orders found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b bg-slate-50 dark:bg-slate-900">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold">TID</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Branch</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Amount</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Date</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredOrders.map((order: OrderItem) => {
                  const statusInfo = getStatusColor(order.status)
                  const StatusIcon = statusInfo.icon

                  return (
                    <tr key={order.id} className="hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-white">{order.tid}</p>
                          <p className="text-xs text-muted-foreground">ID: {order.id}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-slate-900 dark:text-white">
                          {order.branchName || `Branch ${order.branchId}`}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={`${statusInfo.bg} ${statusInfo.text} border-0`}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {order.status}
                        </Badge>
                        {order.status.toLowerCase() === "pending" && (
                          <p className="mt-1 text-xs text-amber-600">{getAutoApprovalCountdown(order)}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-bold text-slate-900 dark:text-white">
                          {formatPKR(order.totalCents / 100)}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {new Date(order.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Button asChild variant="ghost" size="sm" className="gap-1">
                            <Link href={`/head-office-orders/${order.id}`}>
                              <Eye className="h-4 w-4" />
                              View
                            </Link>
                          </Button>

                          {order.status.toLowerCase() === "pending" && (
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

      {/* Order Detail Dialog removed in favour of dedicated pages */}

      {/* Approval Dialog */}
      <Dialog open={showApprovalDialog} onOpenChange={setShowApprovalDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Approve Order</DialogTitle>
            <DialogDescription>
              Are you sure you want to approve this order?
            </DialogDescription>
          </DialogHeader>

          {selectedOrder && (
            <div className="space-y-3">
              <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                <p className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-1">Order TID</p>
                <p className="font-mono text-blue-700 dark:text-blue-400">{selectedOrder.tid}</p>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
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
              {isProcessing ? "Approving..." : "Approve Order"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rejection Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reject Order</DialogTitle>
            <DialogDescription>
              Provide a reason for rejecting this order
            </DialogDescription>
          </DialogHeader>

          {selectedOrder && (
            <div className="space-y-4">
              <div className="p-3 bg-red-50 dark:bg-red-950 rounded-lg border border-red-200 dark:border-red-800">
                <p className="text-sm font-semibold text-red-900 dark:text-red-300 mb-1">Order TID</p>
                <p className="font-mono text-red-700 dark:text-red-400">{selectedOrder.tid}</p>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Rejection Reason</label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Explain why this order is being rejected..."
                  className="w-full p-3 border rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white min-h-24"
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
              {isProcessing ? "Rejecting..." : "Reject Order"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
