"use client"
import React, { useMemo, useState } from "react"
import useSWR from "swr"
import { useOrders } from "@/lib/hooks/use-api"
import { Card } from "@/components/ui/card"
import { SectionHeader } from "@/components/ui/section-header"
import { Tabs } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Table } from "@/components/ui/table"
import { Separator } from "@/components/ui/separator"
import { useToast } from "@/components/ui/use-toast"
import { Package, Calendar, Building2, CheckCircle, XCircle, Clock, Truck, Search, Filter, ShoppingCart, Plus, Minus, DollarSign, RefreshCcw, Undo2, Wallet } from "lucide-react"

const statuses = ["PENDING", "APPROVED", "REJECTED", "FULFILLED"] as const

const getStatusConfig = (status: string) => {
  const configs: Record<string, { color: string; icon: any; label: string }> = {
    PENDING: { color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400", icon: Clock, label: "Pending" },
    APPROVED: { color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400", icon: CheckCircle, label: "Approved" },
    REJECTED: { color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400", icon: XCircle, label: "Rejected" },
    FULFILLED: { color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400", icon: Truck, label: "Fulfilled" },
  }
  return configs[status] || configs.PENDING
}

export default function OrdersPage() {
  const { toast } = useToast()
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState<string>("")
  const [branchId, setBranchId] = useState<string>("")
  const { data, isLoading, mutate } = useOrders({ 
    status: statusFilter === "all" ? undefined : statusFilter.toUpperCase(), 
    branchId: branchId || undefined 
  })
  const [selected, setSelected] = useState<any | null>(null)
  const [showRefund, setShowRefund] = useState(false)
  const [refundAmount, setRefundAmount] = useState("")
  const [refundReason, setRefundReason] = useState("")
  const fetcher = (url: string) => fetch(url).then(r => r.json())
  const { data: session } = useSWR<any>("/api/auth/session", fetcher)
  const role = (session?.user as any)?.role
  const isHeadOffice = role === "HEAD_OFFICE" || role === "SUPER_ADMIN"

  // Catalog sources
  // Branch users: use branch inventory
  const { data: branchInventory } = useSWR<any>(!isHeadOffice ? "/api/v1/branch/inventory?visibility=visible" : null, fetcher)
  // HO users: use organization inventory, requires optional organizationId from session
  const { data: orgInventory } = useSWR<any>(isHeadOffice ? "/api/v1/head-office/organization-inventory?status=active" : null, fetcher)
  const { data: budget } = useSWR<any>(!isHeadOffice ? "/api/v1/budgets" : null, fetcher)

  // Cart state: { organizationInventoryId, quantity, label }
  const [cart, setCart] = useState<{ organizationInventoryId: number, quantity: number, label: string }[]>([])
  const addToCart = (id: number, label: string) => {
    setCart(prev => {
      const existing = prev.find(i => i.organizationInventoryId === id)
      if (existing) return prev.map(i => i.organizationInventoryId === id ? { ...i, quantity: i.quantity + 1 } : i)
      return [...prev, { organizationInventoryId: id, quantity: 1, label }]
    })
  }
  const updateQty = (id: number, delta: number) => {
    setCart(prev => prev.map(i => i.organizationInventoryId === id ? { ...i, quantity: Math.max(0, i.quantity + delta) } : i).filter(i => i.quantity > 0))
  }
  const clearCart = () => setCart([])

  const items = data?.items || []
  
  // Filter by search query
  const filteredItems = items.filter((order: any) => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      order.id?.toString().includes(query) ||
      order.branchId?.toString().toLowerCase().includes(query) ||
      order.status?.toLowerCase().includes(query)
    )
  })

  const hasItems = filteredItems.length > 0

  const handleStatusChange = (value: string) => {
    setStatusFilter(value)
  }

  const catalogItems = useMemo(() => {
    if (isHeadOffice) {
      return orgInventory?.items?.map((it: any) => ({
        id: it.id, // organizationInventoryId
        code: it.productCode,
        name: it.customName || it.productName,
        imageUrl: it.productImageUrl,
        priceCents: it.customPrice ?? it.basePrice,
        unit: it.unit,
      })) || []
    }
    return branchInventory?.items?.map((it: any) => ({
      id: it.organizationInventoryId,
      code: it.productCode,
      name: it.customName || it.productName,
      imageUrl: it.productImageUrl,
        priceCents: it.customPrice ?? it.basePrice,
        unit: it.unit,
    })) || []
  }, [isHeadOffice, orgInventory?.items, branchInventory?.items])

  const catalogById = useMemo(() => new Map(catalogItems.map((c: any) => [c.id, c])), [catalogItems])
  const estimatedTotalCents = useMemo(() => {
    return cart.reduce((sum, ci) => {
      const c = catalogById.get(ci.organizationInventoryId)
      if (!c) return sum
      return sum + (Number(ci.quantity || 0) * Number(c.priceCents || 0))
    }, 0)
  }, [cart, catalogById])

  const placeOrder = async () => {
    if (cart.length === 0) return
    const res = await fetch("/api/v1/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: cart.map(c => ({ organizationInventoryId: c.organizationInventoryId, quantity: c.quantity })), ...(isHeadOffice && branchId ? { branchId: Number(branchId) } : {}) })
    })
    const json = await res.json()
    if (res.ok) {
      clearCart()
      await mutate()
      toast({ title: "Order placed", description: `TID: ${json.order?.tid}` })
    } else {
      toast({ title: "Failed to create order", description: json.error || "Please try again", variant: "destructive" })
    }
  }

  const updateOrder = async (id: number, action: 'approve' | 'cancel' | 'fulfill') => {
    const res = await fetch("/api/v1/orders", { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action }) })
    const json = await res.json()
    if (!res.ok) toast({ title: 'Update failed', description: json.error || 'Please try again', variant: 'destructive' })
    await mutate()
    setSelected(null)
  }

  const refundOrder = async (id: number) => {
    const amount = prompt("Enter refund amount in cents")
    if (!amount) return
    const n = Number(amount)
    if (!Number.isFinite(n) || n <= 0) return alert("Invalid amount")
    const res = await fetch(`/api/v1/orders/${id}/refunds`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amountCents: n }) })
    const json = await res.json()
    if (!res.ok) toast({ title: 'Refund failed', description: json.error || 'Please try again', variant: 'destructive' })
    await mutate()
    setSelected(null)
  }

  return (
    <div className="space-y-6">
      <SectionHeader 
        title="Orders Management" 
        subtitle="Track and manage all branch orders in one place" 
        actions={
          <Button onClick={() => mutate()} variant="outline" size="sm">
            <Package className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        } 
      />

      {/* Tabs for status filtering + Remaining Budget */}
      <div className="flex items-center justify-between">
      <Tabs 
          tabs={[{ value: "all", label: "All Orders" }, { value: "pending", label: "Pending" }, { value: "approved", label: "Approved" }, { value: "fulfilled", label: "Fulfilled" }, { value: "rejected", label: "Rejected" }]} 
        onValueChange={handleStatusChange} 
      />
        {!isHeadOffice && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
            <Wallet className="h-4 w-4" />
            <span className="text-sm font-medium">Remaining Budget:</span>
            <span className="text-sm font-semibold">{budget ? `$${((budget.remainingCents || 0)/100).toFixed(2)}` : '—'}</span>
          </div>
        )}
      </div>

      {/* Search and Filter Bar + Cart */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search by order ID, branch, or status..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex gap-2">
            {isHeadOffice && (
            <Input 
                placeholder="Branch ID (for new orders)" 
              value={branchId} 
              onChange={(e) => setBranchId(e.target.value)}
                className="w-full md:w-56"
            />
            )}
            <Button variant="outline" size="icon">
              <Filter className="h-4 w-4" />
            </Button>
          </div>
      </div>

        {/* Catalog and Cart */}
        <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="p-3 bg-gradient-to-b from-white to-slate-50 border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Package className="h-4 w-4" /> Catalog
              </div>
              <Button variant="ghost" size="icon">
                <RefreshCcw className="h-4 w-4" />
              </Button>
            </div>
            <div className="max-h-64 overflow-y-auto divide-y">
              {catalogItems.map((ci: any) => (
                <div key={ci.id} className="flex items-center justify-between py-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate max-w-[320px]">{ci.name}</div>
                    <div className="text-xs text-muted-foreground">{ci.code} • ${(Number(ci.priceCents||0)/100).toFixed(2)} {ci.unit}</div>
                  </div>
                  <Button size="icon" variant="outline" onClick={() => addToCart(ci.id, ci.name)}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              {catalogItems.length === 0 && (
                <div className="text-sm text-muted-foreground py-6 text-center">No products available</div>
              )}
            </div>
          </Card>

          <Card className="p-3 bg-gradient-to-b from-white to-slate-50 border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <ShoppingCart className="h-4 w-4" /> Cart
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={clearCart} title="Clear cart"><Undo2 className="h-4 w-4" /></Button>
                <Button size="sm" onClick={placeOrder} disabled={cart.length === 0 || (isHeadOffice && !branchId)}>
                  Place Order
                </Button>
              </div>
            </div>
            <div className="max-h-64 overflow-y-auto divide-y">
              {cart.map(ci => (
                <div key={ci.organizationInventoryId} className="flex items-center justify-between py-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate max-w-[300px]">{ci.label}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="icon" variant="outline" onClick={() => updateQty(ci.organizationInventoryId, -1)}><Minus className="h-4 w-4" /></Button>
                    <div className="w-8 text-center text-sm">{ci.quantity}</div>
                    <Button size="icon" variant="outline" onClick={() => updateQty(ci.organizationInventoryId, 1)}><Plus className="h-4 w-4" /></Button>
                  </div>
                </div>
              ))}
              {cart.length === 0 && (
                <div className="text-sm text-muted-foreground py-6 text-center">No items in cart</div>
              )}
            </div>
            <div className="mt-3 flex items-center justify-end gap-2 text-sm">
              <span className="text-muted-foreground">Estimated Total:</span>
              <span className="font-semibold">${(estimatedTotalCents/100).toFixed(2)}</span>
            </div>
          </Card>
        </div>
      </Card>

      {/* Orders Table */}
      <Card className="border-slate-200">
        <div className="overflow-x-auto">
          <Table>
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-4 font-semibold text-sm">Order ID</th>
                <th className="text-left p-4 font-semibold text-sm">Branch</th>
                <th className="text-left p-4 font-semibold text-sm">Items</th>
                <th className="text-left p-4 font-semibold text-sm">Total Qty</th>
                <th className="text-left p-4 font-semibold text-sm">Order Date</th>
                <th className="text-left p-4 font-semibold text-sm">Status</th>
                <th className="text-right p-4 font-semibold text-sm">Actions</th>
              </tr>
            </thead>
            <tbody>
              {!hasItems && !isLoading && (
                <tr>
                  <td colSpan={7} className="p-12 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Package className="h-12 w-12 opacity-20" />
                      <p className="text-sm font-medium">No Orders Found</p>
                      <p className="text-xs">Try adjusting your filters or search query</p>
                    </div>
                  </td>
                </tr>
              )}
              {isLoading && (
                <tr>
                  <td colSpan={7} className="p-12 text-center">
                    <div className="flex items-center justify-center gap-2 text-muted-foreground">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      <p className="text-sm">Loading orders...</p>
        </div>
                  </td>
                </tr>
              )}
              {filteredItems.map((order: any) => {
                const statusConfig = getStatusConfig(order.status)
                const StatusIcon = statusConfig.icon
                const totalQty = order.items?.reduce((sum: number, item: any) => sum + Number(item.quantity || 0), 0) || 0
                
                return (
                  <tr key={order.id} className="border-b hover:bg-muted/30 transition-colors">
                    <td className="p-4">
                      <div className="font-mono text-sm font-medium">#{order.id}</div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{order.branchId || "N/A"}</span>
            </div>
                    </td>
                    <td className="p-4">
                      <Badge variant="secondary" className="font-normal">
                        {order.items?.length || 0} items
                      </Badge>
                    </td>
                    <td className="p-4">
                      <span className="text-sm font-medium">{totalQty}</span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        {new Date(order.createdAt).toLocaleDateString('en-US', { 
                          month: 'short', 
                          day: 'numeric', 
                          year: 'numeric' 
                        })}
            </div>
                    </td>
                    <td className="p-4">
                      <Badge className={`${statusConfig.color} flex items-center gap-1 w-fit`}>
                        <StatusIcon className="h-3 w-3" />
                        {statusConfig.label}
                      </Badge>
                    </td>
                    <td className="p-4 text-right">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => setSelected(order)}
                      >
                        View Details
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </Table>
          </div>
      </Card>

      {/* Order Details Dialog */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl">Order Details</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-6">
              {/* Order Header Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Order ID</p>
                  <p className="font-mono font-semibold">#{selected.id}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Status</p>
                  <Badge className={`${getStatusConfig(selected.status).color} flex items-center gap-1 w-fit`}>
                    {React.createElement(getStatusConfig(selected.status).icon, { className: "h-3 w-3" })}
                    {getStatusConfig(selected.status).label}
                  </Badge>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Branch ID</p>
                  <p className="font-medium">{selected.branchId || "N/A"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Order Date</p>
                  <p className="font-medium">
                    {new Date(selected.createdAt).toLocaleDateString('en-US', { 
                      month: 'long', 
                      day: 'numeric', 
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
              </div>

              <Separator />

              {/* Order Items */}
            <div className="space-y-3">
                <h3 className="font-semibold text-lg">Order Items</h3>
                {selected.items && selected.items.length > 0 ? (
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <thead>
                        <tr className="bg-muted/50">
                          <th className="text-left p-3 text-xs font-semibold">Item</th>
                          <th className="text-right p-3 text-xs font-semibold">Quantity</th>
                          <th className="text-right p-3 text-xs font-semibold">Unit Price</th>
                          <th className="text-right p-3 text-xs font-semibold">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selected.items.map((item: any, idx: number) => (
                          <tr key={idx} className="border-t">
                            <td className="p-3 text-sm">{item.name || item.productId || `Item ${idx + 1}`}</td>
                            <td className="p-3 text-sm text-right">{item.quantity || 0}</td>
                            <td className="p-3 text-sm text-right">${(item.unitPrice || 0).toFixed(2)}</td>
                            <td className="p-3 text-sm text-right font-medium">
                              ${((item.quantity || 0) * (item.unitPrice || 0)).toFixed(2)}
                            </td>
                          </tr>
                        ))}
                        <tr className="border-t bg-muted/30">
                          <td colSpan={3} className="p-3 text-sm font-semibold text-right">Total Quantity:</td>
                          <td className="p-3 text-sm font-bold text-right">
                            {selected.items.reduce((sum: number, item: any) => sum + Number(item.quantity || 0), 0)}
                          </td>
                        </tr>
                      </tbody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-sm text-muted-foreground">
                    No items in this order
                  </div>
                )}
              </div>

              <Separator />

              {/* Action Buttons */}
              <DialogFooter className="gap-2">
                {selected.status === "PENDING" && (
                  <>
                    <Button 
                      variant="outline"
                      className="bg-red-50 hover:bg-red-100 text-red-700 border-red-200"
                      onClick={() => updateOrder(selected.id, 'cancel')}
                    >
                      <XCircle className="mr-2 h-4 w-4" />
                      Reject Order
                    </Button>
                    <Button 
                      className="bg-green-600 hover:bg-green-700"
                      onClick={() => updateOrder(selected.id, 'approve')}
                    >
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Approve Order
                    </Button>
                  </>
                )}
                {selected.status === "APPROVED" && (
                  <Button 
                    className="bg-blue-600 hover:bg-blue-700"
                    onClick={() => updateOrder(selected.id, 'fulfill')}
                  >
                    <Truck className="mr-2 h-4 w-4" />
                    Mark as Fulfilled
                  </Button>
                )}
                {(selected.status === "FULFILLED" || selected.status === "APPROVED") && (
                  <Button 
                    variant="outline"
                    onClick={() => setShowRefund(true)}
                  >
                    <DollarSign className="mr-2 h-4 w-4" />
                    Refund
                  </Button>
                )}
                <Button variant="secondary" onClick={() => setSelected(null)}>
                  Close
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Refund Modal */}
      <Dialog open={showRefund} onOpenChange={setShowRefund}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Refund Order</DialogTitle>
            <DialogDescription>Enter refund amount and optional reason.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1">Amount (USD)</label>
              <Input type="number" step="0.01" value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)} placeholder="0.00" />
              <p className="text-xs text-muted-foreground mt-1">Max: ${selected ? ((selected.totalCents||0)/100).toFixed(2) : '0.00'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Reason (optional)</label>
              <Input value={refundReason} onChange={(e) => setRefundReason(e.target.value)} placeholder="Reason" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRefund(false)}>Cancel</Button>
            <Button onClick={() => {
              const cents = Math.round(Number(refundAmount||'0')*100)
              if (!selected) return
              if (!Number.isFinite(cents) || cents <= 0) return toast({ title: 'Invalid amount', variant: 'destructive' })
              if (cents > (selected.totalCents||0)) return toast({ title: 'Amount exceeds order total', variant: 'destructive' })
              fetch(`/api/v1/orders/${selected.id}/refunds`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amountCents: cents, reason: refundReason||undefined }) })
                .then(async r => ({ ok: r.ok, json: await r.json() }))
                .then(async ({ ok, json }) => {
                  if (!ok) return toast({ title: 'Refund failed', description: json.error || 'Please try again', variant: 'destructive' })
                  toast({ title: 'Refund created' })
                  setShowRefund(false)
                  setRefundAmount('')
                  setRefundReason('')
                  setSelected(null)
                  await mutate()
                })
            }}>Submit Refund</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}


