import { describe, expect, it } from "vitest"
import { formatInvoiceNumber } from "./invoice-number"

describe("formatInvoiceNumber", () => {
  it("formats a 6-digit APR invoice number", () => {
    expect(formatInvoiceNumber(1)).toBe("APR-000001")
    expect(formatInvoiceNumber(2)).toBe("APR-000002")
    expect(formatInvoiceNumber(999999)).toBe("APR-999999")
  })

  it("rejects invalid sequence values", () => {
    expect(() => formatInvoiceNumber(0)).toThrow("Invoice sequence")
    expect(() => formatInvoiceNumber(1000000)).toThrow("Invoice sequence")
  })
})
