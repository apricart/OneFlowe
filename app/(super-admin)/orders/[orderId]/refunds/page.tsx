"use client"

import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import useSWR from "swr"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { formatPKR } from "@/lib/utils"
import { RefundManagement } from "@/components/refunds/refund-management"
import { ArrowLeft, Receipt, RefreshCw } from "lucide-react"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

type OrderDetail = {
  id: number
  tid: string
  branchId: number
  branchName?: string | null
  status: string
  totalCents: number
}

export default function SuperAdminOrderRefundsPage() {
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
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#141EAE] via-[#3E2FBF] to-[#7C3AED] px-6 py-6 text-white shadow-xl ring-1 ring-indigo-500/30">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs tracking-[0.2em] text-white/70">SUPER ADMIN · FINANCE</p>
            <h1 className="text-3xl font-semibold">Refund control center</h1>
            <p className="text-sm text-white/80">
              Review refund requests from branches and process approved refunds.
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
                Total {formatPKR(order.totalCents / 100)}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          variant="ghost"
          className="gap-2"
          onClick={() => router.push("/orders")}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to orders
        </Button>
        <Button asChild variant="outline">
          <Link href="/orders">Orders list</Link>
        </Button>
      </div>

      {order && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="rounded-2xl border-0 bg-white p-4 shadow-md">
            <p className="text-sm text-muted-foreground">Order total</p>
            <p className="text-2xl font-semibold text-slate-900">
              {formatPKR(order.totalCents / 100)}
            </p>
            <p className="text-xs text-muted-foreground">
              Branch {order.branchName || `#${order.branchId}`}
            </p>
          </Card>
          <Card className="rounded-2xl border-0 bg-white p-4 shadow-md">
            <p className="text-sm text-muted-foreground">Order status</p>
            <p className="text-2xl font-semibold capitalize text-slate-900">
              {order.status.toLowerCase()}
            </p>
            <p className="text-xs text-muted-foreground">
              Refunds are processed here by Super Admin.
            </p>
          </Card>
          <Card className="rounded-2xl border-0 bg-white p-4 shadow-md">
            <p className="text-sm text-muted-foreground">Refund flow</p>
            <p className="text-2xl font-semibold text-slate-900">Managed</p>
            <p className="text-xs text-muted-foreground">
              Approve or process requested refunds with audit notes.
            </p>
          </Card>
          <Card className="rounded-2xl border-0 bg-white p-4 shadow-md">
            <p className="text-sm text-muted-foreground">Last refreshed</p>
            <p className="text-2xl font-semibold text-slate-900">Just now</p>
            <p className="text-xs text-muted-foreground">Use refresh to fetch latest log</p>
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
              <p className="text-sm text-muted-foreground">Loading refund data…</p>
            </Card>
          )}
          {error && (
            <Card className="p-6">
              <p className="text-sm text-destructive">Failed to fetch order context.</p>
            </Card>
          )}
          {!isLoading && !order && !error && (
            <Card className="p-6">
              <p className="text-sm text-muted-foreground">
                Order not found or you lack access.
              </p>
            </Card>
          )}

          {order && (
            <div className="space-y-6">
              <Card className="p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Order</p>
                    <p className="text-lg font-semibold">
                      #{order.id} — {order.branchName || `Branch ${order.branchId}`}
                    </p>
                    <p className="text-sm text-muted-foreground">Transaction ID: {order.tid}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-100 px-4 py-2 text-right">
                    <p className="text-xs uppercase text-muted-foreground">Total</p>
                    <p className="text-xl font-bold">
                      {formatPKR(order.totalCents / 100)}
                    </p>
                  </div>
                </div>
              </Card>

              <Card className="p-6">
                <div className="mb-4 flex items-center gap-2 text-slate-900">
                  <Receipt className="h-4 w-4" />
                  <p className="font-semibold">Refund Management</p>
                </div>
                <RefundManagement
                  orderId={order.id}
                  orderTotalCents={order.totalCents}
                  orderStatus={order.status}
                  onRefundSuccess={() => mutate()}
                />
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  )
}


