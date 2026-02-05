"use client"

import { useMemo, useState } from "react"
import useSWR from "swr"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useAppContext } from "@/components/context/app-context"
import { formatPKR } from "@/lib/utils"
import { Search, Package, Sparkles, Eye, AlertTriangle } from "lucide-react"

const fetcher = (url: string) => fetch(url).then((res) => res.json())

type BranchInventoryItem = {
  id: number
  productName: string
  productCode: string
  productImageUrl?: string
  customName?: string
  customPrice?: number
  customDescription?: string
  customImageUrl?: string
  categoryName?: string
  basePrice: number
  unit: string
  isVisible: boolean
  isActive: boolean
  stockQuantity: number
  reorderThreshold: number
  assignedAt: string
}

export default function BranchInventoryPage() {
  const { branchId, organizationId } = useAppContext()
  const [searchQuery, setSearchQuery] = useState("")
  const [visibilityFilter, setVisibilityFilter] = useState("all")

  const params = new URLSearchParams()
  params.set("search", searchQuery)
  params.set("visibility", visibilityFilter)
  if (branchId) params.set("branchId", String(branchId))
  if (organizationId) params.set("organizationId", String(organizationId))

  const { data, isLoading } = useSWR<{
    items: BranchInventoryItem[]
    total: number
  }>(`/api/v1/branch/inventory?${params.toString()}`, fetcher, {
    fallbackData: { items: [], total: 0 },
    revalidateOnFocus: false,
  })

  const inventory = data?.items ?? []
  const totalProducts = data?.total ?? 0
  const visibleProducts = useMemo(() => inventory.filter((item) => item.isVisible).length, [inventory])
  const lowStock = useMemo(
    () => inventory.filter((item) => item.stockQuantity <= item.reorderThreshold && item.stockQuantity > 0).length,
    [inventory]
  )
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 space-y-8 p-6">
      <Card className="relative overflow-hidden border-none bg-gradient-to-r from-slate-900 via-purple-900 to-indigo-800 text-white shadow-xl">
        <div className="pointer-events-none absolute inset-0 opacity-30">
          <div className="absolute -top-16 right-0 h-48 w-48 rounded-full bg-white/30 blur-3xl" />
          <div className="absolute bottom-0 left-0 h-32 w-32 rounded-full bg-indigo-400/40 blur-3xl" />
        </div>
        <CardHeader className="relative space-y-3">
          <p className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-white/70">
            <Sparkles className="h-4 w-4" />
            Branch Catalog
          </p>
          <CardTitle className="text-3xl font-semibold text-white">Assigned branch inventory</CardTitle>
          <p className="text-sm text-white/80">
            All SKUs below come directly from Head Office. Branches can monitor stock levels and visibility, but any changes
            to product details must be requested from Admin.
          </p>
        </CardHeader>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <SummaryCard label="Total products" value={totalProducts} helper="Currently assigned" accent="from-blue-500 to-cyan-500" />
        <SummaryCard label="Visible to customers" value={visibleProducts} helper={`${totalProducts - visibleProducts} hidden`} accent="from-emerald-500 to-lime-500" />
      </div>

      <Card className="border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-slate-900/50 bg-white dark:bg-slate-900">
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle className="text-xl text-slate-900 dark:text-white">Branch product list</CardTitle>
            <p className="text-sm text-muted-foreground">Real-time view of branch-ready SKUs, including stock alerts.</p>
          </div>
          <div className="flex flex-col gap-3 w-full lg:flex-row lg:items-center lg:justify-end">
            <div className="relative w-full lg:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or code"
                className="pl-9"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </div>
            <select
              value={visibilityFilter}
              onChange={(event) => setVisibilityFilter(event.target.value)}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="all">All products</option>
              <option value="visible">Visible only</option>
              <option value="hidden">Hidden only</option>
            </select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Unit Price</TableHead>
                  <TableHead>Visibility</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-10 text-center text-sm text-muted-foreground">
                      Loading branch inventory…
                    </TableCell>
                  </TableRow>
                ) : inventory.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-10 text-center text-sm text-muted-foreground">
                      No products have been assigned to this branch. Once Head Office shares SKUs, they will appear here.
                    </TableCell>
                  </TableRow>
                ) : (
                  inventory.map((item) => (
                    <TableRow key={item.id} className="hover:bg-muted/40">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {item.customImageUrl || item.productImageUrl ? (
                            <img
                              src={item.customImageUrl || item.productImageUrl}
                              alt={item.productName}
                              className="h-12 w-12 rounded-lg border object-cover"
                            />
                          ) : (
                            <div className="flex h-12 w-12 items-center justify-center rounded-lg border bg-muted/40">
                              <Package className="h-5 w-5 text-muted-foreground" />
                            </div>
                          )}
                          <div>
                            <p className="font-medium text-slate-900 dark:text-white">{item.customName || item.productName}</p>
                            <p className="text-xs text-muted-foreground">{item.productCode}</p>
                            {item.customDescription && (
                              <p className="text-xs text-muted-foreground line-clamp-1">{item.customDescription}</p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{item.categoryName || "Uncategorized"}</Badge>
                      </TableCell>
                      <TableCell>{formatPKR((item.customPrice ?? item.basePrice) / 100)}</TableCell>
                      <TableCell>
                        <Badge variant={item.isVisible ? "default" : "secondary"}>
                          {item.isVisible ? (
                            <span className="inline-flex items-center gap-1">
                              <Eye className="h-3 w-3" /> Visible
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1">
                              <Eye className="h-3 w-3" /> Hidden
                            </span>
                          )}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function SummaryCard({
  label,
  value,
  helper,
  accent,
}: {
  label: string
  value: string | number
  helper: string
  accent: string
}) {
  return (
    <Card className="border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-slate-900/50 bg-white dark:bg-slate-900">
      <CardContent className="p-5 space-y-2">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold text-slate-900 dark:text-white">{value}</p>
        <p className="text-xs text-muted-foreground">{helper}</p>
        <div className={`h-1 rounded-full bg-gradient-to-r ${accent}`} />
      </CardContent>
    </Card>
  )
}

