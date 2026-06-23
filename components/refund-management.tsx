"use client"

import { useState, useMemo } from "react"
import useSWR from "swr"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle, TrendingDown, Clock, CheckCircle, Ban } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { calculateLineCents, formatQuantity, parseQuantity, roundQuantity, sanitizeQuantityStep } from "@/lib/quantity"
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

    const totalApproved = effectiveRefunds
        .filter((r: any) => r.status === 'APPROVED' || r.status === 'COMPLETED')
        .reduce((sum: number, r: any) => sum + (r.amountCents || 0), 0)

    const totalPending = effectiveRefunds
        .filter((r: any) => r.status === 'PENDING')
        .reduce((sum: number, r: any) => sum + (r.amountCents || 0), 0)

    const remainingRefundable = Math.max(0, orderTotalCents - (totalApproved + totalPending))
    const isFullyRefunded = totalApproved >= orderTotalCents
    const hasPendingRefunds = totalPending > 0

    const isOrderApproved = ["APPROVED", "FULFILLED", "REFUNDED"].includes(orderStatus.toUpperCase())
    const canRefund = isOrderApproved && remainingRefundable > 0 && isWithinRefundWindow

    // Calculate previously refunded quantities per item
    const refundedQuantities = useMemo(() => {
        const quantities: Record<number, number> = {}
        effectiveRefunds.forEach((refund: any) => {
            if (refund.status === 'APPROVED' || refund.status === 'COMPLETED') {
                if (refund.items && Array.isArray(refund.items)) {
                    refund.items.forEach((item: any) => {
                        quantities[item.orderItemId] = (quantities[item.orderItemId] || 0) + item.quantity
                    })
                }
            }
        })
        return quantities
    }, [effectiveRefunds])

    // Calculate currently pending/requested quantities per item
    const requestedQuantities = useMemo(() => {
        const quantities: Record<number, number> = {}
        effectiveRefunds.forEach((refund: any) => {
            if (refund.status === 'PENDING') {
                if (refund.items && Array.isArray(refund.items)) {
                    refund.items.forEach((item: any) => {
                        quantities[item.orderItemId] = (quantities[item.orderItemId] || 0) + item.quantity
                    })
                }
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
        const item = orderItems.find((orderItem: any) => orderItem.id === itemId)
        const step = sanitizeQuantityStep(Boolean(item?.allowDecimalQuantity), item?.quantityStep ?? 1)
        let nextQty = Number.isFinite(qty) ? qty : step
        if (nextQty < step) nextQty = step
        if (nextQty > maxRefundableQty) nextQty = maxRefundableQty
        nextQty = Math.round(nextQty / step) * step
        setSelectedItems(prev => ({ ...prev, [itemId]: roundQuantity(Math.min(nextQty, maxRefundableQty)) }))
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
        return Math.max(0, totalApproved + totalPending - trackedAmount)
    }, [effectiveRefunds, totalApproved, totalPending])

    // Calculate total amount for selected items
    const selectedRefundAmount = useMemo(() => {
        return orderItems.reduce((total: number, item: any) => {
            const qty = selectedItems[item.id] || 0
            return total + calculateLineCents(item.priceCents, qty)
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
            {/* Refund Metrics Cards */}
            <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900/50 rounded-xl p-4 text-center">
                    <p className="text-[10px] uppercase tracking-wider font-semibold text-yellow-600 mb-1">Requested</p>
                    <p className="text-xl font-bold text-yellow-700 dark:text-yellow-400">PKR {(totalPending / 100).toFixed(2)}</p>
                </div>
                <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900/50 rounded-xl p-4 text-center">
                    <p className="text-[10px] uppercase tracking-wider font-semibold text-green-600 mb-1">Refunded</p>
                    <p className="text-xl font-bold text-green-700 dark:text-green-400">PKR {(totalApproved / 100).toFixed(2)}</p>
                </div>
                <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/50 rounded-xl p-4 text-center">
                    <p className="text-[10px] uppercase tracking-wider font-semibold text-blue-600 mb-1">Remaining</p>
                    <p className="text-xl font-bold text-blue-700 dark:text-blue-400">PKR {(remainingRefundable / 100).toFixed(2)}</p>
                </div>
            </div>

            <div className="flex items-center justify-between">
                <h3 className="font-semibold text-lg">Refund History</h3>
                <div className="flex items-center gap-4">
                    {isFullyRefunded && (
                        <Badge variant="outline" className="border-green-600 text-green-600 bg-green-50">Fully Refunded</Badge>
                    )}
                    {canRefund && !showForm && (
                        <Button variant="outline" size="sm" onClick={() => setShowForm(true)}>
                            Request Refund
                        </Button>
                    )}
                    {!isOrderApproved && remainingRefundable > 0 && !showForm && (
                        <div className="text-xs text-slate-600 bg-slate-50 px-3 py-2 rounded-md border border-slate-200 flex items-center gap-2">
                            <Clock className="h-3 w-3" />
                            Refund available after approval
                        </div>
                    )}
                    {isOrderApproved && !isWithinRefundWindow && remainingRefundable > 0 && !showForm && (
                        <div className="text-xs text-amber-700 bg-amber-50 px-3 py-2 rounded-md border border-amber-200 flex items-center gap-2">
                            <Clock className="h-3 w-3" />
                            Refund period ended
                        </div>
                    )}
                </div>
            </div>

            {/* Refund window explanation */}
            {isOrderApproved && !isWithinRefundWindow && remainingRefundable > 0 && !showForm && (
                <p className="text-xs text-muted-foreground text-right mt-1">
                    Requests are limited to the calendar month of the order.
                </p>
            )}

            {
                showForm && (
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
                                            <TableHead className="text-right">Remaining</TableHead>
                                            <TableHead className="text-center w-[120px]">Qty to Refund</TableHead>
                                            <TableHead className="text-right">Total</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {orderItems.length > 0 ? (
                                            orderItems.map((item: any) => {
                                                const refundedQty = refundedQuantities[item.id] || 0
                                                const requestedQty = requestedQuantities[item.id] || 0
                                                const remainingQty = Math.max(0, item.quantity - (refundedQty + requestedQty))
                                                const isSelected = !!selectedItems[item.id]
                                                const isFullyRefundedItem = remainingQty === 0

                                                // Calculate if selecting this item (min qty 1) would exceed remaining balance
                                                const costOfOne = item.priceCents
                                                const currentSelectedQty = selectedItems[item.id] || 0
                                                const otherItemsTotal = selectedRefundAmount - (costOfOne * currentSelectedQty)
                                                const availableForThisItem = remainingRefundable - otherItemsTotal
                                                const step = sanitizeQuantityStep(Boolean(item.allowDecimalQuantity), item.quantityStep ?? 1)
                                                const maxAffordableQty = Math.floor((availableForThisItem / costOfOne) / step) * step

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
                                                                    {refundedQty > 0 && <span className="text-green-600 font-medium">• Refunded: {refundedQty}</span>}
                                                                    {requestedQty > 0 && <span className="text-amber-600 font-medium">• Requested: {requestedQty}</span>}
                                                                </span>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            {(item.priceCents / 100).toFixed(2)}
                                                        </TableCell>
                                                        <TableCell className="text-right font-semibold">
                                                            {formatQuantity(remainingQty)}
                                                        </TableCell>
                                                        <TableCell>
                                                            {isSelected ? (
                                                                <Input
                                                                    type="number"
                                                                    min={step}
                                                                    step={step}
                                                                    max={effectiveMaxQty}
                                                                    value={selectedItems[item.id]}
                                                                    onChange={(e) => handleQuantityChange(item.id, parseQuantity(e.target.value), effectiveMaxQty)}
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
                                                        <TableCell className="text-right font-medium text-red-600">
                                                            {isSelected
                                                                ? (calculateLineCents(item.priceCents, selectedItems[item.id]) / 100).toFixed(2)
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
                                    maxLength={255}
                                />
                                <div className="text-xs text-muted-foreground text-right">
                                    {reason.length}/255
                                </div>
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
                )
            }

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
                                            <span className="font-mono text-xs text-primary font-semibold mr-2">
                                                {refund.refundNumber || (refund.id !== 'legacy' ? `Refund-${String(refund.id).padStart(6, '0')}` : '')}
                                            </span>
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
                                <div className="flex items-center gap-2">
                                    <Badge variant="outline" className={
                                        refund.status === 'APPROVED' ? 'text-green-600 border-green-200' :
                                            refund.status === 'REJECTED' ? 'text-red-600 border-red-200' :
                                                refund.status === 'SUPERSEDED' ? 'text-slate-500 border-slate-200' :
                                                    'text-yellow-600 border-yellow-200'
                                    }>
                                        {refund.status}
                                    </Badge>
                                    {refund.refundType && (
                                        <Badge variant="secondary" className="text-xs">
                                            {refund.refundType === 'FULL' ? 'Full Refund' : 'Partial Refund'}
                                        </Badge>
                                    )}
                                </div>
                            </div>

                            {/* Detailed items list for this refund */}
                            {
                                refund.items && refund.items.length > 0 && (
                                    <div className="pl-12 text-sm">
                                        <p className="text-xs font-medium text-muted-foreground mb-1">Refunded Items:</p>
                                        <ul className="space-y-1">
                                            {refund.items.map((item: any) => (
                                                <li key={item.orderItemId} className="flex justify-between text-xs bg-white dark:bg-slate-900 p-2 rounded border">
                                                    <span>{formatQuantity(item.quantity)}x {item.productName} ({item.unit})</span>
                                                    <span className="font-medium">PKR {(item.amountCents / 100).toFixed(2)}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )
                            }
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}
