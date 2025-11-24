"use client"

import { ProductForm } from "@/components/global-inventory/product-form"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import { useParams, useRouter } from "next/navigation"
import useSWR from "swr"
import { fetcher } from "@/lib/fetcher"
import { Skeleton } from "@/components/ui/skeleton"

export default function EditGlobalInventoryProductPage() {
  const params = useParams()
  const router = useRouter()
  const productId = Array.isArray(params?.id) ? params?.id[0] : params?.id

  const { data, error, isLoading } = useSWR(productId ? `/api/v1/admin/global-inventory?id=${productId}` : null, fetcher, {
    revalidateOnFocus: false,
  })

  const product = data?.item || data?.product || data

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push("/global-inventory")} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to catalog
        </Button>
        <div>
          <h1 className="text-2xl font-semibold">Edit product</h1>
          <p className="text-sm text-muted-foreground">Update product information and preview changes before publishing.</p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : error || !product ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          Unable to load product details. Please return to the catalog and try again.
        </div>
      ) : (
        <ProductForm
          mode="edit"
          initialProduct={{
            id: product.id,
            productCode: product.productCode,
            name: product.name,
            description: product.description,
            categoryId: product.categoryId,
            imageUrl: product.imageUrl,
            basePrice: product.basePrice,
            unit: product.unit,
            status: product.status,
            categoryName: product.categoryName,
            discountType: product.discountType,
            discountValue: product.discountValue,
            discountStartAt: product.discountStartAt,
            discountEndAt: product.discountEndAt,
            discountActive: product.discountActive,
          }}
        />
      )}
    </div>
  )
}

