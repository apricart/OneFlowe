/** Preserve the request's original reason when it is approved without an edit. */
export function resolveAdminRefundReason(
  submittedReason: unknown,
  pendingRequestReason?: string | null,
) {
  const normalized = typeof submittedReason === "string" ? submittedReason.trim() : ""
  return normalized || pendingRequestReason || null
}
