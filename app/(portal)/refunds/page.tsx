"use client"

import { useState, useMemo, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Search, RefreshCcw, Loader2, AlertTriangle, Building2, Calendar, User, DollarSign, Clock } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"

type OrderItem = {
    id: number
    productName: string
    productCode: string
    quantity: number
    priceCents: number
    unit: string
    refundedQuantity?: number // Added by API
    requestedQuantity?: number // Added by API
    remainingQuantity?: number // Added by API
}

type OrderData = {
    id: number
    tid: string
    organizationId: number
    organizationName: string
    branchId: number
    branchName: string
    status: string
    subtotalCents: number
    taxCents: number
    totalCents: number
    createdAt: string
    statusAtRefund: string | null
    refundedAt: string | null
    refundAmountCents: number | null
    createdByUserName: string
    items: OrderItem[]
    refundedQuantities?: Record<number, number> // Refunded quantities per order item ID
}

import { useSearchParams } from "next/navigation"

export default function RefundsPage() {
    const { toast } = useToast()
    const searchParams = useSearchParams()
    const [searchQuery, setSearchQuery] = useState(searchParams.get("tid") || "")
    const [searching, setSearching] = useState(false)
    const [order, setOrder] = useState<OrderData | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [selectedItems, setSelectedItems] = useState<Map<number, number>>(new Map())
    const [refundDialogOpen, setRefundDialogOpen] = useState(false)
    const [refundReason, setRefundReason] = useState("")
    const [processing, setProcessing] = useState(false)

    const [pendingRefunds, setPendingRefunds] = useState<any[]>([])

    // Separate search function to be called from effect or button
    const performSearch = async (tid: string) => {
        if (!tid.trim()) return

        setSearching(true)
        setError(null)
        setOrder(null)
        setSelectedItems(new Map())

        try {
            const response = await fetch(`/api/v1/admin/refunds?q=${encodeURIComponent(tid.trim())}`)
            const data = await response.json()

            if (!response.ok) {
                setError(data.error || "Order not found")
                return
            }

            const order = data.order
            setOrder(order)

            // Auto-select pending items
            const newSelectedItems = new Map<number, number>()
            order.items.forEach((item: any) => {
                const requested = item.requestedQuantity || 0
                if (requested > 0) {
                    const remaining = item.remainingQuantity ?? Math.max(0, item.quantity - (item.refundedQuantity || 0))
                    const refundable = Math.min(requested, remaining)
                    if (refundable > 0) {
                        newSelectedItems.set(item.id, refundable)
                    }
                }
            })
            if (newSelectedItems.size > 0) {
                setSelectedItems(newSelectedItems)
            }
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to search order"
            setError(message)
        } finally {
            setSearching(false)
        }
    }

    // Fetch pending refunds on mount
    useEffect(() => {
        const fetchPendingRefunds = async () => {
            try {
                const response = await fetch('/api/v1/admin/refunds?status=pending')
                if (response.ok) {
                    const data = await response.json()
                    setPendingRefunds(data.refunds || [])
                }
            } catch (error) {
                console.error("Failed to fetch pending refunds", error)
            }
        }

        fetchPendingRefunds()
    }, [])

    // Auto-search on mount if tid param exists
    useEffect(() => {
        const tid = searchParams.get("tid")
        if (tid) {
            performSearch(tid)
        }
    }, [searchParams])

    const searchOrder = () => performSearch(searchQuery)

    const handleItemToggle = (itemId: number, maxQty: number) => {
        setSelectedItems(prev => {
            const newMap = new Map(prev)
            if (newMap.has(itemId)) {
                newMap.delete(itemId)
            } else {
                newMap.set(itemId, maxQty)
            }
            return newMap
        })
    }

    const handleQuantityChange = (itemId: number, value: string, maxQty: number) => {
        const qty = parseInt(value)
        if (isNaN(qty) || qty < 0) return

        const finalQty = Math.min(qty, maxQty)
        setSelectedItems(prev => {
            const newMap = new Map(prev)
            if (finalQty === 0) {
                newMap.delete(itemId)
            } else {
                newMap.set(itemId, finalQty)
            }
            return newMap
        })
    }

    const handleSelectAll = () => {
        if (!order) return

        const refundableItems = order.items.filter(item => {
            const alreadyRefunded = item.refundedQuantity || 0
            return item.quantity > alreadyRefunded
        })

        if (selectedItems.size === refundableItems.length) {
            setSelectedItems(new Map())
        } else {
            const newMap = new Map<number, number>()
            refundableItems.forEach(item => {
                const remainingQty = item.remainingQuantity ?? (item.quantity - (item.refundedQuantity || 0))
                newMap.set(item.id, remainingQty)
            })
            setSelectedItems(newMap)
        }
    }

    const refundAmountCents = useMemo(() => {
        if (!order) return 0
        let total = 0
        selectedItems.forEach((qty, itemId) => {
            const item = order.items.find(i => i.id === itemId)
            if (item) {
                total += item.priceCents * qty
            }
        })
        return total
    }, [selectedItems, order])

    const openRefundDialog = () => {
        if (selectedItems.size === 0) {
            toast({
                title: "⚠️ No Items Selected",
                description: "Please select at least one item to refund",
                variant: "destructive",
                duration: 3000
            })
            return
        }
        setRefundReason("")
        setRefundDialogOpen(true)
    }

    const processRefund = async () => {
        if (!order || selectedItems.size === 0) return

        const refundItems = Array.from(selectedItems.entries()).map(([itemId, quantity]) => ({
            itemId,
            quantity
        }))

        setProcessing(true)
        try {
            const response = await fetch(`/api/v1/admin/refunds`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    orderId: order.id,
                    items: refundItems,
                    reason: refundReason.trim() || undefined
                })
            })

            const data = await response.json()

            if (!response.ok) {
                // Show detailed error message from backend
                toast({
                    title: "Refund Failed",
                    description: data.error || "Failed to process refund. Please try again.",
                    variant: "destructive",
                    duration: 5000
                })
                return
            }

            toast({
                title: "✅ Refund Processed Successfully",
                description: `Refunded PKR ${(refundAmountCents / 100).toFixed(2)} for ${selectedItems.size} item(s)`,
                duration: 4000
            })

            setRefundDialogOpen(false)
            setSelectedItems(new Map())
            searchOrder()
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to process refund"
            toast({
                title: "❌ Error",
                description: message,
                variant: "destructive",
                duration: 5000
            })
        } finally {
            setProcessing(false)
        }
    }

    const getStatusBadge = (status: string, statusAtRefund?: string | null) => {
        const statusUpper = status.toUpperCase()

        if (statusUpper === "REFUNDED" && statusAtRefund) {
            return (
                <div className="flex items-center gap-1">
                    <Badge variant="outline" className="text-slate-600">{statusAtRefund}</Badge>
                    <span className="text-muted-foreground">→</span>
                    <Badge variant="destructive">Refunded</Badge>
                </div>
            )
        }

        switch (statusUpper) {
            case "PENDING": return <Badge variant="secondary">Pending</Badge>
            case "APPROVED": return <Badge className="bg-blue-500">Approved</Badge>
            case "FULFILLED": return <Badge className="bg-green-500">Fulfilled</Badge>
            case "REJECTED": return <Badge variant="destructive">Rejected</Badge>
            case "REFUNDED": return <Badge variant="destructive">Refunded</Badge>
            default: return <Badge variant="outline">{status}</Badge>
        }
    }

    const canRefund = order && !["PENDING", "REJECTED", "REFUNDED"].includes(order.status.toUpperCase())

    return (
        <div className="space-y-6 p-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Refund Management</h1>
                <p className="text-muted-foreground">Search by Transaction ID (TID) and select items to refund</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Search className="h-5 w-5" />
                        Search Order
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex gap-3">
                        <Input
                            placeholder="Enter Transaction ID (e.g., ORD-ABC123)"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && searchOrder()}
                            className="max-w-md"
                        />
                        <Button onClick={searchOrder}>
                            {searching ? "Searching..." : (
                                <>
                                    <Search className="h-4 w-4 mr-2" />
                                    Search
                                </>
                            )}
                        </Button>
                    </div>
                    {error && (
                        <div className="mt-4 p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg">
                            <p className="text-sm text-red-700 dark:text-red-300 flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4" />
                                {error}
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>

            {order && (
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle className="text-xl">Order: {order.tid}</CardTitle>
                            <div className="mt-2">
                                {getStatusBadge(order.status, order.statusAtRefund)}
                            </div>
                        </div>
                        {canRefund && selectedItems.size > 0 && (
                            <div className="flex items-center gap-3">
                                <div className="text-right">
                                    <p className="text-sm text-muted-foreground">Refund Amount</p>
                                    <p className="text-2xl font-bold text-red-600">
                                        PKR {(refundAmountCents / 100).toFixed(2)}
                                    </p>
                                </div>
                                <Button onClick={openRefundDialog} variant="destructive" className="gap-2">
                                    <DollarSign className="h-4 w-4" />
                                    Process Refund
                                </Button>
                            </div>
                        )}
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="space-y-1">
                                <p className="text-sm text-muted-foreground flex items-center gap-1">
                                    <Building2 className="h-3 w-3" /> Organization
                                </p>
                                <p className="font-medium">{order.organizationName}</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-sm text-muted-foreground flex items-center gap-1">
                                    <Building2 className="h-3 w-3" /> Branch
                                </p>
                                <p className="font-medium">{order.branchName}</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-sm text-muted-foreground flex items-center gap-1">
                                    <Calendar className="h-3 w-3" /> Created
                                </p>
                                <p className="font-medium">{new Date(order.createdAt).toLocaleString()}</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-sm text-muted-foreground flex items-center gap-1">
                                    <User className="h-3 w-3" /> Created By
                                </p>
                                <p className="font-medium">{order.createdByUserName}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg">
                            <div className="space-y-1">
                                <p className="text-sm text-muted-foreground">Subtotal</p>
                                <p className="text-lg font-bold">PKR {(order.subtotalCents / 100).toFixed(2)}</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-sm text-muted-foreground">Tax</p>
                                <p className="text-lg font-bold">PKR {(order.taxCents / 100).toFixed(2)}</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-sm text-muted-foreground">Total</p>
                                <p className="text-lg font-bold text-green-600">PKR {(order.totalCents / 100).toFixed(2)}</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-sm text-muted-foreground">Already Refunded</p>
                                <p className="text-lg font-bold text-red-600">
                                    PKR {((order.refundAmountCents || 0) / 100).toFixed(2)}
                                </p>
                            </div>
                        </div>

                        {order.refundedAt && (
                            <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
                                <h4 className="font-medium text-amber-800 dark:text-amber-200 mb-2">Refund Information</h4>
                                <div className="text-sm text-amber-700 dark:text-amber-300 space-y-2">
                                    <p>Was <strong>{order.statusAtRefund}</strong> → Now <strong>REFUNDED</strong></p>
                                    <p>Refunded at: {new Date(order.refundedAt).toLocaleString()}</p>
                                    <div className="pt-2 border-t border-amber-200/50 dark:border-amber-800/50">
                                        <p className="font-semibold mb-1">Refunded Items:</p>
                                        <div className="space-y-1">
                                            {order.items
                                                .filter(i => (i.refundedQuantity || 0) > 0)
                                                .map(i => (
                                                    <div key={`info-${i.id}`} className="flex justify-between">
                                                        <span>{i.refundedQuantity}x {i.productName}</span>
                                                        <span>PKR {((i.refundedQuantity || 0) * i.priceCents / 100).toFixed(2)}</span>
                                                    </div>
                                                ))
                                            }
                                        </div>
                                    </div>
                                    <div className="pt-2 border-t border-amber-200/50 dark:border-amber-800/50 flex justify-between font-bold">
                                        <span>Total Refunded</span>
                                        <span>PKR {((order.refundAmountCents || 0) / 100).toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {canRefund && (
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <h4 className="font-medium">Select Items to Refund</h4>
                                    <Button variant="outline" size="sm" onClick={handleSelectAll}>
                                        {selectedItems.size === order.items.length ? "Deselect All" : "Select All"}
                                    </Button>
                                </div>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-12"></TableHead>
                                            <TableHead>Product</TableHead>
                                            <TableHead>Code</TableHead>
                                            <TableHead className="text-right">Unit Price</TableHead>
                                            <TableHead className="text-right">Ordered Qty</TableHead>
                                            <TableHead className="text-right">Remaining Qty</TableHead>
                                            <TableHead className="text-right">Refund Qty</TableHead>
                                            <TableHead className="text-right">Line Total</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {order.items.map((item) => {
                                            const refundedQty = item.refundedQuantity || 0
                                            const remainingQty = item.remainingQuantity ?? Math.max(0, item.quantity - refundedQty)
                                            const isFullyRefunded = remainingQty === 0

                                            const isSelected = selectedItems.has(item.id)
                                            const refundQty = selectedItems.get(item.id) || remainingQty
                                            const lineTotal = isSelected ? item.priceCents * refundQty : 0

                                            return (
                                                <TableRow
                                                    key={item.id}
                                                    className={isSelected ? "bg-red-50 dark:bg-red-950/20" : isFullyRefunded ? "opacity-50" : ""}
                                                >
                                                    <TableCell>
                                                        <Checkbox
                                                            checked={isSelected}
                                                            onCheckedChange={() => handleItemToggle(item.id, remainingQty)}
                                                            disabled={isFullyRefunded}
                                                        />
                                                    </TableCell>
                                                    <TableCell className="font-medium">
                                                        <div>
                                                            {item.productName}
                                                            {(item.requestedQuantity || 0) > 0 && (
                                                                <span className="text-xs text-blue-600 font-semibold block mt-1">
                                                                    ({item.requestedQuantity} requested for refund)
                                                                </span>
                                                            )}
                                                            {refundedQty > 0 && (
                                                                <span className="text-xs text-amber-600 block mt-1">
                                                                    ({refundedQty} already refunded)
                                                                </span>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant="outline">{item.productCode}</Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        PKR {(item.priceCents / 100).toFixed(2)}
                                                    </TableCell>
                                                    <TableCell className="text-right text-muted-foreground">
                                                        {item.quantity} {item.unit}
                                                    </TableCell>
                                                    <TableCell className="text-right font-semibold">
                                                        {remainingQty} {item.unit}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        {isSelected ? (
                                                            <Input
                                                                type="number"
                                                                min="1"
                                                                max={remainingQty}
                                                                value={refundQty}
                                                                onChange={(e) => handleQuantityChange(item.id, e.target.value, remainingQty)}
                                                                className="w-20 h-8 text-right"
                                                                onClick={(e) => e.stopPropagation()}
                                                            />
                                                        ) : isFullyRefunded ? (
                                                            <Badge variant="secondary" className="text-xs">Fully Refunded</Badge>
                                                        ) : (
                                                            <span className="text-muted-foreground">-</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right font-medium">
                                                        {isSelected ? (
                                                            <span className="text-red-600">
                                                                PKR {(lineTotal / 100).toFixed(2)}
                                                            </span>
                                                        ) : (
                                                            <span className="text-muted-foreground">-</span>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            )
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            <Dialog open={refundDialogOpen} onOpenChange={setRefundDialogOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-red-600">
                            <AlertTriangle className="h-5 w-5" />
                            Confirm Refund
                        </DialogTitle>
                        <DialogDescription>
                            This will refund the selected items and credit the branch budget.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-lg space-y-2">
                            <p className="text-sm text-muted-foreground">Order</p>
                            <p className="font-medium">{order?.tid}</p>
                            <p className="text-sm">
                                <strong>{selectedItems.size}</strong> item(s) selected
                            </p>
                            <p className="text-lg font-bold text-red-600">
                                Refund Amount: PKR {(refundAmountCents / 100).toFixed(2)}
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="refundReason">Reason (Optional)</Label>
                            <Textarea
                                id="refundReason"
                                value={refundReason}
                                onChange={(e) => setRefundReason(e.target.value)}
                                placeholder="Enter reason for refund..."
                                rows={3}
                                maxLength={255}
                            />
                            <div className="text-xs text-muted-foreground text-right">
                                {refundReason.length}/255
                            </div>
                        </div>

                        <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
                            <p className="text-sm text-amber-800 dark:text-amber-200">
                                <strong>This will:</strong>
                            </p>
                            <ul className="text-sm text-amber-700 dark:text-amber-300 list-disc ml-4 mt-1">
                                <li>Refund PKR {(refundAmountCents / 100).toFixed(2)}</li>
                                <li>Credit the branch budget</li>
                                <li>Update order status if full refund</li>
                                <li>Create audit log entry</li>
                            </ul>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setRefundDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={processRefund}
                            disabled={processing}
                        >
                            {processing ? "Processing..." : "Confirm Refund"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
