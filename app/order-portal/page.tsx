"use client"
import React, { useMemo, useState } from "react"
import useSWR from "swr"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ShoppingCart, Search, Filter, Plus, Minus } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export default function OrderPortalPage() {
  const { toast } = useToast()
  const { data: session } = useSWR<any>("/api/auth/session", fetcher)
  const role = (session?.user as any)?.role
  const isHeadOffice = role === "HEAD_OFFICE" || role === "SUPER_ADMIN"

  const { data: branchInventory } = useSWR<any>(!isHeadOffice ? "/api/v1/branch/inventory?visibility=visible" : null, fetcher)
  const { data: orgInventory } = useSWR<any>(isHeadOffice ? "/api/v1/head-office/organization-inventory?status=active" : null, fetcher)
  const { data: budget } = useSWR<any>(!isHeadOffice ? "/api/v1/budgets" : null, fetcher)

  const [branchId, setBranchId] = useState<string>("")
  const [query, setQuery] = useState("")
  const [cart, setCart] = useState<{ id: number; name: string; qty: number }[]>([])

  const catalog = useMemo(() => {
    const items = isHeadOffice ? (orgInventory?.items || []) : (branchInventory?.items || [])
    return items
      .map((it: any) => ({
        id: isHeadOffice ? it.id : it.organizationInventoryId,
        name: it.customName || it.productName,
        code: it.productCode,
        imageUrl: it.productImageUrl,
        priceCents: it.customPrice ?? it.basePrice,
        unit: it.unit,
        category: it.categoryName || "",
      }))
      .filter((p: any) => !query || p.name.toLowerCase().includes(query.toLowerCase()) || p.code?.toLowerCase().includes(query.toLowerCase()))
  }, [isHeadOffice, orgInventory?.items, branchInventory?.items, query])

  const add = (id: number, name: string) => setCart(prev => {
    const ex = prev.find(i => i.id === id); if (ex) return prev.map(i => i.id === id ? { ...i, qty: i.qty + 1 } : i)
    return [...prev, { id, name, qty: 1 }]
  })
  const upd = (id: number, d: number) => setCart(prev => prev.map(i => i.id === id ? { ...i, qty: Math.max(0, i.qty + d) } : i).filter(i => i.qty > 0))
  const place = async () => {
    if (cart.length === 0) return
    const res = await fetch("/api/v1/orders", { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: cart.map(c => ({ organizationInventoryId: c.id, quantity: c.qty })), ...(isHeadOffice && branchId ? { branchId: Number(branchId) } : {}) }) })
    const json = await res.json()
    if (!res.ok) return toast({ title: 'Order failed', description: json.error || 'Try again', variant: 'destructive' })
    toast({ title: 'Order placed', description: `TID: ${json.order?.tid}` })
    setCart([])
  }

  return (
    <main className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search products..." value={query} onChange={(e) => setQuery(e.target.value)} className="w-72" />
        </div>
        <div className="flex items-center gap-3">
          {!isHeadOffice && (
            <div className="text-sm rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-1.5 text-emerald-700">
              Remaining: ${((budget?.remainingCents || 0)/100).toFixed(2)}
            </div>
          )}
          {isHeadOffice && (
            <Input placeholder="Branch ID" value={branchId} onChange={(e) => setBranchId(e.target.value)} className="w-40" />
          )}
          <Button onClick={place} disabled={cart.length === 0 || (isHeadOffice && !branchId)}>
            <ShoppingCart className="h-4 w-4 mr-2" /> Place Order ({cart.reduce((s,c)=>s+c.qty,0)})
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {catalog.map((p: any) => (
          <Card key={p.id} className="p-3 flex flex-col gap-3">
            <div className="aspect-[4/3] w-full bg-muted rounded-md border overflow-hidden flex items-center justify-center">
              {p.imageUrl ? <img src={p.imageUrl} className="object-cover w-full h-full" alt={p.name} /> : <span className="text-xs text-muted-foreground">No image</span>}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate" title={p.name}>{p.name}</div>
              <div className="text-xs text-muted-foreground">{p.code}</div>
              <div className="mt-1 flex items-center justify-between">
                <div className="text-sm font-semibold">${(Number(p.priceCents||0)/100).toFixed(2)} {p.unit}</div>
                {p.category && <Badge variant="outline" className="text-xs">{p.category}</Badge>}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Button size="sm" variant="outline" onClick={() => upd(p.id, -1)}><Minus className="h-4 w-4" /></Button>
              <Button size="sm" onClick={() => add(p.id, p.name)} className="gap-2"><Plus className="h-4 w-4" /> Add</Button>
            </div>
          </Card>
        ))}
      </div>
    </main>
  )
}


