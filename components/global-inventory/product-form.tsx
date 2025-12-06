"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Upload, Package, Check } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/components/ui/use-toast"
import { formatPKR } from "@/lib/utils"
import { useRouter } from "next/navigation"
import useSWR from "swr"
import { fetcher } from "@/lib/fetcher"

type GlobalProduct = {
  id: number
  productCode: string
  name: string
  description?: string
  categoryId?: number
  imageUrl?: string
  basePrice: number
  unit: string
  status: string
  stockQuantity?: number
  categoryName?: string
  discountType?: string | null
  discountValue?: number | null
  discountStartAt?: string | null
  discountEndAt?: string | null
  discountActive?: boolean
  metadata?: Record<string, any> | null
}

type Category = {
  id: number
  name: string
}

type ProductFormState = {
  productCode: string
  name: string
  description: string
  categoryId: string
  imageUrl: string
  basePrice: string
  unit: string
  status: string
  stockQuantity: string
  subCategoryId: string
  discountType: string
  discountValue: string
  discountStartAt: string
  discountEndAt: string
  discountActive: boolean
}

type ProductFormProps = {
  mode: "create" | "edit"
  initialProduct?: GlobalProduct | null
  onCancel?: () => void
  onSuccess?: () => void
}

export function ProductForm({ mode, initialProduct, onCancel, onSuccess }: ProductFormProps) {
  const { toast } = useToast()
  const router = useRouter()

  const [productData, setProductData] = useState<ProductFormState>({
    productCode: "",
    name: "",
    description: "",
    categoryId: "",
    imageUrl: "",
    basePrice: "",
    unit: "unit",
    status: "active",
    stockQuantity: "0",
    subCategoryId: "",
    discountType: "",
    discountValue: "",
    discountStartAt: "",
    discountEndAt: "",
    discountActive: false,
  })

  useEffect(() => {
    if (initialProduct && mode === "edit") {
      setProductData({
        productCode: initialProduct.productCode,
        name: initialProduct.name,
        description: initialProduct.description || "",
        categoryId: initialProduct.categoryId?.toString() || "",
        imageUrl: initialProduct.imageUrl || "",
        basePrice: (initialProduct.basePrice / 100).toFixed(2),
        unit: initialProduct.unit,
        status: initialProduct.status,
        stockQuantity: initialProduct.stockQuantity?.toString() || "0",
        subCategoryId:
          (initialProduct.metadata as any)?.subCategoryId !== undefined &&
          (initialProduct.metadata as any)?.subCategoryId !== null
            ? String((initialProduct.metadata as any).subCategoryId)
            : "",
        discountType: initialProduct.discountType || "",
        discountValue: initialProduct.discountValue?.toString() || "",
        discountStartAt: initialProduct.discountStartAt
          ? new Date(initialProduct.discountStartAt).toISOString().slice(0, 16)
          : "",
        discountEndAt: initialProduct.discountEndAt
          ? new Date(initialProduct.discountEndAt).toISOString().slice(0, 16)
          : "",
        discountActive: !!initialProduct.discountActive,
      })
    }
  }, [initialProduct, mode])

  const [imageUploadMode, setImageUploadMode] = useState<"upload" | "url">("upload")
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const [imageUploadError, setImageUploadError] = useState<string | null>(null)

  const { data: categoriesData, isLoading: categoriesLoading, error: categoriesError } = useSWR<{ items: Category[] }>(
    `/api/v1/categories?type=parent`,
    fetcher,
    { fallbackData: { items: [] }, revalidateOnFocus: false }
  )
  const categories = categoriesData?.items || []

  type SubCategory = {
    id: number
    name: string
    parentId: number
  }

  const { data: subCategoriesData } = useSWR<{ items: SubCategory[] }>(
    productData.categoryId ? `/api/v1/subcategories?parentId=${productData.categoryId}` : null,
    fetcher,
    { fallbackData: { items: [] }, revalidateOnFocus: false }
  )
  const subCategories = subCategoriesData?.items || []

  const discountEnabled = productData.discountActive || !!productData.discountType

  const handleDiscountToggle = (checked: boolean) => {
    setProductData((prev) => {
      if (checked) {
        return {
          ...prev,
          discountActive: true,
          discountType: prev.discountType || "percent",
        }
      }
      return {
        ...prev,
        discountActive: false,
        discountType: "",
        discountValue: "",
        discountStartAt: "",
        discountEndAt: "",
      }
    })
  }

  const handleImageFile = async (file: File | null) => {
    if (!file) return
    setIsUploadingImage(true)
    setImageUploadError(null)
    try {
      const formData = new FormData()
      formData.append("image", file)
      const res = await fetch("/api/v1/upload/image", {
        method: "POST",
        body: formData,
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || "Upload failed")
      }
      const data = await res.json()
      setProductData((prev) => ({ ...prev, imageUrl: data.url }))
      toast({
        title: "Image uploaded",
        description: "The product image has been uploaded successfully.",
      })
    } catch (error: any) {
      setImageUploadError(error.message || "Upload failed")
      toast({
        title: "Upload failed",
        description: error.message || "Could not upload image",
        variant: "destructive",
      })
    } finally {
      setIsUploadingImage(false)
    }
  }

  const handleSubmitProduct = async () => {
    if (!productData.productCode || !productData.name || !productData.basePrice) {
      toast({
        title: "Validation Error",
        description: "Product code, name, and base price are required",
        variant: "destructive",
      })
      return
    }

    try {
      const method = mode === "edit" ? "PUT" : "POST"
      const metadata: Record<string, any> = {
        ...(initialProduct?.metadata || {}),
      }

      if (productData.subCategoryId) {
        metadata.subCategoryId = parseInt(productData.subCategoryId)
      } else if ("subCategoryId" in metadata) {
        delete metadata.subCategoryId
      }

      const response = await fetch(`/api/v1/admin/global-inventory`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...productData,
          id: initialProduct?.id,
          basePrice: parseFloat(productData.basePrice),
          stockQuantity: parseInt(productData.stockQuantity) || 0,
          categoryId: productData.categoryId ? parseInt(productData.categoryId) : null,
          metadata,
          discountType: productData.discountType || null,
          discountValue: productData.discountValue ? parseInt(productData.discountValue) : null,
          discountStartAt: productData.discountStartAt || null,
          discountEndAt: productData.discountEndAt || null,
          discountActive: !!productData.discountActive,
        }),
      })

      const result = await response.json()

      if (response.ok) {
        toast({
          title: mode === "edit" ? "Product updated" : "Product created",
          description: result.message,
        })
        onSuccess ? onSuccess() : router.push("/global-inventory")
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to save product",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error saving product:", error)
      toast({
        title: "Error",
        description: "Failed to save product",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,2.5fr)_minmax(0,1fr)]">
      <div className="space-y-6">
        <Card className="w-full">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Base details</CardTitle>
            <CardDescription>Core identifiers that Head Office relies on for downstream syncing.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium mb-1">Product Code *</label>
                <Input
                  value={productData.productCode ?? ""}
                  onChange={(e) => setProductData({ ...productData, productCode: e.target.value })}
                  placeholder="PRD-001"
                  required
                />
                <p className="mt-1 text-xs text-muted-foreground">Avoid spaces; use dashes for readability.</p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Name *</label>
                <Input
                  value={productData.name ?? ""}
                  onChange={(e) => setProductData({ ...productData, name: e.target.value })}
                  placeholder="Product name"
                  required
                />
                <p className="mt-1 text-xs text-muted-foreground">Visible everywhere the product is assigned.</p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Category</label>
                <Select value={productData.categoryId} onValueChange={(value) => setProductData({ ...productData, categoryId: value })}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={categoriesLoading ? "Loading..." : "Select a category"} />
                  </SelectTrigger>
                  <SelectContent>
                    {categoriesError && (
                      <SelectGroup>
                        <SelectLabel>Error loading categories</SelectLabel>
                      </SelectGroup>
                    )}
                    {!categoriesLoading && categories.length === 0 && (
                      <SelectGroup>
                        <SelectLabel>No categories found</SelectLabel>
                      </SelectGroup>
                    )}
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={String(cat.id)}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Subcategory</label>
                <Select
                  value={productData.subCategoryId || "none"}
                  onValueChange={(value) =>
                    setProductData({
                      ...productData,
                      subCategoryId: value === "none" ? "" : value,
                    })
                  }
                  disabled={!productData.categoryId || subCategories.length === 0}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue
                      placeholder={
                        !productData.categoryId
                          ? "Select a category first"
                          : subCategories.length === 0
                          ? "No subcategories for this category"
                          : "Optional: choose a subcategory"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>Subcategories</SelectLabel>
                      <SelectItem value="none">None</SelectItem>
                      {subCategories.map((sub) => (
                        <SelectItem key={sub.id} value={String(sub.id)}>
                          {sub.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Status</label>
                <Select value={productData.status} onValueChange={(value) => setProductData({ ...productData, status: value })}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
                <p className="mt-1 text-xs text-muted-foreground">Inactive products stay hidden in every branch.</p>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <textarea
                value={productData.description ?? ""}
                onChange={(e) => setProductData({ ...productData, description: e.target.value })}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                rows={3}
                placeholder="What makes this SKU unique or how should branches position it?"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="w-full">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Commercial setup</CardTitle>
            <CardDescription>Baseline price, measurement unit, and packaging cues.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium mb-1">Base Price *</label>
                <Input
                  type="number"
                  step="0.01"
                  value={productData.basePrice ?? ""}
                  onChange={(e) => setProductData({ ...productData, basePrice: e.target.value })}
                  placeholder="0.00"
                  required
                />
                <p className="mt-1 text-xs text-muted-foreground">Stored in PKR; branches inherit this by default.</p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Unit</label>
                <Input
                  value={productData.unit ?? ""}
                  onChange={(e) => setProductData({ ...productData, unit: e.target.value })}
                  placeholder="ltr / kg / box"
                />
                <p className="mt-1 text-xs text-muted-foreground">Shown in inventory cards and packing slips.</p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Stock Quantity</label>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={productData.stockQuantity ?? "0"}
                  onChange={(e) => setProductData({ ...productData, stockQuantity: e.target.value })}
                  placeholder="0"
                />
                <p className="mt-1 text-xs text-muted-foreground">Current available stock quantity. Defaults to 0.</p>
              </div>
            </div>
            <div className="rounded-xl border bg-muted/30 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Product imagery</p>
                  <p className="text-xs text-muted-foreground">Upload a hero visual or link to an existing asset.</p>
                </div>
                <div className="inline-flex overflow-hidden rounded-full border text-xs">
                  {(["upload", "url"] as const).map((modeOption) => (
                    <button
                      key={modeOption}
                      type="button"
                      onClick={() => setImageUploadMode(modeOption)}
                      className={`px-3 py-1 ${imageUploadMode === modeOption ? "bg-primary text-primary-foreground" : "bg-background"}`}
                    >
                      {modeOption === "upload" ? "Upload" : "URL"}
                    </button>
                  ))}
                </div>
              </div>
              {imageUploadMode === "upload" ? (
                <div className="space-y-2">
                  <label className="flex h-32 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed text-center text-xs text-muted-foreground hover:border-primary/60 hover:text-primary">
                    <Upload className="mb-2 h-5 w-5" />
                    <span className="font-medium">Drop image or click to browse</span>
                    <span className="text-[11px]">JPG, PNG, GIF up to 5MB</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(event) => handleImageFile(event.target.files?.[0] || null)}
                      disabled={isUploadingImage}
                    />
                  </label>
                  {isUploadingImage && <p className="text-xs text-muted-foreground">Uploading image…</p>}
                  {imageUploadError && <p className="text-xs text-destructive">{imageUploadError}</p>}
                </div>
              ) : (
                <Input
                  value={productData.imageUrl ?? ""}
                  onChange={(e) => setProductData({ ...productData, imageUrl: e.target.value })}
                  placeholder="https://example.com/image.jpg"
                />
              )}
              {productData.imageUrl && (
                <div className="flex items-center gap-3 rounded-lg border bg-muted/20 p-2 text-xs text-muted-foreground">
                  <img src={productData.imageUrl} alt={productData.name || "Product preview"} className="h-10 w-10 rounded-md object-cover" />
                  <div className="flex-1">
                    <p className="font-medium text-foreground">{productData.name || "Preview"}</p>
                    <p className="truncate">{productData.imageUrl}</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setProductData((prev) => ({ ...prev, imageUrl: "" }))}>
                    Remove
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="w-full">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg">Discounts & promos</CardTitle>
              <CardDescription>Optional limited-time incentives that cascade to branches.</CardDescription>
            </div>
            <Switch checked={discountEnabled} onCheckedChange={handleDiscountToggle} />
          </CardHeader>
          {discountEnabled ? (
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium mb-1">Discount Type</label>
                  <Select value={productData.discountType || "percent"} onValueChange={(value) => setProductData({ ...productData, discountType: value })}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percent">Percentage</SelectItem>
                      <SelectItem value="flat">Flat Amount</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Discount Value</label>
                  <Input
                    type="number"
                    step={productData.discountType === "flat" ? "1" : "0.01"}
                    placeholder={productData.discountType === "flat" ? "Enter amount in PKR" : "Enter percentage"}
                    value={productData.discountValue ?? ""}
                    onChange={(e) => setProductData({ ...productData, discountValue: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Discount Start</label>
                  <Input
                    type="datetime-local"
                    value={productData.discountStartAt ?? ""}
                    onChange={(e) => setProductData({ ...productData, discountStartAt: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Discount End</label>
                  <Input
                    type="datetime-local"
                    value={productData.discountEndAt ?? ""}
                    onChange={(e) => setProductData({ ...productData, discountEndAt: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                <span>Discount is {productData.discountActive ? "active" : "draft"}.</span>
                <button
                  type="button"
                  className="font-semibold text-blue-600 hover:underline"
                  onClick={() => setProductData((prev) => ({ ...prev, discountActive: !prev.discountActive }))}
                >
                  Toggle state
                </button>
              </div>
            </CardContent>
          ) : (
            <CardContent>
              <div className="rounded-lg border border-dashed bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                Activate discounts to configure promotional windows without leaving this form.
              </div>
            </CardContent>
          )}
        </Card>
      </div>

      <div className="space-y-6">
        <Card className="w-full">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Live preview</CardTitle>
            <CardDescription>How the product will appear inside organization catalogs.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Badge variant={productData.status === "active" ? "default" : "secondary"}>
                {productData.status === "active" ? "Active" : "Inactive"}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {mode === "edit" ? "Editing existing SKU" : "Creating new SKU"}
              </span>
            </div>
            <div className="rounded-xl border bg-muted/30 p-4 flex flex-col gap-4">
              <div className="flex items-center gap-3">
                {productData.imageUrl ? (
                  <img src={productData.imageUrl} alt={productData.name || "Preview"} className="h-16 w-16 rounded-lg object-cover border" />
                ) : (
                  <div className="h-16 w-16 rounded-lg border bg-background flex items-center justify-center text-muted-foreground">
                    <Package className="h-6 w-6" />
                  </div>
                )}
                <div className="flex-1">
                  <p className="font-semibold">{productData.name || "Unnamed product"}</p>
                  <p className="text-xs text-muted-foreground">{productData.productCode || "CODE-TBD"}</p>
                </div>
              </div>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">Base price</dt>
                  <dd className="font-medium">
                    {productData.basePrice ? formatPKR(Number(productData.basePrice)) : "PKR 0.00"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">Unit</dt>
                  <dd className="font-medium">{productData.unit || "unit"}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">Category</dt>
                  <dd className="font-medium">
                    {productData.categoryId
                      ? categories.find((cat) => String(cat.id) === productData.categoryId)?.name ?? "Selected"
                      : "Not set"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">Subcategory</dt>
                  <dd className="font-medium">
                    {productData.subCategoryId
                      ? subCategories.find((sub) => String(sub.id) === productData.subCategoryId)?.name ?? "Selected"
                      : "Not set"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">Discount</dt>
                  <dd className="font-medium">{discountEnabled ? "Configured" : "None"}</dd>
                </div>
              </dl>
            </div>
          </CardContent>
        </Card>

        <Card className="w-full">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Publishing checklist</CardTitle>
            <CardDescription>Quick guardrails before you hit save.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="flex items-start gap-3">
              <Check className="h-4 w-4 text-emerald-500 mt-0.5" />
              <p>Product code and name are required. The system prevents duplicates automatically.</p>
            </div>
            <div className="flex items-start gap-3">
              <Check className="h-4 w-4 text-emerald-500 mt-0.5" />
              <p>Base price is stored in cents — decimals are supported for easier math in PKR.</p>
            </div>
            <div className="flex items-start gap-3">
              <Check className="h-4 w-4 text-emerald-500 mt-0.5" />
              <p>Optional fields can be revisited later without affecting existing assignments.</p>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-end gap-3">
          <Button variant="outline" onClick={onCancel || (() => router.push("/global-inventory"))}>
            Cancel
          </Button>
          <Button onClick={handleSubmitProduct}>{mode === "edit" ? "Update Product" : "Create Product"}</Button>
        </div>
      </div>
    </div>
  )
}

