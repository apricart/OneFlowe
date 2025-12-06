"use client"

import React, { useState, useMemo } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Plus,
  Search,
  Edit,
  Trash2,
  FolderTree,
  Package,
} from "lucide-react"
import useSWR from "swr"

interface Category {
  id: number
  name: string
  parentId: number | null
  createdAt: string
  updatedAt: string
  subCategoriesCount: number
  productsCount?: number
}

const fetcher = (url: string) => fetch(url).then(res => res.json())

export default function CategoriesPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    parentId: null as number | null,
  })

  // Fetch only top-level (parent) categories
  const { data, error, isLoading, mutate } = useSWR<{ items: Category[] }>(
    `/api/v1/categories?type=parent&search=${searchQuery}`,
    fetcher
  )

  const categories = data?.items || []

  // Fetch all subcategories so we can map products from subcategories up to their parents
  interface SubCategory {
    id: number
    name: string
    parentId: number
  }

  const { data: subCategoriesData } = useSWR<{ items: SubCategory[] }>(
    `/api/v1/subcategories?search=&parentId=`,
    fetcher
  )
  const allSubCategories = subCategoriesData?.items || []

  // Compute subcategory counts per parent category client-side
  const subCategoriesByParent = useMemo(() => {
    const map = new Map<number, number>()
    for (const sub of allSubCategories) {
      map.set(sub.parentId, (map.get(sub.parentId) || 0) + 1)
    }
    return map
  }, [allSubCategories])

  // Fetch global products to compute product counts client-side
  interface GlobalProduct {
    id: number
    categoryId: number | null
    metadata?: { subCategoryId?: number } | null
  }

  const { data: productsData } = useSWR<{ items: GlobalProduct[] }>(
    `/api/v1/admin/global-inventory?limit=1000`,
    fetcher
  )

  const productsByParentCategory = useMemo(() => {
    const map = new Map<number, number>()
    const products = productsData?.items || []

    // Build a quick lookup from subcategory id -> parent category id
    const subToParent = new Map<number, number>()
    for (const sub of allSubCategories) {
      subToParent.set(sub.id, sub.parentId)
    }

    for (const product of products) {
      const subId = (product.metadata as any)?.subCategoryId

      if (subId) {
        // If a subcategory is set, attribute the product ONLY to that subcategory's parent
        const parentId = subToParent.get(subId)
        if (parentId) {
          map.set(parentId, (map.get(parentId) || 0) + 1)
        }
      } else if (product.categoryId) {
        // Otherwise, fall back to counting directly on the assigned category
        map.set(product.categoryId, (map.get(product.categoryId) || 0) + 1)
      }
    }

    return map
  }, [productsData, allSubCategories])

  // Filter categories by search
  const filteredCategories = useMemo(() => {
    if (!searchQuery) return categories
    const query = searchQuery.toLowerCase()
    return categories.filter(category =>
      category.name.toLowerCase().includes(query)
    )
  }, [categories, searchQuery])

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const trimmedName = formData.name.trim()
    if (!trimmedName) {
      alert("Category name is required")
      return
    }

    try {
      const url = `/api/v1/categories`
      const method = editingCategory ? "PUT" : "POST"

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          name: trimmedName,
          ...(editingCategory && { id: editingCategory.id }),
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to save category")
      }

      mutate()
      setShowAddDialog(false)
      setEditingCategory(null)
      setFormData({ name: "", parentId: null })
    } catch (error) {
      console.error("Error saving category:", error)
      alert(error instanceof Error ? error.message : "Failed to save category")
    }
  }

  // Handle edit
  const handleEdit = (category: Category) => {
    setEditingCategory(category)
    setFormData({
      name: category.name,
      parentId: category.parentId,
    })
    setShowAddDialog(true)
  }

  // Handle delete
  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this category?')) return

    try {
      const response = await fetch(`/api/v1/categories?id=${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete category')
      }

      mutate()
    } catch (error) {
      console.error('Error deleting category:', error)
      alert(error instanceof Error ? error.message : 'Failed to delete category')
    }
  }

  // Reset form
  const resetForm = () => {
    setFormData({ name: "", parentId: null })
    setEditingCategory(null)
    setShowAddDialog(false)
  }

  return (
    <div className="space-y-6">
      {/* Blue gradient header, aligned with Orders styling */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#141EAE] via-[#4427CA] to-[#7C3AED] px-6 py-6 text-white shadow-xl ring-1 ring-indigo-500/30">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs tracking-[0.2em] text-white/70">PRODUCTS · CATEGORIES</p>
            <h1 className="text-3xl font-semibold">Category taxonomy overview</h1>
            <p className="text-sm text-white/80">
              Manage top-level categories and their relationships for your product catalog.
            </p>
          </div>
        </div>
      </div>

      {/* Search and Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
            <Input
              placeholder="Search categories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 w-64"
            />
          </div>
        </div>
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus size={16} className="mr-2" />
          Add Category
        </Button>
      </div>

      {/* Categories Table */}
      <Card>
        <Table>
          <thead>
            <tr className="border-b">
              <th className="text-left p-4 font-medium">Name</th>
              <th className="text-left p-4 font-medium">Type</th>
              <th className="text-left p-4 font-medium">Sub Categories</th>
              <th className="text-left p-4 font-medium">Products</th>
              <th className="text-left p-4 font-medium">Created</th>
              <th className="text-right p-4 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-gray-500">
                  Loading categories...
                </td>
              </tr>
            ) : filteredCategories.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-gray-500">
                  No categories found
                </td>
              </tr>
            ) : (
              filteredCategories.map((category) => (
                <tr key={category.id} className="border-b hover:bg-muted/30 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <FolderTree size={16} className="text-blue-500" />
                      <span className="font-medium">{category.name}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <Badge variant={category.parentId ? "secondary" : "default"}>
                      {category.parentId ? "Sub Category" : "Category"}
                    </Badge>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-1">
                      <Package size={14} className="text-gray-400" />
                      <span>{subCategoriesByParent.get(category.id) ?? 0}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    {productsByParentCategory.get(category.id) ? (
                      <div className="flex items-center gap-1">
                        <Package size={14} className="text-gray-400" />
                        <span>{productsByParentCategory.get(category.id)}</span>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">—</span>
                    )}
                  </td>
                  <td className="p-4 text-sm text-gray-500">
                    {new Date(category.createdAt).toLocaleDateString()}
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex items-center gap-2 justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(category)}
                      >
                        <Edit size={14} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(category.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </Table>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={showAddDialog} onOpenChange={resetForm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">
              {editingCategory ? "Edit category" : "Create new category"}
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Categories group your products into high-level buckets. Subcategories are managed on the{" "}
              <span className="font-medium text-foreground">Subcategories</span> screen.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium">
                Category name <span className="text-red-500">*</span>
              </label>
              <Input
                value={formData.name}
                autoFocus
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Beverages, Personal Care, Stationery"
              />
              <p className="text-xs text-muted-foreground">
                Use a clear, business-friendly name. This will be visible everywhere products are categorized.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium">
                Parent category <span className="text-xs font-normal text-muted-foreground">(optional)</span>
              </label>
              <select
                value={formData.parentId || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    parentId: e.target.value ? parseInt(e.target.value) : null,
                  })
                }
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-ring"
              >
                <option value="">No parent (top-level category)</option>
                {categories
                  .filter((cat) => !cat.parentId)
                  .map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Only use a parent if you need a two-level hierarchy. Otherwise leave this empty.
              </p>
            </div>

            <DialogFooter className="gap-2 sm:gap-3">
              <Button type="button" variant="outline" onClick={resetForm}>
                Cancel
              </Button>
              <Button type="submit">
                {editingCategory ? "Save changes" : "Create category"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
