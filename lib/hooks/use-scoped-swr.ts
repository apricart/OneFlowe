"use client"
import useSWR, { type SWRConfiguration, type SWRResponse } from "swr"
import { useAppContext } from "@/components/context/app-context"

export function useScopedSWR<Key extends string, Data = any, Error = any>(
  key: Key | null,
  fetcher: (url: string) => Promise<Data>,
  config?: SWRConfiguration<Data, Error>,
): SWRResponse<Data, Error> {
  const { organizationId, branchId } = useAppContext()
  if (!key) return useSWR(null, fetcher, config) as any
  const url = new URL(key, typeof window !== "undefined" ? window.location.origin : "http://localhost")
  if (organizationId) url.searchParams.set("organizationId", organizationId)
  if (branchId) url.searchParams.set("branchId", branchId)
  // Use context as cache key to trigger revalidation when context changes
  const cacheKey = `${url.toString()}_${organizationId}_${branchId}`
  return useSWR(cacheKey, () => fetcher(url.toString()), {
    revalidateOnFocus: true,
    keepPreviousData: true,
    ...config,
  })
}
