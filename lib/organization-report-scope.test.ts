import { describe, expect, it } from "vitest"
import {
  resolveOrganizationReportScope,
  shouldIncludeHeadOfficeUsers,
} from "./organization-report-scope"

describe("resolveOrganizationReportScope", () => {
  it("inherits the organization and branch selected in the app header", () => {
    expect(resolveOrganizationReportScope({
      selectedOrganizationIds: [],
      selectedBranchIds: [],
      contextOrganizationId: "12",
      contextBranchId: "34",
      contextBranchIds: ["34"],
    })).toEqual({ organizationIds: ["12"], branchIds: ["34"] })
  })

  it("keeps page-level filters when they are explicitly selected", () => {
    expect(resolveOrganizationReportScope({
      selectedOrganizationIds: ["56"],
      selectedBranchIds: ["78"],
      contextOrganizationId: "12",
      contextBranchId: "34",
      contextBranchIds: ["34"],
    })).toEqual({ organizationIds: ["56"], branchIds: ["78"] })
  })

  it("falls back to the legacy single branch context", () => {
    expect(resolveOrganizationReportScope({
      selectedOrganizationIds: [],
      selectedBranchIds: [],
      contextOrganizationId: "12",
      contextBranchId: "34",
      contextBranchIds: [],
    }).branchIds).toEqual(["34"])
  })
})

describe("shouldIncludeHeadOfficeUsers", () => {
  it("includes organization-level users for an organization-wide report", () => {
    expect(shouldIncludeHeadOfficeUsers(null, null)).toBe(true)
  })

  it("excludes organization-level users from branch and group totals", () => {
    expect(shouldIncludeHeadOfficeUsers("34", null)).toBe(false)
    expect(shouldIncludeHeadOfficeUsers(null, "9")).toBe(false)
  })
})
