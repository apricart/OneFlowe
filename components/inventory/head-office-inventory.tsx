"use client"
import React, { useState, useMemo } from "react"
import { Card } from "@/components/ui/card"
import { SectionHeader } from "@/components/ui/section-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table } from "@/components/ui/table"
import {
  Package,
  Search,
  RefreshCw,
  MapPin,
  Check,
  AlertCircle
} from "lucide-react"
import useSWR from "swr"
import { useToast } from "@/components/ui/use-toast"
import { formatPKR } from "@/lib/utils"

const fetcher = (url: string) => fetch(url).then(res => res.json())

interface AssignedProduct {
  id: number
  productId: number
  organizationId: number
  isEnabled: boolean
  customName: string | null
  customPrice: number | null
  customDescription: string | null
  overrideLevel: string | null
  createdAt: string
  productName: string
  productCode: string
  productImageUrl: string | null
  categoryName: string | null
  basePrice: number
  unit: string
}

interface Branch {
  id: number
  name: string
  address: string | null
  isActive: boolean
}

export default function HeadOfficeInventory({ organizationId }: { organizationId: number }) {
  const { toast } = useToast()
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedProducts, setSelectedProducts] = useState<number[]>([])

  // Fetch assigned products
  const { data: assignedProducts, error: assignedError, isLoading: assignedLoading } = useSWR<{
    items: AssignedProduct[]
    total: number
  }>(`/api/v1/inventory/assignments?organizationId=${organizationId}`, fetcher)

  // Fetch branches for this organization
  const { data: branches } = useSWR<Branch[]>(`/api/v1/branches?organizationId=${organizationId}`, fetcher)

  // Filter assigned products
  const filteredProducts = useMemo(() => {
    if (!assignedProducts?.items) return []

    let filtered = assignedProducts.items

    // Strictly show only active products as per user requirement
    filtered = filtered.filter(p => p.isEnabled)

    if (searchQuery) {
      filtered = filtered.filter(p =>
        p.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.productCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.customName?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    return filtered
  }, [assignedProducts?.items, searchQuery])

  // Calculate summary stats
  const totalAssigned = assignedProducts?.total || 0
  const activeAssigned = useMemo(() => {
    if (!assignedProducts?.items) return 0
    return assignedProducts.items.filter(p => p.isEnabled).length
  }, [assignedProducts?.items])

  const totalBranches = branches?.length || 0

  const toggleProductSelection = (productId: number) => {
    setSelectedProducts(prev =>
      prev.includes(productId)
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    )
  }

  const selectAllProducts = () => {
    setSelectedProducts(
      selectedProducts.length === filteredProducts.length
        ? []
        : filteredProducts.map(p => p.id)
    )
  }

  if (assignedLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Loading assigned products...</p>
        </div>
      </div>
    )
  }

  if (assignedError) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
          <p className="text-sm text-red-600">Failed to load assigned products</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Organization Inventory"
        subtitle="Manage products assigned to your organization"
      />

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Assigned Products</h3>
          <div className="flex gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
              <Input
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 w-64"
              />
            </div>
          </div>
        </div>

        <Card>
          <Table>
            <thead>
              <tr>
                <th className="text-left p-4 font-medium w-12">
                  <input
                    type="checkbox"
                    checked={selectedProducts.length === filteredProducts.length && filteredProducts.length > 0}
                    onChange={selectAllProducts}
                    className="rounded"
                  />
                </th>
                <th className="text-left p-4 font-medium">Product</th>
                <th className="text-left p-4 font-medium">Status</th>
                <th className="text-left p-4 font-medium">Custom Name</th>
                <th className="text-left p-4 font-medium">Custom Price</th>
                <th className="text-right p-4 font-medium">Override Level</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-500">
                    No active assigned products found
                  </td>
                </tr>
              ) : (
                filteredProducts.map(product => (
                  <tr key={product.id} className="hover:bg-gray-50">
                    <td className="p-4">
                      <input
                        type="checkbox"
                        checked={selectedProducts.includes(product.id)}
                        onChange={() => toggleProductSelection(product.id)}
                        className="rounded"
                      />
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        {product.productImageUrl ? (
                          <img
                            src={product.productImageUrl}
                            alt={product.productName}
                            className="w-12 h-12 object-cover rounded-lg border"
                          />
                        ) : (
                          <div className="w-12 h-12 bg-gray-100 rounded-lg border flex items-center justify-center">
                            <Package className="w-6 h-6 text-gray-400" />
                          </div>
                        )}
                        <div>
                          <div className="font-medium">{product.productName}</div>
                          <div className="text-xs text-gray-500">{product.productCode}</div>
                          <div className="text-xs text-gray-500">{product.categoryName || "No Category"}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <Badge
                        variant={product.isEnabled ? "default" : "secondary"}
                        className={product.isEnabled ? "bg-green-100 text-green-800" : ""}
                      >
                        {product.isEnabled ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td className="p-4">
                      <div className="text-sm">{product.customName || "-"}</div>
                    </td>
                    <td className="p-4">
                      <div className="text-sm">
                        {product.customPrice
                          ? formatPKR(product.customPrice / 100)
                          : formatPKR(product.basePrice / 100)}
                      </div>
                    </td>
                    <td className="p-4 text-right">
                      <Badge
                        variant={product.overrideLevel === "super_admin" ? "default" :
                          product.overrideLevel === "head_office" ? "secondary" : "outline"}
                        className={product.overrideLevel === "super_admin" ? "bg-blue-100 text-blue-800" :
                          product.overrideLevel === "head_office" ? "bg-green-100 text-green-800" : ""}
                      >
                        {product.overrideLevel?.replace("_", " ").toUpperCase() || "SUPER ADMIN"}
                      </Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
        </Card>
      </div>
    </div>
  )
}