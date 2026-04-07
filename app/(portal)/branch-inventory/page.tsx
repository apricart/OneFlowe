"use client"

import { useMemo, useState, useEffect } from "react"
import useSWR from "swr"
import { motion, AnimatePresence } from "framer-motion"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useAppContext } from "@/components/context/app-context"
import { useSession } from "next-auth/react"
import { Role } from "@/lib/rbac"
import { formatPKR, cn } from "@/lib/utils"
import { 
  Search, 
  Package, 
  Sparkles, 
  Box, 
  LayoutGrid, 
  Filter, 
  RefreshCw, 
  ChevronRight,
  Info,
  AlertCircle,
  CheckCircle2
} from "lucide-react"
import { BankingKPICard } from "@/components/dashboard/banking-kpi-card"
import { Button } from "@/components/ui/button"

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
  categoryName: string
  parentCategoryName?: string
  basePrice: number
  unit: string
  isVisible: boolean
  isActive: boolean
  stockQuantity: number
  reorderThreshold: number
  assignedAt: string
}

export default function BranchInventoryPage() {
  const { data: session } = useSession()
  const role = (session?.user as any)?.role as Role
  const userBranchId = (session?.user as any)?.branchId
  const userOrgId = (session?.user as any)?.organizationId

  const { branchId, organizationId } = useAppContext()
  const [searchQuery, setSearchQuery] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [subCategoryFilter, setSubCategoryFilter] = useState("all")

  const params = new URLSearchParams()
  params.set("search", searchQuery)
  if (categoryFilter !== "all") params.set("category", categoryFilter)
  if (subCategoryFilter !== "all") params.set("subCategory", subCategoryFilter)
  
  if (role === "BRANCH_ADMIN") {
    const adminBranchId = userBranchId || branchId
    if (userOrgId) params.set("organizationId", String(userOrgId))
    if (adminBranchId) params.set("branchId", String(adminBranchId))
  } else {
    if (branchId) params.set("branchId", String(branchId))
    if (organizationId) params.set("organizationId", String(organizationId))
  }

  const { data, isLoading, mutate } = useSWR<{
    items: BranchInventoryItem[]
    total: number
  }>(`/api/v1/branch/inventory?${params.toString()}`, fetcher, {
    fallbackData: { items: [], total: 0 },
    refreshInterval: 5000,
  })

  const inventory = data?.items ?? []
  const totalProducts = data?.total ?? 0
  const lowStock = useMemo(
    () => inventory.filter((item) => item.stockQuantity <= item.reorderThreshold && item.stockQuantity > 0).length,
    [inventory]
  )

  return (
    <motion.main 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 lg:p-6 space-y-6 max-w-[2000px] mx-auto overflow-x-hidden"
    >
      {/* ━━━ Premium Header ━━━ */}
      <div className="relative z-30 flex flex-col md:flex-row md:items-center justify-between gap-6 mb-2">
        <div className="space-y-1 px-2">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 rounded-lg">
              <Box className="w-5 h-5 text-indigo-500" />
            </div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Assigned Inventory</h1>
          </div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Direct SKUs from Head Office for your branch</p>
        </div>
        
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            onClick={() => mutate()} 
            className="h-10 px-4 rounded-xl border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-all shadow-sm gap-2 text-xs font-bold uppercase tracking-wider"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh Data
          </Button>
        </div>
      </div>

      {/* ━━━ KPI Stats ━━━ */}
      <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6 mb-8">
        <BankingKPICard
          icon={Package}
          title="Assigned Products"
          value={totalProducts}
          subtitle="Currently active SKUs"
          gradient="from-blue-500 to-indigo-600"
          iconBg="text-blue-600 bg-blue-600"
          delay={0}
        />
        <BankingKPICard
          icon={AlertCircle}
          title="Low Stock"
          value={lowStock}
          subtitle="Requires attention"
          gradient="from-amber-400 to-orange-500"
          iconBg="text-amber-600 bg-amber-600"
          delay={50}
        />
      </div>

      {/* ━━━ Inventory Management Table ━━━ */}
      <Card className="border border-slate-200/80 dark:border-slate-800/60 shadow-sm bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl overflow-hidden glass-card rounded-[2rem]">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800/50 bg-slate-50/50 dark:bg-slate-800/20">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <LayoutGrid className="w-5 h-5 text-indigo-500" />
              <h3 className="text-lg font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest">Branch Catalog</h3>
            </div>
            
            <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
              <div className="relative group flex-1 md:flex-none">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                <Input
                  placeholder="Search products or SKU..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 w-full md:w-72 h-11 rounded-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-indigo-500/20 transition-all text-sm font-medium"
                />
              </div>

              <CategoryFilter value={categoryFilter} onChange={(val) => { setCategoryFilter(val); setSubCategoryFilter('all'); }} />
              <SubcategoryFilter categoryId={categoryFilter} value={subCategoryFilter} onChange={setSubCategoryFilter} />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-slate-100 dark:border-slate-800/50 hover:bg-transparent">
                <TableHead className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Product Info</TableHead>
                <TableHead className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Category Path</TableHead>
                <TableHead className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Pricing</TableHead>
                <TableHead className="px-6 py-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Stock Status</TableHead>
                <TableHead className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <AnimatePresence mode="popLayout">
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-64 text-center">
                      <div className="flex flex-col items-center justify-center gap-3 animate-pulse">
                        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                          <RefreshCw className="h-10 w-10 text-slate-300 dark:text-slate-600 animate-spin" />
                        </div>
                        <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Loading Catalog...</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : inventory.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-64 text-center">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                          <Package className="h-10 w-10 text-slate-300 dark:text-slate-600" />
                        </div>
                        <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">No assigned products found</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  inventory.map((item, idx) => (
                    <motion.tr
                      key={item.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.02 }}
                      className="group border-b border-slate-50 dark:border-slate-800/30 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                    >
                      <TableCell className="px-6 py-4">
                        <div className="flex items-center gap-4">
                          <div className="relative group-hover:scale-110 transition-transform duration-300">
                            {item.customImageUrl || item.productImageUrl ? (
                              <img
                                src={item.customImageUrl || item.productImageUrl}
                                alt={item.productName}
                                className="w-14 h-14 object-cover rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm"
                              />
                            ) : (
                              <div className="w-14 h-14 bg-slate-100 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center justify-center">
                                <Package className="w-6 h-6 text-slate-300 dark:text-slate-500" />
                              </div>
                            )}
                            <div className={cn(
                              "absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-white dark:border-slate-900",
                              item.isVisible ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" : "bg-slate-300 dark:bg-slate-600"
                            )} />
                          </div>
                          <div>
                            <div className="font-black text-slate-900 dark:text-white text-sm tracking-tight leading-tight mb-0.5">
                              {item.customName || item.productName}
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-[9px] font-black uppercase px-1.5 py-0 border-slate-200 dark:border-slate-700 text-slate-500">
                                {item.productCode}
                              </Badge>
                              <span className="text-[10px] font-bold text-slate-400 uppercase">{item.unit}</span>
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      
                      <TableCell className="px-6 py-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">{item.parentCategoryName || "Global"}</span>
                            <ChevronRight className="h-3 w-3 text-slate-400" />
                            <span className="text-xs font-bold text-indigo-500 uppercase tracking-wider">{item.categoryName}</span>
                          </div>
                        </div>
                      </TableCell>

                      <TableCell className="px-6 py-4">
                        <div className="space-y-0.5">
                          <div className="text-sm font-black text-indigo-600 dark:text-indigo-400 tracking-tight">
                            {formatPKR((item.customPrice ?? item.basePrice) / 100, { maximumFractionDigits: 0 })}
                          </div>
                        </div>
                      </TableCell>

                      <TableCell className="px-6 py-4">
                        <div className="flex justify-center">
                          <div className={cn(
                            "flex items-center gap-2 px-3 py-1.5 rounded-full border shadow-sm transition-all duration-300",
                            item.stockQuantity > item.reorderThreshold 
                              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400 ring-4 ring-emerald-500/5" 
                              : item.stockQuantity > 0
                                ? "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400 ring-4 ring-amber-500/5"
                                : "bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400 ring-4 ring-rose-500/5"
                          )}>
                            <div className={cn(
                              "w-1.5 h-1.5 rounded-full animate-pulse", 
                              item.stockQuantity > item.reorderThreshold ? "bg-emerald-500" : item.stockQuantity > 0 ? "bg-amber-500" : "bg-rose-500"
                            )} />
                            <span className="text-[10px] font-black uppercase tracking-widest">
                              {item.stockQuantity > 0 ? `${item.stockQuantity} in Stock` : "Stock Out"}
                            </span>
                          </div>
                        </div>
                      </TableCell>

                      <TableCell className="px-6 py-4 text-right">
                        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-indigo-500 transition-all">
                          <ChevronRight className="h-5 w-5" />
                        </Button>
                      </TableCell>
                    </motion.tr>
                  ))
                )}
              </AnimatePresence>
            </TableBody>
          </Table>
        </div>
        
        <div className="p-6 border-t border-slate-100 dark:border-slate-800/50 bg-slate-50/50 dark:bg-slate-800/10">
          <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            <Info className="w-3.5 h-3.5 text-indigo-500" />
            Showing {inventory.length} of {totalProducts} assigned products
          </div>
        </div>
      </Card>
    </motion.main>
  )
}

