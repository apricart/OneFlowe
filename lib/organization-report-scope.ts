type ReportScopeInput = {
  selectedOrganizationIds: string[]
  selectedBranchIds: string[]
  contextOrganizationId: string | null
  contextBranchId: string | null
  contextBranchIds: string[]
}

export function resolveOrganizationReportScope({
  selectedOrganizationIds,
  selectedBranchIds,
  contextOrganizationId,
  contextBranchId,
  contextBranchIds,
}: ReportScopeInput) {
  const organizationIds = selectedOrganizationIds.length > 0
    ? selectedOrganizationIds
    : contextOrganizationId
      ? [contextOrganizationId]
      : []

  const branchIds = selectedBranchIds.length > 0
    ? selectedBranchIds
    : contextBranchIds.length > 0
      ? contextBranchIds
      : contextBranchId
        ? [contextBranchId]
        : []

  return { organizationIds, branchIds }
}

export function shouldIncludeHeadOfficeUsers(
  branchIdsParam: string | null,
  groupIdsParam: string | null,
) {
  return !branchIdsParam && !groupIdsParam
}
