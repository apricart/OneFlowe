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

export function useDashboardAnalytics(organizationId?: string | null, branchId?: string | null, groupId?: string | null) {
  const url = useMemo(() => {
    const baseUrl = "/api/v1/analytics/dashboard"
    const params = new URLSearchParams()

    if (organizationId && organizationId !== "null" && organizationId !== "0") {
      params.set("organizationId", organizationId)
    }

    if (branchId && branchId !== "null" && branchId !== "0") {
      params.set("branchId", branchId)
    }

    if (groupId && groupId !== "all") {
      params.set("groupId", groupId)
    }

    const queryString = params.toString()
    return queryString ? `${baseUrl}?${queryString}` : baseUrl
  }, [organizationId, branchId, groupId])

  return useSWR<DashboardAnalyticsResponse>(url, fetcher, {
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

export function useWeeklySales(organizationId?: string | null, branchId?: string | null, groupId?: string | null) {
  const url = useMemo(() => {
    const baseUrl = "/api/v1/analytics/weekly-sales"
    const params = new URLSearchParams()

    if (organizationId && organizationId !== "null" && organizationId !== "0") {
      params.set("organizationId", organizationId)
    }

    if (branchId && branchId !== "null" && branchId !== "0") {
      params.set("branchId", branchId)
    }

    if (groupId && groupId !== "all") {
      params.set("groupId", groupId)
    }

    const queryString = params.toString()
    return queryString ? `${baseUrl}?${queryString}` : baseUrl
  }, [organizationId, branchId, groupId])

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

export function useYearlySales(organizationId?: string | null, branchId?: string | null, year?: number, groupId?: string | null) {
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

    if (groupId && groupId !== "all") {
      params.set("groupId", groupId)
    }

    const queryString = params.toString()
    return queryString ? `${baseUrl}?${queryString}` : baseUrl
  }, [organizationId, branchId, year, groupId])

  return useSWR<YearlySalesResponse>(url, fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
    refreshInterval: 300000, // Refresh every 5 minutes
  })
}

export type MonthlySalesMonth = {
  month: string // "Jan", "Feb", etc.
  sales: number // Sales in PKR
  orderCount: number
}

export type MonthlySalesResponse = {
  year: number
  monthlySales: MonthlySalesMonth[]
  totalSales: number
  totalOrders: number
}

export function useMonthlySales(organizationId?: string | null, branchId?: string | null, year?: number, groupId?: string | null) {
  const url = useMemo(() => {
    const baseUrl = "/api/v1/analytics/monthly-sales"
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

    if (groupId && groupId !== "all") {
      params.set("groupId", groupId)
    }

    const queryString = params.toString()
    return queryString ? `${baseUrl}?${queryString}` : baseUrl
  }, [organizationId, branchId, year, groupId])

  return useSWR<MonthlySalesResponse>(url, fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
    refreshInterval: 60000, // Refresh every minute
  })
}

export type LifetimeStatsResponse = {
  totalOrders: number
  fulfilledOrders: number
  refundedOrders: number
  totalRevenue: number // Net revenue after refunds in PKR
  grossRevenue: number // Before refunds in PKR
  totalRefunded: number // Total refunded amount in PKR
}

export function useLifetimeStats(organizationId?: string | null, branchId?: string | null, groupId?: string | null) {
  const url = useMemo(() => {
    const baseUrl = "/api/v1/analytics/lifetime-stats"
    const params = new URLSearchParams()

    if (organizationId && organizationId !== "null" && organizationId !== "0") {
      params.set("organizationId", organizationId)
    }

    if (branchId && branchId !== "null" && branchId !== "0") {
      params.set("branchId", branchId)
    }

    if (groupId && groupId !== "all") {
      params.set("groupId", groupId)
    }

    const queryString = params.toString()
    return queryString ? `${baseUrl}?${queryString}` : baseUrl
  }, [organizationId, branchId, groupId])

  return useSWR<LifetimeStatsResponse>(url, fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
    refreshInterval: 300000, // Refresh every 5 minutes
  })
}
