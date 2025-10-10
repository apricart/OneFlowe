"use client"
import useSWR, { type SWRConfiguration, type SWRResponse } from "swr"
import { useOrgBranch } from "@/components/context/org-branch-context"

export function useScopedSWR<Key extends string, Data = any, Error = any>(
  key: Key | null,
  fetcher: (url: string) => Promise<Data>,
  config?: SWRConfiguration<Data, Error>,
): SWRResponse<Data, Error> {
  const { organizationId, branchId, version } = useOrgBranch()
  if (!key) return useSWR(null, fetcher, config) as any
  const url = new URL(key, typeof window !== "undefined" ? window.location.origin : "http://localhost")
  if (organizationId) url.searchParams.set("organizationId", organizationId)
  if (branchId) url.searchParams.set("branchId", branchId)
  url.searchParams.set("v", String(version))
  return useSWR(url.toString(), fetcher, {
    revalidateOnFocus: true,
    keepPreviousData: true,
    ...config,
  })
}
