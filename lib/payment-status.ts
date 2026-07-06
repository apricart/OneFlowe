export const PAYMENT_STATUSES = ["UNPAID", "PAID"] as const

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number]

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  UNPAID: "Unpaid",
  PAID: "Paid",
}

export function normalizePaymentStatus(status?: string | null): PaymentStatus {
  const normalized = String(status || "UNPAID").trim().toUpperCase()
  return PAYMENT_STATUSES.includes(normalized as PaymentStatus)
    ? (normalized as PaymentStatus)
    : "UNPAID"
}
