type BranchAddressParts = {
    address?: string | null
    city?: string | null
    province?: string | null
}

export function formatBranchAddress(branch: BranchAddressParts | null | undefined) {
    if (!branch) return ""

    return [branch.address, branch.city, branch.province]
        .map((part) => part?.trim())
        .filter(Boolean)
        .join(", ")
}
