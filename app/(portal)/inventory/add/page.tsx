"use client"
import { Card, CardHeader, CardTitle } from "@/components/ui/card"
import { Sparkles } from "lucide-react"
import { ProductForm } from "@/components/global-inventory/product-form"
import { useRouter } from "next/navigation"

export default function CreateProductPage() {
  const router = useRouter()

  return (
    <div className="space-y-8 p-6">
      <Card className="relative overflow-hidden border-none bg-gradient-to-r from-slate-900 via-purple-900 to-indigo-800 text-white shadow-xl">
        <div className="pointer-events-none absolute inset-0 opacity-30">
          <div className="absolute -top-16 right-0 h-48 w-48 rounded-full bg-white/30 blur-3xl" />
          <div className="absolute bottom-0 left-0 h-32 w-32 rounded-full bg-indigo-400/40 blur-3xl" />
        </div>
        <CardHeader className="relative space-y-3">
          <p className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-white/70">
            <Sparkles className="h-4 w-4" />
            Inventory Management
          </p>
          <CardTitle className="text-3xl font-semibold text-white">Create New Product</CardTitle>
          <p className="text-sm text-white/80">
            Add a new product to the global inventory catalog. This product will be available for assignment to organizations.
          </p>
        </CardHeader>
      </Card>

      <ProductForm
        mode="create"
        onCancel={() => router.push("/inventory")}
        onSuccess={() => router.push("/inventory")}
      />
    </div>
  )
}
