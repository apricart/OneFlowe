type RefundHistoryItem = {
  orderItemId: number
  quantity: number
  productName: string
  unit: string | null
  [key: string]: unknown
}

type RefundHistoryRecord = {
  id: number
  refundNumber: string | null
  reason: string | null
  createdAt: Date | string | null
  status: string
  processedByUser?: { fullName?: string | null } | null
  items?: RefundHistoryItem[]
  [key: string]: unknown
}

/**
 * Price-hidden refund responses use an allowlist so newly-added monetary fields
 * cannot accidentally become visible to branch/order-portal users.
 */
export function redactRefundHistoryForPriceHidden<T extends RefundHistoryRecord>(records: T[]) {
  return records.map((record) => ({
    id: record.id,
    refundNumber: record.refundNumber,
    reason: record.reason,
    createdAt: record.createdAt,
    status: record.status,
    processedByUser: record.processedByUser
      ? { fullName: record.processedByUser.fullName || null }
      : null,
    items: Array.isArray(record.items)
      ? record.items.map((item) => ({
          orderItemId: item.orderItemId,
          quantity: item.quantity,
          productName: item.productName,
          unit: item.unit,
        }))
      : [],
  }))
}

export function buildRefundSuccessPayload({
  pricesHidden,
  isSuperAdmin,
  totalRefundAmount,
  remainingRefundableAmount,
}: {
  pricesHidden: boolean
  isSuperAdmin: boolean
  totalRefundAmount: number
  remainingRefundableAmount: number
}) {
  if (pricesHidden) {
    return { message: "Refund request submitted successfully" }
  }

  return {
    message: isSuperAdmin
      ? `Refund of ${(totalRefundAmount / 100).toFixed(2)} PKR processed successfully`
      : `Refund request of ${(totalRefundAmount / 100).toFixed(2)} PKR submitted successfully`,
    refundAmount: (totalRefundAmount / 100).toFixed(2),
    remainingRefundable: ((remainingRefundableAmount - totalRefundAmount) / 100).toFixed(2),
  }
}
