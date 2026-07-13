import { describe, expect, it } from "vitest"
import { buildRefundSuccessPayload, redactRefundHistoryForPriceHidden } from "./refund-visibility"

describe("refund visibility", () => {
  it("allowlists quantity-only history without monetary or email fields", () => {
    const result = redactRefundHistoryForPriceHidden([{
      id: 12,
      refundNumber: "Refund-000012",
      reason: "Damaged",
      createdAt: "2026-07-13T00:00:00.000Z",
      status: "PENDING",
      amountCents: 123456,
      requestedByUserId: "private-user-id",
      processedByUser: { fullName: "Reviewer", email: "private@example.com" },
      futureMonetaryField: 999,
      items: [{
        orderItemId: 7,
        quantity: 2,
        productName: "Product",
        unit: "pcs",
        amountCents: 123456,
        priceCents: 61728,
      }],
    }])

    expect(result).toEqual([{
      id: 12,
      refundNumber: "Refund-000012",
      reason: "Damaged",
      createdAt: "2026-07-13T00:00:00.000Z",
      status: "PENDING",
      processedByUser: { fullName: "Reviewer" },
      items: [{
        orderItemId: 7,
        quantity: 2,
        productName: "Product",
        unit: "pcs",
      }],
    }])
  })

  it("returns no monetary fields in a price-hidden success payload", () => {
    expect(buildRefundSuccessPayload({
      pricesHidden: true,
      isSuperAdmin: false,
      totalRefundAmount: 50000,
      remainingRefundableAmount: 100000,
    })).toEqual({ message: "Refund request submitted successfully" })
  })

  it("preserves the existing visible-price success payload", () => {
    expect(buildRefundSuccessPayload({
      pricesHidden: false,
      isSuperAdmin: false,
      totalRefundAmount: 50000,
      remainingRefundableAmount: 100000,
    })).toEqual({
      message: "Refund request of 500.00 PKR submitted successfully",
      refundAmount: "500.00",
      remainingRefundable: "500.00",
    })
  })
})
