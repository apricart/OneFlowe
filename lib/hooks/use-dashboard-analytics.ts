"use client"

import { useMemo } from "react"
import useSWR from "swr"
import { fetcher } from "@/lib/fetcher"

export type SeriesPoint = { label: string; value: number }
export type DashboardAnalyticsResponse = {
  gmvSeries: SeriesPoint[]
  branchSeries: SeriesPoint[]
  branchCount: number
  pendingApprovals: number
  ordersThisMonth: number
}




export function useDashboardAnalytics() {
  return useSWR<DashboardAnalyticsResponse>("/api/v1/analytics/dashboard", fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
  })
}

export type WeeklySalesDay = {
  day: string // "Mon", "Tue", etc.
  date: string // "YYYY-MM-DD"
  sales: number // Sales in PKR
  orderCount: number
}

export type WeeklySalesResponse = {
  weekStart: string // "YYYY-MM-DD"
  weekEnd: string // "YYYY-MM-DD"
  dailySales: WeeklySalesDay[]
  totalSales: number
  totalOrders: number
}

export function useWeeklySales(organizationId?: string | null, branchId?: string | null) {
  const url = useMemo(() => {
    const baseUrl = "/api/v1/analytics/weekly-sales"
    const params = new URLSearchParams()
    
    if (organizationId && organizationId !== "null" && organizationId !== "0") {
      params.set("organizationId", organizationId)
    }
    
    if (branchId && branchId !== "null" && branchId !== "0") {
      params.set("branchId", branchId)
    }
    
    const queryString = params.toString()
    return queryString ? `${baseUrl}?${queryString}` : baseUrl
  }, [organizationId, branchId])

  return useSWR<WeeklySalesResponse>(url, fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
    refreshInterval: 60000, // Refresh every minute
  })
}

export type YearlySalesMonth = {
  month: string // "Jan", "Feb", etc.
  sales: number // Sales in PKR
  orderCount: number
}

export type YearlySalesResponse = {
  year: number
  monthlySales: YearlySalesMonth[]
  totalSales: number
  totalOrders: number
}

export function useYearlySales(organizationId?: string | null, branchId?: string | null, year?: number) {
  const url = useMemo(() => {
    const baseUrl = "/api/v1/analytics/yearly-sales"
    const params = new URLSearchParams()
    
    if (organizationId && organizationId !== "null" && organizationId !== "0") {
      params.set("organizationId", organizationId)
    }
    
    if (branchId && branchId !== "null" && branchId !== "0") {
      params.set("branchId", branchId)
    }
    
    if (year) {
      params.set("year", year.toString())
    }
    
    const queryString = params.toString()
    return queryString ? `${baseUrl}?${queryString}` : baseUrl
  }, [organizationId, branchId, year])

  return useSWR<YearlySalesResponse>(url, fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
    refreshInterval: 300000, // Refresh every 5 minutes
  })
}

