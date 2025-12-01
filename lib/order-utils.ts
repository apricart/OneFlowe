export const AUTO_APPROVAL_WINDOW_MS = 1000 * 60 * 60 * 2 // 2 hours

export const STATUS_FLOW = [
  { key: "pending", label: "Pending review", description: "Awaiting head office approval." },
  { key: "approved", label: "Approved", description: "Order cleared for branch processing." },
  { key: "fulfilled", label: "Fulfilled", description: "Branch completed the order and delivery." },
  { key: "refunded", label: "Refunded", description: "Finance has issued a refund for this order." },
] as const

type OrderLike = { status: string; createdAt: string }

export function getAutoApproveMeta(order: OrderLike | null) {
  if (!order) return null
  if (order.status.toLowerCase() !== "pending") return null
  const createdAt = new Date(order.createdAt).getTime()
  const autoApproveAt = createdAt + AUTO_APPROVAL_WINDOW_MS
  const timeLeft = autoApproveAt - Date.now()
  if (timeLeft <= 0) {
    return {
      title: "Auto-approval queued",
      detail: "This order will be approved automatically any moment now unless action is taken.",
    }
  }
  const totalMinutes = Math.max(1, Math.ceil(timeLeft / 60000))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  const countdown = hours ? `${hours}h ${minutes}m` : `${minutes}m`
  return {
    title: `Auto approval in ${countdown}`,
    detail: "Review now if you need to stop or amend this request before the system approves it.",
  }
}

export function getAutoApprovalCountdown(order: OrderLike) {
  const meta = getAutoApproveMeta(order)
  return meta?.title || null
}

export function buildStatusTimeline(status: string) {
  const normalized = status.toLowerCase()
  if (normalized === "cancelled") {
    return [
      { key: "pending", label: "Pending review", description: "Awaited decision.", state: "complete" },
      { key: "cancelled", label: "Cancelled", description: "Order was cancelled by head office.", state: "current" },
    ]
  }
  const activeIndex = STATUS_FLOW.findIndex(step => step.key === normalized)
  const idx = activeIndex === -1 ? 0 : activeIndex
  return STATUS_FLOW.map((step, index) => ({
    ...step,
    state: index < idx ? "complete" : index === idx ? "current" : "upcoming",
  }))
}