const CategoryFilter = ({ value, onChange }: { value: string, onChange: (val: string) => void }) => {
  const { data } = useSWR<{ items: { id: number, name: string }[] }>('/api/v1/categories?limit=100', fetcher)
  return (
    <div className="relative group">
      <Filter className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-indigo-500 z-10" />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pl-10 pr-4 h-11 rounded-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-indigo-500/20 transition-all text-[10px] font-black uppercase tracking-wider appearance-none w-full lg:w-48 shadow-sm cursor-pointer"
      >
        <option value="all">All Categories</option>
        {data?.items?.map((cat) => (
          <option key={cat.id} value={cat.id.toString()}>
            {cat.name}
          </option>
        ))}
      </select>
    </div>
  )
}

const SubcategoryFilter = ({ categoryId, value, onChange }: { categoryId: string, value: string, onChange: (val: string) => void }) => {
  const query = categoryId !== 'all'
    ? `/api/v1/subcategories?categoryId=${categoryId}&limit=100`
    : '/api/v1/subcategories?limit=100'
  const { data } = useSWR<{ items: { id: number, name: string }[] }>(query, fetcher)

  return (
    <div className="relative group">
      <LayoutGrid className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-indigo-500 z-10" />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pl-10 pr-4 h-11 rounded-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-indigo-500/20 transition-all text-[10px] font-black uppercase tracking-wider appearance-none w-full lg:w-48 shadow-sm cursor-pointer"
      >
        <option value="all">All Subcategories</option>
        {data?.items?.map((cat) => (
          <option key={cat.id} value={cat.id.toString()}>
            {cat.name}
          </option>
        ))}
      </select>
    </div>
  )
}
