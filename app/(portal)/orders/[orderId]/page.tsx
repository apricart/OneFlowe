"use client"

import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import useSWR from "swr"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatPKR } from "@/lib/utils"
import { buildStatusTimeline } from "@/lib/order-utils"
import { ArrowLeft, Clock, TrendingDown, CheckCircle, RefreshCw, Package, Receipt } from "lucide-react"
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
  approvalToken?: string | null // Only visible to the approver
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



  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-3xl bg-white dark:bg-slate-900 px-6 py-6 shadow-sm border border-slate-200 dark:border-slate-800">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs tracking-[0.2em] text-slate-500 dark:text-slate-400 font-bold mb-1">SUPER ADMIN · ORDERS</p>
            <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">Order intelligence overview</h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Watch approvals, fulfillment, and refund indicators for order #{rawId}.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"
              onClick={() => mutate()}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh data
            </Button>
            {order && (
              <div className="flex items-center rounded-full bg-slate-100 dark:bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                {order.branchName || `Branch ${order.branchId}`}
              </div>
            )}
          </div>
        </div>
        {order && (
          <div className="mt-6 flex flex-wrap gap-4 text-xs font-medium text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800 pt-4">
            <div className="flex items-center gap-2">
              <span className="uppercase tracking-wide text-slate-400 dark:text-slate-500">Transaction</span>
              <span className="font-mono text-slate-700 dark:text-slate-300">{order.tid}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="uppercase tracking-wide text-slate-400 dark:text-slate-500">Created</span>
              <span className="text-slate-700 dark:text-slate-300">{formatDistanceToNow(new Date(order.createdAt), { addSuffix: true })}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="uppercase tracking-wide text-slate-400 dark:text-slate-500">Status</span>
              <span className="uppercase font-bold text-slate-900 dark:text-white">{order.status}</span>
            </div>
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
          <Card className="rounded-2xl border-0 bg-white dark:bg-slate-900 dark:border-slate-800 p-4 shadow-md">
            <p className="text-sm text-muted-foreground">Order total</p>
            <p className="text-2xl font-semibold text-slate-900 dark:text-white">
              {formatPKR(order.totalCents / 100)}
            </p>
            <p className="text-xs text-muted-foreground">
              Subtotal {formatPKR(order.subtotalCents / 100)} · Tax {formatPKR(order.taxCents / 100)}
            </p>
          </Card>
          <Card className="rounded-2xl border-0 bg-white dark:bg-slate-900 dark:border-slate-800 p-4 shadow-md">
            <p className="text-sm text-muted-foreground">Current status</p>
            <p className="text-2xl font-semibold capitalize text-slate-900 dark:text-white">
              {order.status.toLowerCase()}
            </p>
          </Card>
          <Card className="rounded-2xl border-0 bg-white dark:bg-slate-900 dark:border-slate-800 p-4 shadow-md">
            <p className="text-sm text-muted-foreground">Branch</p>
            <p className="text-2xl font-semibold text-slate-900 dark:text-white">
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
              <Card className="space-y-4 border dark:bg-slate-900 dark:border-slate-800">
                <div className="grid gap-4 border-b dark:border-slate-800 px-6 py-5 md:grid-cols-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Transaction ID
                    </p>
                    <p className="font-mono text-sm font-semibold dark:text-white">{order.tid}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Order ID
                    </p>
                    <p className="font-semibold dark:text-white">{order.id}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Branch
                    </p>
                    <p className="font-semibold dark:text-white">
                      {order.branchName || `Branch ${order.branchId}`}
                    </p>
                  </div>
                </div>

                <div className="grid gap-3 px-6 pb-6 md:grid-cols-3">
                  <div className="rounded-2xl bg-white/80 dark:bg-slate-800/80 p-4 shadow-sm">
                    <p className="text-xs uppercase text-muted-foreground">Subtotal</p>
                    <p className="text-lg font-semibold dark:text-white">
                      {formatPKR(order.subtotalCents / 100)}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-white/80 dark:bg-slate-800/80 p-4 shadow-sm">
                    <p className="text-xs uppercase text-muted-foreground">Tax</p>
                    <p className="text-lg font-semibold dark:text-white">
                      {formatPKR(order.taxCents / 100)}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-indigo-50 dark:bg-indigo-950 p-4 shadow-sm">
                    <p className="text-xs uppercase text-indigo-700 dark:text-indigo-300">Total</p>
                    <p className="text-xl font-bold text-indigo-700 dark:text-indigo-300">
                      {formatPKR(order.totalCents / 100)}
                    </p>
                  </div>
                </div>



                {/* Order Items */}
                {order.orderItems && order.orderItems.length > 0 && (
                  <div className="mx-6 mb-6 space-y-4">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Order Items</h3>
                    <div className="space-y-3">
                      {order.orderItems.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center gap-4 rounded-lg border bg-white dark:bg-slate-800 dark:border-slate-700 p-4"
                        >
                          <div className="flex h-16 w-16 items-center justify-center rounded-lg border bg-slate-50 dark:bg-slate-600 dark:border-slate-500">
                            {item.imageUrl ? (
                              <img
                                src={item.imageUrl}
                                alt={item.productName}
                                className="h-full w-full rounded-lg object-cover"
                              />
                            ) : (
                              <Package className="h-8 w-8 text-slate-400 dark:text-slate-300" />
                            )}
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold text-slate-900 dark:text-white">{item.productName}</p>
                            {item.productCode && (
                              <p className="text-xs text-muted-foreground font-mono">{item.productCode}</p>
                            )}
                            <p className="text-xs text-muted-foreground mt-1">
                              {formatPKR(item.priceCents / 100)} per {item.unit}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold text-slate-900 dark:text-white">Qty: {item.quantity}</p>
                            <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                              {formatPKR((item.priceCents * item.quantity) / 100)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Card>

              {/* Security: Approval Token Display (Only visible to approver) */}
              {order.approvalToken && (
                <Card className="mb-6 p-5 border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20">
                  <div className="flex items-start gap-4">
                    <div className="rounded-full bg-emerald-100 dark:bg-emerald-900 p-2 text-emerald-600 dark:text-emerald-400">
                      <CheckCircle className="h-5 w-5" />
                    </div>
                    <div className="flex-1 space-y-2">
                      <div>
                        <h3 className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">Approval Token</h3>
                        <p className="text-xs text-emerald-700 dark:text-emerald-300">
                          You approved this order. Securely share this token with Super Admin for fulfillment.
                        </p>
                      </div>

                      <div className="flex items-center gap-2 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-slate-900 p-3">
                        <code className="flex-1 font-mono text-lg font-bold tracking-widest text-slate-900 dark:text-white select-all">
                          {order.approvalToken}
                        </code>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 hover:bg-emerald-50 dark:hover:bg-emerald-900"
                          onClick={() => {
                            if (order.approvalToken) {
                              navigator.clipboard.writeText(order.approvalToken)
                            }
                          }}
                          title="Copy to clipboard"
                        >
                          <Receipt className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              )}

              <Card className="p-5 dark:bg-slate-900 dark:border-slate-800">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">Status timeline</p>
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
                            className={`flex h-8 w-8 items-center justify-center rounded-full border ${isComplete
                              ? "border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300"
                              : isCurrent
                                ? "border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300"
                                : "border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-400 dark:text-slate-400"
                              }`}
                          >
                            {isComplete ? <CheckCircle className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                          </div>
                          {!isLast && (
                            <div
                              className={`mt-1 w-px flex-1 ${isComplete ? "bg-emerald-100 dark:bg-emerald-900" : "bg-slate-200 dark:bg-slate-600"
                                }`}
                            />
                          )}
                        </div>
                        <div className="flex-1 rounded-xl border dark:border-slate-700 bg-white dark:bg-slate-800 p-3 shadow-sm">
                          <p className="text-sm font-semibold dark:text-white">{step.label}</p>
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


