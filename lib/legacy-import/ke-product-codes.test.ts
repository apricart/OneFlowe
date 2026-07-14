import { describe, expect, it } from "vitest"
import {
  KE_PRODUCT_CODE_MIGRATION,
  buildKeProductCodeMappings,
  classifyKeProductCodeState,
  expectedKeProductCode,
  sha256Json,
} from "./ke-product-codes"

function legacyRows() {
  return Array.from({ length: KE_PRODUCT_CODE_MIGRATION.productCount }, (_, index) => ({
    id: KE_PRODUCT_CODE_MIGRATION.firstProductId + index,
    name: `Legacy product ${index + 1}`,
    productCode: `LEG-KE-${index.toString(16).toUpperCase().padStart(16, "0")}`,
  }))
}

describe("K-Electric imported product-code mapping", () => {
  it("maps the exact imported ID range to PRD--20 through PRD--163", () => {
    const mappings = buildKeProductCodeMappings(legacyRows())
    expect(mappings).toHaveLength(144)
    expect(mappings[0]).toMatchObject({ globalProductId: 165, newCode: "PRD--20" })
    expect(mappings.find((row) => row.globalProductId === 203)?.newCode).toBe("PRD--58")
    expect(mappings.at(-1)).toMatchObject({ globalProductId: 308, newCode: "PRD--163" })
  })

  it("distinguishes complete pending, applied, and mixed states", () => {
    const pending = legacyRows()
    expect(classifyKeProductCodeState(pending)).toBe("PENDING")
    const applied = pending.map((row) => ({ ...row, productCode: expectedKeProductCode(row.id) }))
    expect(classifyKeProductCodeState(applied)).toBe("APPLIED")
    expect(classifyKeProductCodeState([{ ...pending[0], productCode: "PRD--20" }, ...pending.slice(1)])).toBe("MIXED")
  })

  it("rejects missing or shifted target products", () => {
    expect(() => buildKeProductCodeMappings(legacyRows().slice(1))).toThrow(/Expected 144/)
    const shifted = legacyRows()
    shifted[10] = { ...shifted[10], id: 999 }
    expect(() => buildKeProductCodeMappings(shifted)).toThrow(/Expected imported product ID/)
  })

  it("produces deterministic manifest digests", () => {
    expect(sha256Json({ mappings: buildKeProductCodeMappings(legacyRows()) }))
      .toBe(sha256Json({ mappings: buildKeProductCodeMappings(legacyRows()) }))
  })
})
