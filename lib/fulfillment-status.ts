export const FULFILLMENT_STATUSES = [
  "NOT_STARTED",
  "IN_PROCESS",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
] as const

export type FulfillmentStatus = (typeof FULFILLMENT_STATUSES)[number]

export const FULFILLMENT_STATUS_LABELS: Record<FulfillmentStatus, string> = {
  NOT_STARTED: "Not Started",
  IN_PROCESS: "In Process",
  OUT_FOR_DELIVERY: "Out for Delivery",
  DELIVERED: "Delivered",
}

export function normalizeFulfillmentStatus(status?: string | null): FulfillmentStatus {
  const normalized = String(status || "NOT_STARTED").trim().toUpperCase()
  return FULFILLMENT_STATUSES.includes(normalized as FulfillmentStatus)
    ? (normalized as FulfillmentStatus)
    : "NOT_STARTED"
}

export function getNextFulfillmentStatus(status?: string | null): FulfillmentStatus | null {
  const current = normalizeFulfillmentStatus(status)
  const index = FULFILLMENT_STATUSES.indexOf(current)
  return index >= 0 && index < FULFILLMENT_STATUSES.length - 1
    ? FULFILLMENT_STATUSES[index + 1]
    : null
}
