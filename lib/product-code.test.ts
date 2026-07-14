import { describe, expect, it } from "vitest"
import { getNextCanonicalProductCode } from "./product-code"

describe("getNextCanonicalProductCode", () => {
  it("starts the canonical sequence at PRD--1", () => {
    expect(getNextCanonicalProductCode([])).toBe("PRD--1")
  })

  it("increments the greatest numeric suffix instead of the lexical maximum", () => {
    expect(
      getNextCanonicalProductCode(["PRD--2", "PRD--19", "PRD--9"]),
    ).toBe("PRD--20")
  })

  it("returns PRD--164 after the planned imported-product range", () => {
    expect(
      getNextCanonicalProductCode(["PRD--19", "PRD--20", "PRD--163"]),
    ).toBe("PRD--164")
  })

  it("ignores legacy, old-format, and otherwise non-canonical codes", () => {
    expect(
      getNextCanonicalProductCode([
        "PRD--7",
        "LEG-KE-BB9E56DA3583FB10",
        "PRD-999",
        "prd--1000",
        " PRD--2000",
        "PRD--3000 ",
        "PRD--4A000",
        null,
        undefined,
      ]),
    ).toBe("PRD--8")
  })

  it("handles suffixes beyond JavaScript's safe integer range exactly", () => {
    expect(
      getNextCanonicalProductCode([
        "PRD--9007199254740992",
        "PRD--9007199254740993",
      ]),
    ).toBe("PRD--9007199254740994")
  })
})
