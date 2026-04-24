type OrderStatusSource = {
  status?: string | null
  refundAmountCents?: number | null
}

export type OrderStatusContext = "default" | "fulfilled" | "refunded"
export type OrderSplitFilter = "all" | "partial" | "full"
export type DerivedOrderStatusKey =
  | "pending"
  | "approved"
  | "fulfilled"
  | "partially_fulfilled"
  | "refunded"
  | "partially_refunded"
  | "rejected"
  | "cancelled"
  | "unknown"

function normalizeStatus(status?: string | null) {
  return (status || "").trim().toUpperCase()
}

export function getOrderRefundVariant(order: OrderStatusSource): Exclude<OrderSplitFilter, "all"> | "none" {
  const status = normalizeStatus(order.status)
  const refundAmountCents = Number(order.refundAmountCents || 0)

  if (status === "REFUNDED") return "full"
  if (refundAmountCents > 0) return "partial"
  return "none"
}

export function getOrderFulfillmentVariant(order: OrderStatusSource): Exclude<OrderSplitFilter, "all"> | "none" {
  const status = normalizeStatus(order.status)
  const refundAmountCents = Number(order.refundAmountCents || 0)

  if (status === "PARTIAL" || status === "PARTIALLY_FULFILLED") return "partial"
  if (status === "FULFILLED" && refundAmountCents > 0) return "partial"
  if (status === "FULFILLED") return "full"
  return "none"
}

function getBaseStatusKey(order: OrderStatusSource): DerivedOrderStatusKey {
  const status = normalizeStatus(order.status)

  switch (status) {
    case "PENDING":
      return "pending"
    case "APPROVED":
      return "approved"
    case "FULFILLED":
      return "fulfilled"
    case "PARTIAL":
    case "PARTIALLY_FULFILLED":
      return "partially_fulfilled"
    case "REFUNDED":
      return "refunded"
    case "REJECTED":
      return "rejected"
    case "CANCELLED":
      return "cancelled"
    default:
      return "unknown"
  }
}

export function getOrderDerivedStatus(
  order: OrderStatusSource,
  context: OrderStatusContext = "default"
): { key: DerivedOrderStatusKey; label: string } {
  const refundVariant = getOrderRefundVariant(order)
  const fulfillmentVariant = getOrderFulfillmentVariant(order)

  if (context === "refunded") {
    if (refundVariant === "partial") return { key: "partially_refunded", label: "Partially Refunded" }
    if (refundVariant === "full") return { key: "refunded", label: "Refunded" }
  }

  if (context === "fulfilled") {
    if (fulfillmentVariant === "partial") return { key: "partially_fulfilled", label: "Partially Fulfilled" }
    if (fulfillmentVariant === "full") return { key: "fulfilled", label: "Fulfilled" }
  }

  if (refundVariant === "full") return { key: "refunded", label: "Refunded" }
  if (refundVariant === "partial") return { key: "partially_refunded", label: "Partially Refunded" }
  if (fulfillmentVariant === "partial") return { key: "partially_fulfilled", label: "Partially Fulfilled" }

  const key = getBaseStatusKey(order)

  switch (key) {
    case "pending":
      return { key, label: "Pending" }
    case "approved":
      return { key, label: "Approved" }
    case "fulfilled":
      return { key, label: "Fulfilled" }
    case "rejected":
      return { key, label: "Rejected" }
    case "cancelled":
      return { key, label: "Cancelled" }
    default:
      return {
        key,
        label: normalizeStatus(order.status)
          .toLowerCase()
          .replace(/_/g, " ")
          .replace(/\b\w/g, (char) => char.toUpperCase()) || "Unknown",
      }
  }
}
