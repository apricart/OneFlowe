import { describe, expect, it } from "vitest"
import { resolveAdminRefundReason } from "./admin-refund-approval"

describe("admin refund approval", () => {
  it("preserves a pending request reason when the reviewer does not replace it", () => {
    expect(resolveAdminRefundReason(undefined, "Original request reason")).toBe("Original request reason")
    expect(resolveAdminRefundReason("   ", "Original request reason")).toBe("Original request reason")
  })

  it("uses and trims an explicit reviewer reason", () => {
    expect(resolveAdminRefundReason("  Reviewed and approved  ", "Original")).toBe("Reviewed and approved")
  })

  it("preserves direct-refund behavior when there is no pending request", () => {
    expect(resolveAdminRefundReason(undefined)).toBeNull()
    expect(resolveAdminRefundReason("   ")).toBeNull()
  })
})
