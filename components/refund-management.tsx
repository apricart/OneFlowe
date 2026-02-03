"use client"

import { useState, useMemo } from "react"
import useSWR from "swr"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle, TrendingDown, Clock, CheckCircle, Ban } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"

interface RefundManagementProps {
    orderId: number
    orderTotalCents: number
    orderStatus: string
    createdAt: string // Order creation date for refund window validation
    refundAmountCents?: number | null
    refundedAt?: string | null
    refundReason?: string | null
    onRefundSuccess?: () => void
}

const fetcher = (url: string) => fetch(url).then(r => r.json())

export function RefundManagement({
    orderId,
    orderTotalCents,
    orderStatus,
    createdAt,
    refundAmountCents,
    refundedAt,
    refundReason,
    onRefundSuccess
}: RefundManagementProps) {
    const { toast } = useToast()
    const [reason, setReason] = useState("")
    const [processing, setProcessing] = useState(false)
    const [showForm, setShowForm] = useState(false)

    // Validate refund window (must be same month/year)
    // "it can only make request wihtnig that mo th"
    const isWithinRefundWindow = useMemo(() => {
        if (!createdAt) return false
        const orderDate = new Date(createdAt)
        const now = new Date()
        return orderDate.getMonth() === now.getMonth() && orderDate.getFullYear() === now.getFullYear()
    }, [createdAt])

    // Track selected items and their quantities: { itemId: quantity }
    const [selectedItems, setSelectedItems] = useState<Record<number, number>>({})

    const { data: refundsData, mutate: mutateRefunds } = useSWR(`/api/v1/orders/${orderId}/refunds`, fetcher)
    const { data: orderData } = useSWR(showForm ? `/api/v1/orders?id=${orderId}` : null, fetcher)

    // Extract items from order API response
    const orderItems = useMemo(() => {
        if (orderData?.items?.[0]?.orderItems) {
            return orderData.items[0].orderItems
        }
        return []
    }, [orderData])

    // Use API data if available, otherwise construct from order props if refunded
    const apiRefunds = refundsData?.refunds || []

    const effectiveRefunds = apiRefunds.length > 0 ? apiRefunds :
        (refundAmountCents && refundAmountCents > 0) ? [{
            id: 'legacy',
            amountCents: refundAmountCents,
            reason: refundReason || "Refunded externally",
            status: 'APPROVED',
            createdAt: refundedAt || new Date().toISOString(),
            processedByUser: { fullName: 'Admin' }
        }] : []

    const totalRefunded = effectiveRefunds
        .filter((r: any) => r.status !== 'REJECTED')
        .reduce((sum: number, r: any) => sum + (r.amountCents || 0), 0)

    const remainingRefundable = Math.max(0, orderTotalCents - totalRefunded)
    const isFullyRefunded = remainingRefundable === 0
    const hasPendingRefunds = effectiveRefunds.some((r: any) => r.status === 'PENDING')

    const canRefund = ["APPROVED", "FULFILLED", "REFUNDED"].includes(orderStatus.toUpperCase()) && remainingRefundable > 0 && isWithinRefundWindow

    // Calculate previously refunded quantities per item
    const refundedQuantities = useMemo(() => {
        const quantities: Record<number, number> = {}
        effectiveRefunds.forEach((refund: any) => {
            if (refund.status === 'REJECTED') return
            if (refund.items && Array.isArray(refund.items)) {
                refund.items.forEach((item: any) => {
                    quantities[item.orderItemId] = (quantities[item.orderItemId] || 0) + item.quantity
                })
            }
        })
        return quantities
    }, [effectiveRefunds])

    const handleItemToggle = (itemId: number, maxRefundableQty: number) => {
        setSelectedItems(prev => {
            const next = { ...prev }
            if (next[itemId]) {
                delete next[itemId]
            } else {
                next[itemId] = maxRefundableQty // Default to max available quantity
            }
            return next
        })
    }

    const handleQuantityChange = (itemId: number, qty: number, maxRefundableQty: number) => {
        if (qty < 1) qty = 1
        if (qty > maxRefundableQty) qty = maxRefundableQty
        setSelectedItems(prev => ({ ...prev, [itemId]: qty }))
    }

    // Detect legacy refunds (amount-based only)
    const legacyRefundAmount = useMemo(() => {
        let trackedAmount = 0
        effectiveRefunds.forEach((r: any) => {
            if (r.status === 'REJECTED') return
            if (r.items && Array.isArray(r.items)) {
                trackedAmount += r.items.reduce((sum: number, i: any) => sum + i.amountCents, 0)
            }
        })
        return Math.max(0, totalRefunded - trackedAmount)
    }, [effectiveRefunds, totalRefunded])

    // Calculate total amount for selected items
    const selectedRefundAmount = useMemo(() => {
        return orderItems.reduce((total: number, item: any) => {
            const qty = selectedItems[item.id] || 0
            return total + (item.priceCents * qty)
        }, 0)
    }, [orderItems, selectedItems])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (Object.keys(selectedItems).length === 0) {
            toast({ title: "No items selected", description: "Please select at least one item to refund", variant: "destructive" })
            return
        }

        if (selectedRefundAmount > remainingRefundable) {
            toast({
                title: "Amount exceeds limit",
                description: `Total refund amount (PKR ${(selectedRefundAmount / 100).toFixed(2)}) exceeds remaining refundable amount (PKR ${(remainingRefundable / 100).toFixed(2)})`,
                variant: "destructive"
            })
            return
        }

        setProcessing(true)
        try {
            const itemsPayload = Object.entries(selectedItems).map(([id, qty]) => ({
                id: Number(id),
                quantity: qty
            }))

            const res = await fetch(`/api/v1/orders/${orderId}/refunds`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    items: itemsPayload,
                    reason: reason.trim()
                })
            })

            const json = await res.json()
            if (!res.ok) throw new Error(json.error || "Failed to process refund")

            toast({
                title: "Refund Processed",
                description: json.message
            })

            setSelectedItems({})
            setReason("")
            setShowForm(false)
            mutateRefunds()
            onRefundSuccess?.()

        } catch (err: any) {
            toast({
                title: "Refund Failed",
                description: err.message,
                variant: "destructive"
            })
        } finally {
            setProcessing(false)
        }
    }

    return (
        <div className="space-y-4 pt-4 border-t">
            <div className="flex items-center justify-between">
                <h3 className="font-semibold text-lg">Refunds</h3>
                <div className="flex items-center gap-4">
                    {isFullyRefunded && (
                        hasPendingRefunds ? (
                            <Badge variant="outline" className="border-yellow-600 text-yellow-600 bg-yellow-50">Refund Pending</Badge>
                        ) : (
                            <Badge variant="outline" className="border-green-600 text-green-600 bg-green-50">Fully Refunded</Badge>
                        )
                    )}
                    {canRefund && !showForm && (
                        <Button variant="outline" size="sm" onClick={() => setShowForm(true)}>
                            Request Refund
                        </Button>
                    )}
                    {!isWithinRefundWindow && remainingRefundable > 0 && !showForm && (
                        <div className="text-xs text-amber-700 bg-amber-50 px-3 py-2 rounded-md border border-amber-200 flex items-center gap-2">
                            <Clock className="h-3 w-3" />
                            Refund period ended
                        </div>
                    )}
                </div>
            </div>

            {/* Refund window explanation */}
            {!isWithinRefundWindow && remainingRefundable > 0 && !showForm && (
                <p className="text-xs text-muted-foreground text-right mt-1">
                    Requests are limited to the calendar month of the order.
                </p>
            )}

            {showForm && (
                <Card className="p-4 border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 mb-2">
                            <AlertTriangle className="h-4 w-4" />
                            <span className="text-sm font-medium">Select Items to Refund</span>
                        </div>


                        {legacyRefundAmount > 0 && (
                            <div className="bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 p-3 rounded text-sm mb-4">
                                <p className="font-semibold text-yellow-800 dark:text-yellow-200 flex items-center gap-2">
                                    <AlertTriangle className="h-4 w-4" />
                                    Legacy Refunds Detected
                                </p>
                                <p className="text-yellow-700 dark:text-yellow-300 mt-1">
                                    This order has PKR {(legacyRefundAmount / 100).toFixed(2)} refunded previously without item tracking.
                                    You can only refund items up to the remaining balance of PKR {(remainingRefundable / 100).toFixed(2)}.
                                </p>
                            </div>
                        )}

                        {/* Items Table */}
                        <div className="bg-white dark:bg-slate-900 rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[50px]"></TableHead>
                                        <TableHead>Product</TableHead>
                                        <TableHead className="text-right">Price</TableHead>
                                        <TableHead className="text-center w-[120px]">Qty to Refund</TableHead>
                                        <TableHead className="text-right">Total</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {orderItems.length > 0 ? (
                                        orderItems.map((item: any) => {
                                            const refundedQty = refundedQuantities[item.id] || 0
                                            const remainingQty = Math.max(0, item.quantity - refundedQty)
                                            const isSelected = !!selectedItems[item.id]
                                            const isFullyRefundedItem = remainingQty === 0

                                            // Calculate if selecting this item (min qty 1) would exceed remaining balance
                                            const costOfOne = item.priceCents
                                            const currentSelectedQty = selectedItems[item.id] || 0
                                            const otherItemsTotal = selectedRefundAmount - (costOfOne * currentSelectedQty)
                                            const availableForThisItem = remainingRefundable - otherItemsTotal
                                            const maxAffordableQty = Math.floor(availableForThisItem / costOfOne)

                                            const effectiveMaxQty = Math.min(remainingQty, maxAffordableQty)

                                            const wouldExceedBalance = !isSelected && (selectedRefundAmount + costOfOne > remainingRefundable)
                                            const isDisable = isFullyRefundedItem || wouldExceedBalance

                                            return (
                                                <TableRow key={item.id} className={isFullyRefundedItem ? "opacity-50 bg-slate-50" : ""}>
                                                    <TableCell>
                                                        <Checkbox
                                                            checked={isSelected}
                                                            onCheckedChange={() => handleItemToggle(item.id, remainingQty)}
                                                            disabled={isDisable}
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex flex-col">
                                                            <span className="font-medium">{item.productName}</span>
                                                            <span className="text-xs text-muted-foreground flex gap-2">
                                                                <span>{item.unit}</span>
                                                                <span>• Ordered: {item.quantity}</span>
                                                                {refundedQty > 0 && <span className="text-amber-600">• Refunded: {refundedQty}</span>}
                                                            </span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        {(item.priceCents / 100).toFixed(2)}
                                                    </TableCell>
                                                    <TableCell>
                                                        {isSelected ? (
                                                            <Input
                                                                type="number"
                                                                min="1"
                                                                max={effectiveMaxQty}
                                                                value={selectedItems[item.id]}
                                                                onChange={(e) => handleQuantityChange(item.id, parseInt(e.target.value), effectiveMaxQty)}
                                                                className="h-8 w-20 text-center mx-auto"
                                                            />
                                                        ) : (
                                                            <div className="text-center text-muted-foreground">
                                                                {isFullyRefundedItem ? (
                                                                    <Badge variant="secondary" className="text-[10px]">Refunded</Badge>
                                                                ) : "-"}
                                                            </div>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right font-medium">
                                                        {isSelected
                                                            ? ((item.priceCents * selectedItems[item.id]) / 100).toFixed(2)
                                                            : "0.00"
                                                        }
                                                    </TableCell>
                                                </TableRow>
                                            )
                                        })
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                                                Loading items...
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>

                        <div className="flex justify-between items-center bg-slate-100 dark:bg-slate-800 p-3 rounded-lg">
                            <span className="font-medium">Total Refund Amount:</span>
                            <span className="text-lg font-bold">PKR {(selectedRefundAmount / 100).toFixed(2)}</span>
                        </div>

                        <div className="space-y-2">
                            <Label>Reason</Label>
                            <Textarea
                                placeholder="Why is this refund being requested?"
                                value={reason}
                                onChange={e => setReason(e.target.value)}
                                rows={2}
                            />
                        </div>

                        <div className="flex items-center justify-end gap-2">
                            <Button type="button" variant="ghost" size="sm" onClick={() => setShowForm(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" size="sm" disabled={processing || selectedRefundAmount <= 0}>
                                {processing ? "Processing..." : "Submit Refund"}
                            </Button>
                        </div>
                    </form>
                </Card>
            )}

            {/* Refunds History */}
            <div className="space-y-2">
                {effectiveRefunds.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">No refunds recorded for this order.</p>
                ) : (
                    effectiveRefunds.map((refund: any) => (
                        <div key={refund.id} className="flex flex-col p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border gap-3">
                            <div className="flex items-center justify-between w-full">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-full ${refund.status === 'APPROVED' ? 'bg-green-100 text-green-600 dark:bg-green-900/30' :
                                        refund.status === 'REJECTED' ? 'bg-red-100 text-red-600 dark:bg-red-900/30' :
                                            'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30'
                                        }`}>
                                        {refund.status === 'APPROVED' ? <CheckCircle className="h-4 w-4" /> :
                                            refund.status === 'REJECTED' ? <AlertTriangle className="h-4 w-4" /> :
                                                <Clock className="h-4 w-4" />}
                                    </div>
                                    <div>
                                        <p className="font-medium text-sm">
                                            PKR {(refund.amountCents / 100).toFixed(2)}
                                            <span className="text-muted-foreground font-normal ml-2">
                                                via {refund.processedByUser?.fullName || 'System'}
                                            </span>
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            {new Date(refund.createdAt).toLocaleDateString()}
                                            {refund.reason && ` • ${refund.reason}`}
                                        </p>
                                    </div>
                                </div>
                                <Badge variant="outline" className={
                                    refund.status === 'APPROVED' ? 'text-green-600 border-green-200' :
                                        refund.status === 'REJECTED' ? 'text-red-600 border-red-200' :
                                            'text-yellow-600 border-yellow-200'
                                }>
                                    {refund.status}
                                </Badge>
                            </div>

                            {/* Detailed items list for this refund */}
                            {refund.items && refund.items.length > 0 && (
                                <div className="pl-12 text-sm">
                                    <p className="text-xs font-medium text-muted-foreground mb-1">Refunded Items:</p>
                                    <ul className="space-y-1">
                                        {refund.items.map((item: any) => (
                                            <li key={item.orderItemId} className="flex justify-between text-xs bg-white dark:bg-slate-900 p-2 rounded border">
                                                <span>{item.quantity}x {item.productName} ({item.unit})</span>
                                                <span className="font-medium">PKR {(item.amountCents / 100).toFixed(2)}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}
