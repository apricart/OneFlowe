"use client"
import React, { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useToast } from "@/components/ui/use-toast"
import { 
  DollarSign, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle, 
  Clock,
  User,
  Calendar,
  FileText,
  Plus,
  Eye
} from "lucide-react"
import useSWR from "swr"
import { formatPKR } from "@/lib/utils"

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
  const [showRefundHistory, setShowRefundHistory] = useState(false)
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
              <p className="text-sm text-muted-foreground">Order Total</p>
              <p className="text-xl font-bold text-slate-900 dark:text-white">
                {formatCurrency(orderTotalCents)}
              </p>
            </div>
            <div className="text-center p-3 bg-red-50 dark:bg-red-950 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">Total Refunded</p>
              <p className="text-xl font-bold text-red-700 dark:text-red-300">
                {formatCurrency(totalRefundedCents)}
              </p>
            </div>
            <div className="text-center p-3 bg-green-50 dark:bg-green-950 rounded-lg">
              <p className="text-sm text-green-600 dark:text-green-400">Remaining</p>
              <p className="text-xl font-bold text-green-700 dark:text-green-300">
                {formatCurrency(remainingAmountCents)}
              </p>
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
          <div className="flex gap-2">
            <Button
              onClick={() => setShowRefundDialog(true)}
              disabled={!canRefund}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Process Refund
            </Button>
            <Button
              onClick={() => setShowRefundHistory(true)}
              variant="outline"
              className="gap-2"
            >
              <Eye className="h-4 w-4" />
              View History
            </Button>
          </div>
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
              <Label htmlFor="refundReason">Reason (Optional)</Label>
              <Textarea
                id="refundReason"
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                placeholder="Enter reason for refund..."
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
            <Button
              onClick={handleRefund}
              disabled={isProcessing || !refundAmount}
              className="gap-2"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <DollarSign className="h-4 w-4" />
                  Process Refund
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Refund History Dialog */}
      <Dialog open={showRefundHistory} onOpenChange={setShowRefundHistory}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Refund History</DialogTitle>
            <DialogDescription>
              All refunds processed for this order.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 max-h-96 overflow-y-auto">
            {refunds.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No refunds processed yet</p>
              </div>
            ) : (
              refunds.map((refund) => (
                <Card key={refund.id} className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Refunded
                        </Badge>
                        <span className="text-lg font-bold text-slate-900 dark:text-white">
                          {formatCurrency(refund.amountCents)}
                        </span>
                      </div>
                      
                      {refund.reason && (
                        <p className="text-sm text-muted-foreground">
                          <strong>Reason:</strong> {refund.reason}
                        </p>
                      )}
                      
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {refund.processedByUser.fullName || refund.processedByUser.email}
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDate(refund.createdAt)}
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>

          <DialogFooter>
            <Button onClick={() => setShowRefundHistory(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
