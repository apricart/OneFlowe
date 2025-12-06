"use client"

import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import useSWR from "swr"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatPKR } from "@/lib/utils"
import { buildStatusTimeline, getAutoApproveMeta } from "@/lib/order-utils"
import { ArrowLeft, Clock, TrendingDown, CheckCircle, RefreshCw, Package } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import Image from "next/image"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

type OrderItem = {
  id: number
  productName: string
  productCode?: string | null
  quantity: number
  priceCents: number
  unit: string
  globalProductId: number
  imageUrl?: string | null
}

type OrderDetail = {
  id: number
  tid: string
  branchId: number
  branchName?: string | null
  status: string
  subtotalCents: number
  taxCents: number
  totalCents: number
  createdAt: string
  orderItems?: OrderItem[]
}

export default function SuperAdminOrderDetailsPage() {
  const params = useParams<{ orderId: string }>()
  const router = useRouter()
  const rawId = Array.isArray(params?.orderId) ? params?.orderId[0] : params?.orderId
  const numericId = rawId && /^\d+$/.test(rawId) ? Number(rawId) : null

  const { data, error, isLoading, mutate } = useSWR(
    numericId ? `/api/v1/orders?id=${numericId}` : null,
    fetcher
  )
  const order: OrderDetail | undefined = data?.items?.[0]

  const autoMeta = order ? getAutoApproveMeta(order) : null

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#141EAE] via-[#4427CA] to-[#7C3AED] px-6 py-6 text-white shadow-xl ring-1 ring-indigo-500/30">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs tracking-[0.2em] text-white/70">SUPER ADMIN · ORDERS</p>
            <h1 className="text-3xl font-semibold">Order intelligence overview</h1>
            <p className="text-sm text-white/80">
              Watch approvals, fulfillment, and refund indicators for order #{rawId}.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              className="bg-white/15 text-white hover:bg-white/25"
              onClick={() => mutate()}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh data
            </Button>
            {order && (
              <div className="flex items-center rounded-full bg-white/20 px-4 py-2 text-sm font-semibold">
                {order.branchName || `Branch ${order.branchId}`}
              </div>
            )}
          </div>
        </div>
        {order && (
          <div className="mt-4 flex flex-wrap gap-3 text-xs text-white/80">
            <span>Transaction: {order.tid}</span>
            <span>Created {formatDistanceToNow(new Date(order.createdAt), { addSuffix: true })}</span>
            <span className="uppercase tracking-wide">Status: {order.status}</span>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" className="gap-2" onClick={() => router.push("/orders")}>
          <ArrowLeft className="h-4 w-4" />
          Back to orders
        </Button>
        {numericId && (
          <Button asChild variant="outline" className="gap-2">
            <Link href={`/orders/${numericId}/refunds`}>
              <TrendingDown className="h-4 w-4" />
              Manage refunds
            </Link>
          </Button>
        )}
      </div>

      {order && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="rounded-2xl border-0 bg-white p-4 shadow-md">
            <p className="text-sm text-muted-foreground">Order total</p>
            <p className="text-2xl font-semibold text-slate-900">
              {formatPKR(order.totalCents / 100)}
            </p>
            <p className="text-xs text-muted-foreground">
              Subtotal {formatPKR(order.subtotalCents / 100)} · Tax {formatPKR(order.taxCents / 100)}
            </p>
          </Card>
          <Card className="rounded-2xl border-0 bg-white p-4 shadow-md">
            <p className="text-sm text-muted-foreground">Current status</p>
            <p className="text-2xl font-semibold capitalize text-slate-900">
              {order.status.toLowerCase()}
            </p>
            <p className="text-xs text-muted-foreground">
              Auto-approval safety applies while pending
            </p>
          </Card>
          <Card className="rounded-2xl border-0 bg-white p-4 shadow-md">
            <p className="text-sm text-muted-foreground">Auto approval</p>
            <p className="text-2xl font-semibold text-slate-900">
              {autoMeta ? autoMeta.title.replace("Auto approval in ", "") : "—"}
            </p>
            <p className="text-xs text-muted-foreground">
              {autoMeta ? "Review before the timer elapses" : "No countdown for this status"}
            </p>
          </Card>
          <Card className="rounded-2xl border-0 bg-white p-4 shadow-md">
            <p className="text-sm text-muted-foreground">Branch</p>
            <p className="text-2xl font-semibold text-slate-900">
              {order.branchName || `Branch ${order.branchId}`}
            </p>
            <p className="text-xs text-muted-foreground">Order ID #{order.id}</p>
          </Card>
        </div>
      )}

      {!numericId && (
        <Card className="p-6 text-sm text-muted-foreground">
          Invalid order id provided. Please navigate back and pick a valid order.
        </Card>
      )}

      {numericId && (
        <>
          {isLoading && (
            <Card className="p-6">
              <p className="text-sm text-muted-foreground">Loading order details…</p>
            </Card>
          )}
          {error && (
            <Card className="p-6">
              <p className="text-sm text-destructive">Failed to load order information.</p>
            </Card>
          )}
          {!isLoading && !order && !error && (
            <Card className="p-6 text-sm text-muted-foreground">
              Order not found or you lack access.
            </Card>
          )}

          {order && (
            <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
              <Card className="space-y-4 border">
                <div className="grid gap-4 border-b px-6 py-5 md:grid-cols-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Transaction ID
                    </p>
                    <p className="font-mono text-sm font-semibold">{order.tid}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Order ID
                    </p>
                    <p className="font-semibold">{order.id}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Branch
                    </p>
                    <p className="font-semibold">
                      {order.branchName || `Branch ${order.branchId}`}
                    </p>
                  </div>
                </div>

                <div className="grid gap-3 px-6 pb-6 md:grid-cols-3">
                  <div className="rounded-2xl bg-white/80 p-4 shadow-sm">
                    <p className="text-xs uppercase text-muted-foreground">Subtotal</p>
                    <p className="text-lg font-semibold">
                      {formatPKR(order.subtotalCents / 100)}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-white/80 p-4 shadow-sm">
                    <p className="text-xs uppercase text-muted-foreground">Tax</p>
                    <p className="text-lg font-semibold">
                      {formatPKR(order.taxCents / 100)}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-indigo-50 p-4 shadow-sm">
                    <p className="text-xs uppercase text-indigo-700">Total</p>
                    <p className="text-xl font-bold text-indigo-700">
                      {formatPKR(order.totalCents / 100)}
                    </p>
                  </div>
                </div>

                {autoMeta && (
                  <div className="mx-6 mb-6 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
                    <Clock className="h-5 w-5 text-amber-600" />
                    <div>
                      <p className="font-semibold text-amber-800">{autoMeta.title}</p>
                      <p className="text-sm text-amber-700">{autoMeta.detail}</p>
                    </div>
                  </div>
                )}

                {/* Order Items */}
                {order.orderItems && order.orderItems.length > 0 && (
                  <div className="mx-6 mb-6 space-y-4">
                    <h3 className="text-sm font-semibold text-slate-900">Order Items</h3>
                    <div className="space-y-3">
                      {order.orderItems.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center gap-4 rounded-lg border bg-white p-4"
                        >
                          <div className="flex h-16 w-16 items-center justify-center rounded-lg border bg-slate-50">
                            {item.imageUrl ? (
                              <img
                                src={item.imageUrl}
                                alt={item.productName}
                                className="h-full w-full rounded-lg object-cover"
                              />
                            ) : (
                              <Package className="h-8 w-8 text-slate-400" />
                            )}
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold text-slate-900">{item.productName}</p>
                            {item.productCode && (
                              <p className="text-xs text-muted-foreground font-mono">{item.productCode}</p>
                            )}
                            <p className="text-xs text-muted-foreground mt-1">
                              {formatPKR(item.priceCents / 100)} per {item.unit}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold text-slate-900">Qty: {item.quantity}</p>
                            <p className="text-sm font-bold text-indigo-600">
                              {formatPKR((item.priceCents * item.quantity) / 100)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Card>

              <Card className="p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Status timeline</p>
                    <p className="text-xs text-muted-foreground">Track key lifecycle events.</p>
                  </div>
                  <Badge variant="outline" className="capitalize">
                    {order.status}
                  </Badge>
                </div>
                <ol className="space-y-4">
                  {buildStatusTimeline(order.status).map((step, index, arr) => {
                    const isLast = index === arr.length - 1
                    const isComplete = step.state === "complete"
                    const isCurrent = step.state === "current"
                    return (
                      <li key={step.key} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div
                            className={`flex h-8 w-8 items-center justify-center rounded-full border ${
                              isComplete
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                : isCurrent
                                ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                                : "border-slate-200 bg-white text-slate-400"
                            }`}
                          >
                            {isComplete ? <CheckCircle className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                          </div>
                          {!isLast && (
                            <div
                              className={`mt-1 w-px flex-1 ${
                                isComplete ? "bg-emerald-100" : "bg-slate-200"
                              }`}
                            />
                          )}
                        </div>
                        <div className="flex-1 rounded-xl border p-3 shadow-sm">
                          <p className="text-sm font-semibold">{step.label}</p>
                          <p className="text-xs text-muted-foreground">{step.description}</p>
                        </div>
                      </li>
                    )
                  })}
                </ol>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  )
}


