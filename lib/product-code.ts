const CANONICAL_PRODUCT_CODE_PATTERN = /^PRD--(\d+)$/

/**
 * Returns the next code in the canonical PRD--<number> sequence.
 *
 * Only exact canonical codes participate in the sequence. This deliberately
 * ignores legacy/import codes (and older PRD-001-style codes), even when they
 * end in digits.
 */
export function getNextCanonicalProductCode(
  productCodes: readonly (string | null | undefined)[],
) {
  let maxSuffix = BigInt(0)

  for (const productCode of productCodes) {
    const match = productCode?.match(CANONICAL_PRODUCT_CODE_PATTERN)
    if (!match) continue

    const suffix = BigInt(match[1])
    if (suffix > maxSuffix) {
      maxSuffix = suffix
    }
  }

  return `PRD--${maxSuffix + BigInt(1)}`
}
