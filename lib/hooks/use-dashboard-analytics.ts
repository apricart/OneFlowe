"use client"

import useSWR from "swr"
import { fetcher } from "@/lib/fetcher"

export type DashboardAnalyticsResponse = {
  gmvSeries: { label: string; value: number }[]
  branchSeries: { label: string; value: number }[]
}

export function useDashboardAnalytics() {
  return useSWR<DashboardAnalyticsResponse>("/api/v1/analytics/dashboard", fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
  })
}

