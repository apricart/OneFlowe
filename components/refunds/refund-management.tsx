"use client"
import React, { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useToast } from "@/components/ui/use-toast"
import { DollarSign, RefreshCw, AlertTriangle, Clock, User, Plus, Check, ArrowDownToLine } from "lucide-react"
import useSWR from "swr"
import { formatPKR } from "@/lib/utils"
import { Progress } from "@/components/ui/progress"

interface Refund {
  id: number
  amountCents: number
  reason: string | null
  createdAt: string
  processedByUserId: string
  processedByUser: {
    email: string
    fullName: string | null
  }
}

interface RefundManagementProps {
  orderId: number
  orderTotalCents: number
  orderStatus: string
  onRefundSuccess?: () => void
  className?: string
}

const fetcher = (url: string) => fetch(url).then(r => r.json())

export function RefundManagement({ 
  orderId, 
  orderTotalCents, 
  orderStatus, 
  onRefundSuccess,
  className = ""
}: RefundManagementProps) {
  const { toast } = useToast()
  const [showRefundDialog, setShowRefundDialog] = useState(false)
  const [refundAmount, setRefundAmount] = useState("")
  const [refundReason, setRefundReason] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)

  // Fetch refunds for this order
  const { data: refundsData, mutate: mutateRefunds } = useSWR(
    `/api/v1/orders/${orderId}/refunds`,
    fetcher
  )

  const refunds: Refund[] = refundsData?.refunds || []
  const totalRefundedCents = refunds.reduce((sum, refund) => sum + refund.amountCents, 0)
  const remainingAmountCents = orderTotalCents - totalRefundedCents
  const canRefund = orderStatus === "fulfilled" && remainingAmountCents > 0
  const refundedPercent = Math.min(100, Math.round((totalRefundedCents / orderTotalCents) * 100))

  const refundState = useMemo(() => {
    if (totalRefundedCents === 0) {
      return { label: "No refunds processed", tone: "text-slate-600", badge: "Pending" }
    }
    if (remainingAmountCents > 0) {
      return { label: "Partially refunded", tone: "text-amber-600", badge: "In progress" }
    }
    return { label: "Fully refunded", tone: "text-emerald-600", badge: "Complete" }
  }, [remainingAmountCents, totalRefundedCents])

  const handleRefund = async () => {
    if (!refundAmount || parseFloat(refundAmount) <= 0) {
      toast({ title: "Error", description: "Please enter a valid refund amount", variant: "destructive" })
      return
    }

    const amountCents = Math.round(parseFloat(refundAmount) * 100)
    
    if (amountCents > remainingAmountCents) {
      toast({ title: "Error", description: "Refund amount cannot exceed remaining order amount", variant: "destructive" })
      return
    }

    setIsProcessing(true)
    try {
      const response = await fetch(`/api/v1/orders/${orderId}/refunds`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountCents,
          reason: refundReason.trim() || null
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to process refund")
      }

      toast({ title: "Success", description: "Refund processed successfully" })
      setShowRefundDialog(false)
      setRefundAmount("")
      setRefundReason("")
      mutateRefunds()
      onRefundSuccess?.()
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } finally {
      setIsProcessing(false)
    }
  }

  const formatCurrency = (cents: number) => formatPKR(cents / 100)

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    })
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Refund Summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Refund Management
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3 rounded-2xl border bg-muted/30 p-4">
              <div className="flex items-center justify-between text-xs uppercase tracking-wide text-muted-foreground">
                <span>Order total</span>
                <span>{formatCurrency(orderTotalCents)}</span>
              </div>
              <Progress value={refundedPercent} className="h-2" />
              <div className="flex items-center justify-between text-sm">
                <div>
                  <p className="text-muted-foreground">Refunded</p>
                  <p className="font-semibold text-emerald-600">{formatCurrency(totalRefundedCents)}</p>
                </div>
                <div className="text-right">
                  <p className="text-muted-foreground">Remaining</p>
                  <p className="font-semibold text-amber-600">{formatCurrency(remainingAmountCents)}</p>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Refund status</p>
                  <p className={`text-lg font-semibold ${refundState.tone}`}>{refundState.label}</p>
                </div>
                <Badge variant="outline" className="uppercase tracking-wide">{refundState.badge}</Badge>
              </div>
              <div className="mt-4 text-xs text-muted-foreground">
                Head office can log refunds with internal notes for audit tracking.
              </div>
            </div>
          </div>

          {/* Status Alert */}
          {!canRefund && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {orderStatus !== "fulfilled" 
                  ? "Refunds can only be processed for fulfilled orders"
                  : "This order has been fully refunded"
                }
              </AlertDescription>
            </Alert>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => setShowRefundDialog(true)}
              disabled={!canRefund}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Process refund
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-1 text-muted-foreground"
              onClick={() => mutateRefunds()}
            >
              <RefreshCw className="h-4 w-4" />
              Refresh log
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Refund Timeline */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Refund timeline</CardTitle>
          <p className="text-sm text-muted-foreground">Track actions, notes, and processors in one view.</p>
        </CardHeader>
        <CardContent className="space-y-4 max-h-[360px] overflow-y-auto pr-1">
          {refunds.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              No refunds logged for this order yet.
            </div>
          ) : (
            <ol className="space-y-4">
              {refunds.map((refund, index) => {
                const isLast = index === refunds.length - 1
                return (
                  <li key={refund.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-600">
                        <Check className="h-4 w-4" />
                      </div>
                      {!isLast && <div className="h-full w-px bg-border" />}
                    </div>
                    <div className="flex-1 rounded-2xl border p-4 shadow-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                            Processed
                          </Badge>
                          <p className="text-base font-semibold text-slate-900 dark:text-white">
                            {formatCurrency(refund.amountCents)}
                          </p>
                        </div>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDate(refund.createdAt)}
                        </span>
                      </div>
                      {refund.reason && (
                        <p className="mt-2 text-sm text-muted-foreground">
                          <span className="font-medium text-slate-900 dark:text-white">Notes:</span> {refund.reason}
                        </p>
                      )}
                      <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                        <User className="h-3 w-3" />
                        {refund.processedByUser.fullName || refund.processedByUser.email}
                      </div>
                    </div>
                  </li>
                )
              })}
            </ol>
          )}
        </CardContent>
      </Card>

      {/* Refund Dialog */}
      <Dialog open={showRefundDialog} onOpenChange={setShowRefundDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Process Refund</DialogTitle>
            <DialogDescription>
              Enter the refund amount and reason for this order.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="refundAmount">Refund Amount</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="refundAmount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={remainingAmountCents / 100}
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                  className="pl-9"
                  placeholder="0.00"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Maximum: {formatCurrency(remainingAmountCents)}
              </p>
            </div>

            <div>
              <Label htmlFor="refundReason">Internal notes</Label>
              <Textarea
                id="refundReason"
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                placeholder="Share context for finance & audit teams..."
                className="min-h-20"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowRefundDialog(false)}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button onClick={handleRefund} disabled={isProcessing || !refundAmount} className="gap-2">
              {isProcessing ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <ArrowDownToLine className="h-4 w-4" />
                  Log refund
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
