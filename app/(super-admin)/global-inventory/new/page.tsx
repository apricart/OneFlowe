"use client"

import { ProductForm } from "@/components/global-inventory/product-form"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import { useRouter } from "next/navigation"

export default function NewGlobalInventoryProductPage() {
  const router = useRouter()

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push("/global-inventory")} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to catalog
        </Button>
        <div>
          <h1 className="text-2xl font-semibold">Add product</h1>
          <p className="text-sm text-muted-foreground">Create a new global SKU and configure pricing, media, and promotions.</p>
        </div>
      </div>

      <ProductForm mode="create" />
    </div>
  )
}

