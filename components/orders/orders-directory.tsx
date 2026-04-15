"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Package,
  CheckCircle,
  XCircle,
  TrendingDown,
  Clock,
  LayoutGrid,
  List,
  MapPin,
  Building2,
  Calendar as CalendarIcon,
  Check,
  X,
  CreditCard,
  Building,
  AlertTriangle,
  Receipt,
  FileCheck
} from "lucide-react"
import { format } from "date-fns"
import { toast } from "@/hooks/use-toast"
import { cn, formatPKR } from "@/lib/utils"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { ReceiptIconButton } from "@/components/receipts/receipt-icon-button"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Save } from "lucide-react"

type OrderItem = any // Avoiding strict type definition for speed, will rely on usage
type OrdersDirectoryProps = {
  orders: OrderItem[]
  userRole: string | undefined
  isSuperAdmin: boolean
  isBranchAdmin: boolean
  isHeadOffice?: boolean
  onUpdate: () => void
}

export function OrdersDirectory({
  orders,
  userRole,
  isSuperAdmin,
  isBranchAdmin,
  isHeadOffice,
  onUpdate
}: OrdersDirectoryProps) {
  const [viewMode, setViewMode] = useState<"grid" | "table">("table")
  const [viewingOrder, setViewingOrder] = useState<OrderItem | null>(null)

  // Modals for actions
  const [actionType, setActionType] = useState<"approve" | "reject" | "fulfill" | null>(null)
  const [generatedToken, setGeneratedToken] = useState<string | null>(null)
  const [showTokenDialog, setShowTokenDialog] = useState(false)
  const [rejectReason, setRejectReason] = useState("")
  const [fulfillToken, setFulfillToken] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)

  // Helpers
  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "refunded": return { bg: "bg-amber-500/10 dark:bg-amber-500/20", text: "text-amber-600 dark:text-amber-400", border: "border-amber-200 dark:border-amber-800", icon: <TrendingDown className="h-4 w-4" /> }
      case "fulfilled": return { bg: "bg-emerald-500/10 dark:bg-emerald-500/20", text: "text-emerald-600 dark:text-emerald-400", border: "border-emerald-200 dark:border-emerald-800", icon: <CheckCircle className="h-4 w-4" /> }
      case "approved": return { bg: "bg-blue-500/10 dark:bg-blue-500/20", text: "text-blue-600 dark:text-blue-400", border: "border-blue-200 dark:border-blue-800", icon: <FileCheck className="h-4 w-4" /> }
      case "pending": return { bg: "bg-slate-100 dark:bg-slate-800", text: "text-slate-600 dark:text-slate-300", border: "border-slate-200 dark:border-slate-700", icon: <Clock className="h-4 w-4" /> }
      case "rejected": return { bg: "bg-rose-500/10 dark:bg-rose-500/20", text: "text-rose-600 dark:text-rose-400", border: "border-rose-200 dark:border-rose-800", icon: <XCircle className="h-4 w-4" /> }
      default: return { bg: "bg-slate-100", text: "text-slate-600", border: "border-slate-200", icon: <Package className="h-4 w-4" /> }
    }
  }

  // Handlers
  const executeAction = async () => {
    if (!viewingOrder || !actionType) return

    setIsProcessing(true)
    try {
      let endpoint = ""
      let payload: any = {}

      if (actionType === "approve") {
        endpoint = `/api/v1/orders/${viewingOrder.id}/approve`
      } else if (actionType === "reject") {
        endpoint = `/api/v1/orders/${viewingOrder.id}/reject`
        payload = { reason: rejectReason }
      } else if (actionType === "fulfill") {
        if (!fulfillToken) throw new Error("Fulfillment token is required")
        endpoint = `/api/v1/orders/${viewingOrder.id}/fulfill`
        payload = { approvalToken: fulfillToken }
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: Object.keys(payload).length > 0 ? JSON.stringify(payload) : undefined
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Action failed")

      if (actionType === "approve" && data.approvalToken) {
        setGeneratedToken(data.approvalToken)
        setShowTokenDialog(true)
      }

      toast({
        title: "Success",
        description: `Order successfully ${actionType}ed.`,
      })
      
      setActionType(null)
      if (actionType !== "approve") {
        setViewingOrder(null)
      }
      setRejectReason("")
      setFulfillToken("")
      onUpdate()

    } catch (err: any) {
      toast({
        title: "Action Failed",
        description: err.message,
        variant: "destructive"
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleUpdateDeliveryStatus = async (orderId: number, status: string) => {
    setIsProcessing(true)
    try {
      const res = await fetch("/api/v1/orders", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: orderId,
          action: "update_delivery",
          deliveryStatus: status
        })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to update delivery status")

      toast({
        title: "Success",
        description: "Delivery status updated successfully",
      })
      onUpdate()
    } catch (err: any) {
      toast({
        title: "Update Failed",
        description: err.message,
        variant: "destructive"
      })
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Directory Tools */}
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-2 text-sm text-slate-500 font-medium">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-white dark:bg-slate-800 text-[10px] shadow-sm text-slate-600 dark:text-slate-400">
            {orders.length}
          </span>
          <span>Orders visible</span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1 rounded-xl shadow-sm flex items-center gap-1">
          <Button
            variant={viewMode === "grid" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setViewMode("grid")}
            className={cn("h-8 gap-2 rounded-lg text-[11px] font-bold px-3 transition-all", viewMode === "grid" ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-400" : "text-slate-500 hover:text-slate-900")}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            Grid
          </Button>
          <Button
            variant={viewMode === "table" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setViewMode("table")}
            className={cn("h-8 gap-2 rounded-lg text-[11px] font-bold px-3 transition-all", viewMode === "table" ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-400" : "text-slate-500 hover:text-slate-900")}
          >
            <List className="h-3.5 w-3.5" />
            Table
          </Button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {viewMode === "grid" ? (
          <motion.div
            key="grid"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
          >
            {orders.map((order, idx) => {
              const statusColors = getStatusColor(order.status)
              return (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: idx * 0.03 }}
                  key={order.id}
                  onClick={() => setViewingOrder(order)}
                  className="group relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer overflow-hidden"
                >
                  {/* Subtle Background Accent */}
                  <div className={cn("absolute top-0 right-0 w-32 h-32 blur-3xl rounded-full opacity-20 -translate-y-1/2 translate-x-1/2 transition-opacity group-hover:opacity-40", statusColors.bg.split(' ')[0])} />
                  
                  <div className="flex justify-between items-start mb-4 relative z-10">
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">TID</p>
                      <p className="font-mono text-sm font-bold text-slate-800 dark:text-slate-100">{order.tid}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Badge variant="outline" className={cn("rounded-lg px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border", statusColors.bg, statusColors.text, statusColors.border)}>
                        {order.status}
                      </Badge>
                      {order.deliveryStatus && (
                        <Badge variant="secondary" className="text-[9px] font-bold uppercase px-1.5 py-0">
                          {order.deliveryStatus}
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3 relative z-10">
                    <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                      <Building2 className="h-4 w-4 opacity-70 text-indigo-500" />
                      <span className="truncate font-medium">{order.branchName || `#${order.branchId}`}</span>
                    </div>
                    
                    <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                      <CalendarIcon className="h-4 w-4 opacity-70 text-blue-500" />
                      <span className="truncate font-medium">{format(new Date(order.createdAt), "dd MMM yyyy, p")}</span>
                    </div>
                  </div>

                  <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between relative z-10">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total</p>
                    <p className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                      {formatPKR(order.totalCents / 100)}
                    </p>
                  </div>
                </motion.div>
              )
            })}
          </motion.div>
        ) : (
          <motion.div
            key="table"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm"
          >
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  <th className="text-left font-bold py-4 pl-6">TID</th>
                  <th className="text-left font-bold py-4">Branch</th>
                  <th className="text-left font-bold py-4">Status</th>
                  <th className="text-left font-bold py-4">Delivery</th>
                  <th className="text-left font-bold py-4">Date</th>
                  <th className="text-right font-bold py-4 pr-6">Amount</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order, idx) => {
                  const statusColors = getStatusColor(order.status)
                  return (
                    <motion.tr
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.02 }}
                      key={order.id}
                      onClick={() => setViewingOrder(order)}
                      className="group border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50/80 dark:hover:bg-slate-800/30 cursor-pointer transition-colors"
                    >
                      <td className="py-4 pl-6">
                        <span className="font-mono text-xs font-bold text-slate-700 dark:text-slate-300 group-hover:text-indigo-600 transition-colors uppercase tracking-wider">{order.tid}</span>
                      </td>
                      <td className="py-4">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-3.5 w-3.5 opacity-60 text-indigo-500" />
                          <span className="font-medium text-slate-600 dark:text-slate-400">{order.branchName || `#${order.branchId}`}</span>
                        </div>
                      </td>
                      <td className="py-4">
                        <Badge variant="outline" className={cn("px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider rounded-lg border", statusColors.bg, statusColors.text, statusColors.border)}>
                          {order.status}
                        </Badge>
                      </td>
                      <td className="py-4" onClick={(e) => e.stopPropagation()}>
                        {isSuperAdmin ? (
                          <Select
                            disabled={isProcessing}
                            defaultValue={order.deliveryStatus || ""}
                            onValueChange={(val) => handleUpdateDeliveryStatus(order.id, val)}
                          >
                            <SelectTrigger className="h-8 w-[140px] text-[11px] font-bold bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
                              <SelectValue placeholder="Update Status" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Confirmed">Confirmed</SelectItem>
                              <SelectItem value="InProcess">In Process</SelectItem>
                              <SelectItem value="Out For Delivery">Out For Delivery</SelectItem>
                              <SelectItem value="Delivered">Delivered</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className="text-[11px] font-bold text-slate-500 uppercase">
                            {order.deliveryStatus || "---"}
                          </span>
                        )}
                      </td>
                      <td className="py-4 font-medium text-slate-500 text-xs">
                        {format(new Date(order.createdAt), "dd MMM yyyy")}
                      </td>
                      <td className="py-4 pr-6 text-right font-bold text-slate-800 dark:text-slate-200">
                        {formatPKR(order.totalCents / 100)}
                      </td>
                    </motion.tr>
                  )
                })}
              </tbody>
            </table>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Spatial Detail Drawer (Order Action Sheet) - Adorable Theme */}
      <Sheet open={!!viewingOrder && !actionType} onOpenChange={(open) => !open && setViewingOrder(null)}>
        <SheetContent className="w-full sm:max-w-md border-l-0 shadow-[0_0_50px_rgba(0,0,0,0.1)] p-0 bg-[#fdfdfd] dark:bg-[#0b0f19] overflow-y-auto">
          {viewingOrder && (
            <div className="flex flex-col h-full font-sans">
              {/* Cute Header Section */}
              <div className="p-6 md:p-8 bg-gradient-to-br from-indigo-50/80 to-purple-50/50 dark:from-indigo-950/20 dark:to-purple-950/10 border-b border-indigo-100/50 dark:border-indigo-900/30 rounded-b-[2.5rem] relative overflow-hidden shrink-0">
                {/* Decorative Blobs */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-pink-300/20 dark:bg-pink-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-40 h-40 bg-blue-300/20 dark:bg-blue-500/10 rounded-full blur-2xl translate-y-1/2 -translate-x-1/4 pointer-events-none" />
                
                <div className="flex justify-between items-start mb-6 relative z-10">
                  <div className="flex items-center gap-4">
                    <div className="h-14 w-14 rounded-[1.2rem] bg-indigo-100/80 dark:bg-indigo-900/40 border border-white/50 dark:border-indigo-800/30 flex items-center justify-center text-indigo-500 dark:text-indigo-400 shadow-sm backdrop-blur-sm -rotate-3 transition-transform hover:rotate-0">
                      <Package className="h-7 w-7 stroke-[1.5]" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-indigo-400/80 dark:text-indigo-500 uppercase tracking-widest mb-0.5">Order ID</p>
                      <h2 className="font-mono text-xl font-black text-slate-800 dark:text-slate-100 tracking-wider">
                        {viewingOrder.tid}
                      </h2>
                    </div>
                  </div>
                  {(() => {
                    const c = getStatusColor(viewingOrder.status)
                    return (
                      <Badge variant="outline" className={cn("px-3 py-1 text-[10px] font-bold tracking-widest uppercase rounded-xl border-dashed shadow-sm backdrop-blur-sm", c.bg, c.text, c.border)}>
                        {viewingOrder.status}
                      </Badge>
                    )
                  })()}
                </div>

                <div className="bg-white/60 dark:bg-slate-900/40 backdrop-blur-md border border-white dark:border-slate-800 p-4 rounded-3xl shadow-[0_4px_20px_rgb(0,0,0,0.03)] grid grid-cols-2 gap-4 relative z-10">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1">
                      <CreditCard className="h-3 w-3" /> Total
                    </p>
                    <p className="text-xl font-black text-slate-900 dark:text-white tracking-tight">{formatPKR(viewingOrder.totalCents / 100)}</p>
                  </div>
                  <div className="space-y-1 text-right">
                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center justify-end gap-1">
                      <CalendarIcon className="h-3 w-3" /> Date
                    </p>
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{format(new Date(viewingOrder.createdAt), "dd MMM yyyy")}</p>
                    <p className="text-[10px] font-semibold text-slate-400">{format(new Date(viewingOrder.createdAt), "p")}</p>
                  </div>
                </div>
              </div>

              {/* Body */}
              <div className="flex-1 p-6 space-y-5">
                <div className="space-y-3">
                  <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 pl-2">
                    <MapPin className="h-3.5 w-3.5" />
                    Details
                  </h3>
                  <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 p-5 rounded-[2rem] space-y-4">
                    {isSuperAdmin && (
                      <div className="flex items-center justify-between group">
                        <span className="text-xs font-semibold text-slate-500 flex items-center gap-1.5"><Building className="h-3.5 w-3.5" /> Org</span>
                        <span className="text-sm font-bold text-slate-800 dark:text-slate-200 transition-colors group-hover:text-indigo-500">{viewingOrder.organizationName || `#${viewingOrder.organizationId}`}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between group">
                      <span className="text-xs font-semibold text-slate-500 flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" /> Branch</span>
                      <span className="text-sm font-bold text-slate-800 dark:text-slate-200 transition-colors group-hover:text-indigo-500">{viewingOrder.branchName || `#${viewingOrder.branchId}`}</span>
                    </div>
                  </div>
                </div>

                {viewingOrder.rejectionReason && (
                  <div className="p-5 rounded-[2rem] bg-rose-50/50 border border-rose-100 dark:bg-rose-950/20 dark:border-rose-900/30">
                    <div className="flex items-center gap-2 mb-2 text-rose-500">
                      <AlertTriangle className="h-4 w-4" />
                      <h4 className="text-[11px] font-bold uppercase tracking-wider">Rejection Reason</h4>
                    </div>
                    <p className="text-sm text-rose-700 dark:text-rose-300 font-medium leading-relaxed">{viewingOrder.rejectionReason}</p>
                  </div>
                )}
              </div>

              {/* Cute Action Footer */}
              <div className="p-6 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-t border-slate-100 dark:border-slate-800 rounded-t-[2.5rem] mt-auto shrink-0 space-y-3 pb-safe">
                <div className="flex bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 h-14 rounded-2xl justify-center items-center border border-dashed border-slate-200 dark:border-slate-700 transition-colors">
                  <ReceiptIconButton orderId={viewingOrder.id} />
                </div>
                
                <div className="flex gap-3">
                  {/* Only BRANCH_ADMIN can approve/reject orders */}
                  {viewingOrder.status.toLowerCase() === "pending" && isBranchAdmin && (
                    <>
                      <Button onClick={() => setActionType("reject")} variant="outline" className="flex-1 h-12 rounded-xl text-rose-600 border-rose-200 hover:bg-rose-50 dark:hover:bg-rose-900/20 dark:border-rose-800">
                        Reject
                      </Button>
                      <Button onClick={() => setActionType("approve")} className="flex-1 h-12 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-lg shadow-emerald-600/20">
                        Approve
                      </Button>
                    </>
                  )}

                  {viewingOrder.status.toLowerCase() === "approved" && isSuperAdmin && (
                    <Button onClick={() => setActionType("fulfill")} className="w-full h-12 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-lg shadow-indigo-600/20">
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Fulfill Order
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Action Dialogs (Replacing the old ones) */}
      <Dialog open={!!actionType} onOpenChange={(open) => !open && setActionType(null)}>
        <DialogContent className="max-w-md border-0 shadow-2xl bg-white/90 dark:bg-slate-900/95 backdrop-blur-xl rounded-[2rem]">
          <DialogHeader>
            <DialogTitle className="text-xl font-black tracking-tight flex items-center gap-2 capitalize">
              {actionType === 'reject' && <XCircle className="text-rose-500 h-6 w-6" />}
              {actionType === 'approve' && <CheckCircle className="text-emerald-500 h-6 w-6" />}
              {actionType === 'fulfill' && <Package className="text-indigo-500 h-6 w-6" />}
              {actionType} Order
            </DialogTitle>
          </DialogHeader>

          <div className="py-4">
            {actionType === "reject" && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-500">Please provide a reason for rejecting TID {viewingOrder?.tid}:</p>
                <Input
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="e.g. Budget constraints"
                  className="h-12 rounded-xl border-slate-200 bg-white"
                  autoFocus
                />
              </div>
            )}
            {actionType === "approve" && (
              <p className="text-sm font-medium text-slate-500">Are you sure you want to approve TID {viewingOrder?.tid}? This will notify Head Office.</p>
            )}
            {actionType === "fulfill" && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800">
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-400">
                    Enter the Approval Token provided by the Branch Admin to verify this fulfillment.
                  </p>
                </div>
                <Input
                  value={fulfillToken}
                  onChange={(e) => setFulfillToken(e.target.value)}
                  placeholder="e.g. A1B2C3D4"
                  className="h-14 font-mono text-center text-lg tracking-widest font-bold uppercase rounded-xl border-indigo-200 shadow-inner"
                  autoFocus
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setActionType(null)} disabled={isProcessing} className="h-11 rounded-xl">Cancel</Button>
            <Button 
              onClick={executeAction} 
              disabled={isProcessing || (actionType === 'reject' && !rejectReason) || (actionType === 'fulfill' && !fulfillToken)}
              className={cn("h-11 rounded-xl font-bold px-6 text-white shadow-lg", 
                actionType === 'reject' ? "bg-rose-600 hover:bg-rose-500 shadow-rose-600/20" : 
                actionType === 'approve' ? "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20" : 
                "bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/20"
              )}
            >
              {isProcessing ? "Processing..." : `Confirm ${actionType}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approval Token Display (Shown only once after approval) */}
      <Dialog open={showTokenDialog} onOpenChange={(open) => {
        if (!open) {
          setShowTokenDialog(false)
          setViewingOrder(null)
          setGeneratedToken(null)
        }
      }}>
        <DialogContent className="max-w-md border-0 shadow-2xl bg-indigo-600 text-white rounded-[2rem] overflow-hidden p-0">
          <div className="p-8 space-y-6 relative">
            <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-white/10 rounded-full blur-3xl pointer-events-none" />
            
            <div className="text-center space-y-2 relative z-10">
              <div className="h-16 w-16 bg-white/20 backdrop-blur-xl rounded-2xl flex items-center justify-center mx-auto mb-4 border border-white/30">
                <CheckCircle className="h-10 w-10 text-white" />
              </div>
              <DialogTitle className="text-2xl font-black tracking-tight text-white">Order Approved!</DialogTitle>
              <p className="text-indigo-100 font-medium">Please share this token with Head Office for fulfillment.</p>
            </div>

            <div className="bg-white/10 backdrop-blur-xl border border-white/20 p-6 rounded-3xl space-y-4 text-center relative z-10">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-200">Secure Approval Token</p>
              <div className="text-4xl font-mono font-black tracking-[0.3em] select-all py-2">{generatedToken}</div>
              <p className="text-xs font-bold text-indigo-200/80 italic">⚠️ This token will not be shown again. Please copy it now.</p>
            </div>

            <Button 
              onClick={() => {
                setShowTokenDialog(false)
                setViewingOrder(null)
                setGeneratedToken(null)
              }}
              className="w-full h-14 rounded-2xl bg-white text-indigo-600 hover:bg-indigo-50 font-black text-lg shadow-xl shadow-black/10 transition-all active:scale-95"
            >
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
