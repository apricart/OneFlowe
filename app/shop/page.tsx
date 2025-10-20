"use client"
import React, { useMemo, useState } from "react"
import useSWR from "swr"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useToast } from "@/components/ui/use-toast"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { ShoppingBag, Search, Plus, Minus, Trash2, Home, X, CheckCircle, Clock, AlertTriangle, DollarSign, Star, Zap, Package, TrendingDown, Grid, LogOut } from "lucide-react"
import Image from "next/image"

const fetcher = (url: string) => fetch(url).then(r => r.json())

interface Product {
  id: number
  name: string
  code: string
  priceCents: number
  unit: string
  imageUrl?: string
  rating?: number
  stock?: number
}

interface CartItem extends Product {
  quantity: number
}

interface Order {
  id: number
  tid: string
  status: string
  totalCents: number
  createdAt: string
}

export default function OrderPortalPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()

  const [searchQuery, setSearchQuery] = useState("")
  const [sortBy, setSortBy] = useState("name")
  const [cart, setCart] = useState<CartItem[]>([])
  const [showCart, setShowCart] = useState(false)
  const [showCheckout, setShowCheckout] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [showProductDetail, setShowProductDetail] = useState(false)
  const [tempQuantity, setTempQuantity] = useState(1)

  // Auth check
  React.useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/shop/login")
    }
    if (status === "authenticated") {
      const userRole = (session?.user as any)?.role
      const isEmployee = (session?.user as any)?.isEmployee
      const isAdmin = userRole === "BRANCH_ADMIN" || userRole === "HEAD_OFFICE" || userRole === "SUPER_ADMIN"

      if (!isAdmin && !isEmployee) {
        router.push("/")
      }
    }
  }, [status, session, router])

  const userRole = (session?.user as any)?.role
  const isEmployee = (session?.user as any)?.isEmployee
  const isAdmin = userRole === "BRANCH_ADMIN" || userRole === "HEAD_OFFICE" || userRole === "SUPER_ADMIN"
  const userName = (session?.user as any)?.fullName || (session?.user as any)?.email || "User"

  const { data: branchInventory } = useSWR<any>("/api/v1/branch/inventory?visibility=visible", fetcher)
  const { data: budget } = useSWR<any>("/api/v1/budgets", fetcher)
  const { data: ordersData, mutate: mutateOrders } = useSWR<any>("/api/v1/orders", fetcher)

  const products: Product[] = useMemo(() => {
    return branchInventory?.items?.map((it: any) => ({
      id: it.organizationInventoryId,
      name: it.customName || it.productName,
      code: it.productCode,
      priceCents: it.customPrice ?? it.basePrice,
      unit: it.unit,
      imageUrl: it.productImageUrl,
      stock: it.stockQuantity,
      rating: Math.random() * 2 + 3.5,
    })) || []
  }, [branchInventory?.items])

  const filteredProducts = useMemo(() => {
    let filtered = products
    if (searchQuery) {
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.code.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    if (sortBy === "price-low") filtered.sort((a, b) => a.priceCents - b.priceCents)
    else if (sortBy === "price-high") filtered.sort((a, b) => b.priceCents - a.priceCents)
    else if (sortBy === "rating") filtered.sort((a, b) => (b.rating || 0) - (a.rating || 0))
    else filtered.sort((a, b) => a.name.localeCompare(b.name))
    return filtered
  }, [products, searchQuery, sortBy])

  const cartTotal = cart.reduce((sum, item) => sum + item.priceCents * item.quantity, 0)
  const remainingBudget = budget?.remainingCents || 0
  const canCheckout = cartTotal <= remainingBudget && cart.length > 0
  const budgetPercent = ((((budget?.amountAllocatedCents || 0) - remainingBudget) / (budget?.amountAllocatedCents || 1)) * 100)

  const openProductDetail = (product: Product) => {
    setSelectedProduct(product)
    setTempQuantity(1)
    setShowProductDetail(true)
  }

  const addToCartFromDetail = () => {
    if (selectedProduct && tempQuantity > 0) {
      addToCart(selectedProduct, tempQuantity)
      setShowProductDetail(false)
    }
  }

  const addToCart = (product: Product, qty: number = 1) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id)
      if (existing) {
        return prev.map(item =>
          item.id === product.id ? { ...item, quantity: Math.min(item.quantity + qty, item.stock || 999) } : item
        )
      }
      return [...prev, { ...product, quantity: Math.min(qty, product.stock || 999) }]
    })
    toast({ title: `${product.name} added to cart` })
  }

  const updateQty = (id: number, qty: number) => {
    if (qty <= 0) {
      removeFromCart(id)
    } else {
      setCart(prev => prev.map(item => item.id === id ? { ...item, quantity: qty } : item))
    }
  }

  const removeFromCart = (id: number) => {
    setCart(prev => prev.filter(item => item.id !== id))
  }

  const placeOrder = async () => {
    if (!canCheckout) return
    try {
      const res = await fetch("/api/v1/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cart.map(c => ({ organizationInventoryId: c.id, quantity: c.quantity })),
        })
      })
      const json = await res.json()
      if (!res.ok) return toast({ title: "Failed", description: json.error, variant: "destructive" })

      toast({ title: "Order placed!", description: `TID: ${json.order?.tid}` })
      setCart([])
      setShowCheckout(false)
      mutateOrders()
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    }
  }

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-white dark:from-slate-950 dark:to-slate-900">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-muted-foreground">Loading portal...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white dark:from-slate-950 dark:to-slate-900">
      {/* Modern Header */}
      <header className="sticky top-0 z-30 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg">
              <ShoppingBag className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Order Portal</h1>
              <p className="text-xs text-muted-foreground">Welcome, {userName}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Budget Status */}
            <div className="hidden md:flex items-center gap-2 px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-lg">
              <DollarSign className="h-4 w-4 text-green-600 dark:text-green-400" />
              <div className="text-sm">
                <p className="font-semibold text-slate-900 dark:text-white">${(remainingBudget / 100).toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">of ${((budget?.amountAllocatedCents || 0) / 100).toFixed(2)}</p>
              </div>
            </div>

            {/* Cart Button */}
            <Button
              onClick={() => setShowCart(!showCart)}
              variant={showCart ? "default" : "outline"}
              size="sm"
              className="gap-2"
            >
              <ShoppingBag className="h-4 w-4" />
              <span className="font-semibold">{cart.length}</span>
            </Button>

            {/* Back Button */}
            <Button
              onClick={() => router.push("/")}
              variant="ghost"
              size="icon"
              title="Back to dashboard"
            >
              <Home className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-4 md:p-6">
        {!showCart ? (
          <>
            {/* Search & Filters */}
            <div className="mb-8 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="relative md:col-span-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search products by name or code..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 h-11 text-base"
                  />
                </div>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="px-3 py-2 border rounded-lg bg-white dark:bg-slate-800 text-base font-medium"
                >
                  <option value="name">Sort: Name (A-Z)</option>
                  <option value="price-low">Price: Low to High</option>
                  <option value="price-high">Price: High to Low</option>
                  <option value="rating">Rating: Highest</option>
                </select>
              </div>

              {/* Budget Warning */}
              {cartTotal > remainingBudget && (
                <div className="p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
                  <p className="text-sm text-red-700 dark:text-red-300">Cart exceeds remaining budget</p>
                </div>
              )}
            </div>

            {/* Products Grid */}
            {filteredProducts.length === 0 ? (
              <div className="text-center py-16">
                <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium text-muted-foreground">No products found</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredProducts.map(product => (
                  <div
                    key={product.id}
                    onClick={() => openProductDetail(product)}
                    className="group cursor-pointer"
                  >
                    <Card className="overflow-hidden hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 h-full flex flex-col bg-white dark:bg-slate-800">
                      {/* Product Image */}
                      <div className="relative h-48 bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-800 overflow-hidden group-hover:bg-gradient-to-tl transition-all">
                        {product.imageUrl ? (
                          <img
                            src={product.imageUrl}
                            alt={product.name}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <ShoppingBag className="h-16 w-16 text-slate-400 opacity-30" />
                          </div>
                        )}

                        {/* Stock Badge */}
                        {product.stock !== undefined && (
                          <Badge
                            className={`absolute top-2 right-2 ${
                              product.stock > 10
                                ? "bg-green-500"
                                : product.stock > 0
                                ? "bg-yellow-500"
                                : "bg-red-500"
                            }`}
                          >
                            {product.stock > 0 ? `${product.stock} in stock` : "Out of stock"}
                          </Badge>
                        )}

                        {/* Discount Badge (optional) */}
                        <Badge className="absolute top-2 left-2 bg-blue-600">
                          <Zap className="h-3 w-3 mr-1" />
                          Trending
                        </Badge>
                      </div>

                      {/* Product Info */}
                      <div className="p-4 space-y-3 flex-1 flex flex-col">
                        {/* Name & Code */}
                        <div>
                          <h3 className="font-bold text-sm line-clamp-2 text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                            {product.name}
                          </h3>
                          <p className="text-xs text-muted-foreground font-mono">{product.code}</p>
                        </div>

                        {/* Rating */}
                        <div className="flex items-center gap-1">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              className={`h-3 w-3 ${
                                i < Math.floor(product.rating || 0)
                                  ? "fill-yellow-400 text-yellow-400"
                                  : "text-slate-300"
                              }`}
                            />
                          ))}
                          <span className="text-xs text-muted-foreground ml-1">
                            {(product.rating || 0).toFixed(1)}
                          </span>
                        </div>

                        {/* Spacer */}
                        <div className="flex-1" />

                        {/* Price & Unit */}
                        <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-700">
                          <div>
                            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                              ${(product.priceCents / 100).toFixed(2)}
                            </p>
                            <p className="text-xs text-muted-foreground">per {product.unit}</p>
                          </div>
                          <Button
                            onClick={(e) => {
                              e.stopPropagation()
                              addToCart(product)
                            }}
                            size="sm"
                            disabled={product.stock === 0}
                            className="gap-1"
                          >
                            <Plus className="h-3 w-3" />
                            <span className="hidden sm:inline">Add</span>
                          </Button>
                        </div>
                      </div>
                    </Card>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          /* Cart View */
          <div className="max-w-2xl mx-auto">
            <Card className="bg-white dark:bg-slate-800">
              <div className="p-6 space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold">Shopping Cart</h2>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowCart(false)}
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>

                {cart.length === 0 ? (
                  <div className="text-center py-8">
                    <ShoppingBag className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                    <p className="text-muted-foreground">Your cart is empty</p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {cart.map(item => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors"
                        >
                          <div className="flex-1">
                            <p className="font-medium text-slate-900 dark:text-white">{item.name}</p>
                            <p className="text-sm text-muted-foreground">
                              ${(item.priceCents / 100).toFixed(2)} each × {item.quantity}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-8 w-8"
                              onClick={() => updateQty(item.id, item.quantity - 1)}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="w-8 text-center font-semibold text-sm">
                              {item.quantity}
                            </span>
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-8 w-8"
                              onClick={() => updateQty(item.id, item.quantity + 1)}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-destructive"
                              onClick={() => removeFromCart(item.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="h-px bg-slate-200 dark:bg-slate-700" />

                    {/* Cart Summary */}
                    <div className="space-y-3">
                      <div className="flex justify-between text-lg font-bold">
                        <span>Total:</span>
                        <span className="text-blue-600 dark:text-blue-400">
                          ${(cartTotal / 100).toFixed(2)}
                        </span>
                      </div>

                      {/* Budget Progress */}
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Budget Used</span>
                          <span className="font-medium">
                            {cartTotal > remainingBudget ? (
                              <span className="text-destructive">
                                ${(cartTotal / 100).toFixed(2)} / ${((budget?.amountAllocatedCents || 0) / 100).toFixed(2)}
                              </span>
                            ) : (
                              <span className="text-green-600 dark:text-green-400">
                                ${(cartTotal / 100).toFixed(2)} / ${((budget?.amountAllocatedCents || 0) / 100).toFixed(2)}
                              </span>
                            )}
                          </span>
                        </div>
                        <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all ${
                              cartTotal > remainingBudget
                                ? "bg-red-500"
                                : "bg-gradient-to-r from-green-500 to-blue-500"
                            }`}
                            style={{
                              width: `${Math.min(
                                100,
                                ((cartTotal) / (budget?.amountAllocatedCents || 1)) * 100
                              )}%`,
                            }}
                          />
                        </div>
                      </div>

                      {cartTotal > remainingBudget && (
                        <div className="p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
                          <p className="text-sm text-red-700 dark:text-red-300">
                            Exceeds budget by ${(((cartTotal - remainingBudget) / 100).toFixed(2))}
                          </p>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-3 pt-4">
                        <Button
                          onClick={() => setShowCart(false)}
                          variant="outline"
                          className="h-11"
                        >
                          Continue Shopping
                        </Button>
                        <Button
                          onClick={() => setShowCheckout(true)}
                          disabled={!canCheckout}
                          className="h-11"
                        >
                          Checkout
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </Card>
          </div>
        )}
      </div>

      {/* Product Detail Modal */}
      <Dialog open={showProductDetail} onOpenChange={setShowProductDetail}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Product Details</DialogTitle>
          </DialogHeader>

          {selectedProduct && (
            <div className="space-y-4">
              {/* Product Image */}
              <div className="h-64 bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-800 rounded-lg overflow-hidden">
                {selectedProduct.imageUrl ? (
                  <img
                    src={selectedProduct.imageUrl}
                    alt={selectedProduct.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ShoppingBag className="h-20 w-20 text-slate-400 opacity-30" />
                  </div>
                )}
              </div>

              {/* Details */}
              <div className="space-y-3">
                <div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                    {selectedProduct.name}
                  </h3>
                  <p className="text-sm text-muted-foreground font-mono">
                    Code: {selectedProduct.code}
                  </p>
                </div>

                <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <div>
                    <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                      ${(selectedProduct.priceCents / 100).toFixed(2)}
                    </p>
                    <p className="text-sm text-muted-foreground">per {selectedProduct.unit}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Stock</p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">
                      {selectedProduct.stock || 0}
                    </p>
                  </div>
                </div>

                {/* Rating */}
                <div className="flex items-center gap-2">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`h-4 w-4 ${
                        i < Math.floor(selectedProduct.rating || 0)
                          ? "fill-yellow-400 text-yellow-400"
                          : "text-slate-300"
                      }`}
                    />
                  ))}
                  <span className="text-sm text-muted-foreground">
                    {(selectedProduct.rating || 0).toFixed(1)} rating
                  </span>
                </div>

                {/* Quantity Selector */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Quantity</label>
                  <div className="flex items-center gap-2">
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => setTempQuantity(Math.max(1, tempQuantity - 1))}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <Input
                      type="number"
                      value={tempQuantity}
                      onChange={(e) => setTempQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                      className="text-center h-10 font-bold text-lg"
                      min="1"
                    />
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => setTempQuantity(tempQuantity + 1)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setShowProductDetail(false)}
                >
                  Close
                </Button>
                <Button
                  onClick={addToCartFromDetail}
                  disabled={selectedProduct.stock === 0}
                  className="gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add to Cart
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Checkout Modal */}
      <Dialog open={showCheckout} onOpenChange={setShowCheckout}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Order Confirmation</DialogTitle>
            <DialogDescription>Review your order before placing</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="max-h-48 overflow-y-auto space-y-2">
              {cart.map(item => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span>{item.name} x{item.quantity}</span>
                  <span className="font-semibold">${((item.priceCents * item.quantity) / 100).toFixed(2)}</span>
                </div>
              ))}
            </div>

            <div className="h-px bg-slate-200 dark:bg-slate-700" />

            <div className="space-y-2 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
              <div className="flex justify-between font-bold text-lg">
                <span>Total:</span>
                <span className="text-blue-600 dark:text-blue-400">
                  ${(cartTotal / 100).toFixed(2)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Remaining Budget: ${((remainingBudget - cartTotal) / 100).toFixed(2)}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCheckout(false)}
            >
              Back
            </Button>
            <Button onClick={placeOrder}>
              Place Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
