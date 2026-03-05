"use client"

import { useMemo } from "react"
import useSWR from "swr"
import { fetcher } from "@/lib/fetcher"

export type SalesSeriesPoint = {
    label: string
    sales: number
    orders: number
}

export type BranchSalesPoint = {
    branchId: number
    branchName: string
    sales: number
    orders: number
}

export type SalesPerformanceResponse = {
    granularity: "hourly" | "daily" | "monthly" | "yearly"
    seriesData: SalesSeriesPoint[]
    totalSales: number
    totalOrders: number
    avgSales: number
    peakPeriod: { label: string; sales: number; orders: number } | null
    branchSales: BranchSalesPoint[]
    organizationSales?: { organizationId: number; organizationName: string; sales: number; orders: number }[]
}

export type DateRange = {
    startDate: Date
    endDate: Date
}

export type DashboardStatus = "all" | "PENDING" | "FULFILLED" | "REFUNDED" | "REJECTED" | "APPROVED"

export function useSalesPerformance(
    organizationId?: string | null,
    branchId?: string | null,
    branchIds?: string[], // multi-branch selection
    groupId?: string | null,
    dateRange?: DateRange | null,
    status?: DashboardStatus
) {
    const url = useMemo(() => {
        const params = new URLSearchParams()

        if (organizationId && organizationId !== "null" && organizationId !== "0") {
            params.set("organizationId", organizationId)
        }

        if (branchIds && branchIds.length > 0) {
            params.set("branchIds", branchIds.join(","))
        } else if (branchId && branchId !== "null" && branchId !== "0") {
            params.set("branchId", branchId)
        }

        if (groupId && groupId !== "all") {
            params.set("groupId", groupId)
        }

        if (dateRange) {
            params.set("startDate", dateRange.startDate.toISOString())
            params.set("endDate", dateRange.endDate.toISOString())
        } else {
            // Default: today
            const today = new Date()
            const start = new Date(today)
            start.setHours(0, 0, 0, 0)
            const end = new Date(today)
            end.setHours(23, 59, 59, 999)
            params.set("startDate", start.toISOString())
            params.set("endDate", end.toISOString())
        }

        if (status && status !== "all") {
            params.set("status", status)
        }

        return `/api/v1/analytics/sales-performance?${params.toString()}`
    }, [organizationId, branchId, branchIds, groupId, dateRange, status])

    return useSWR<SalesPerformanceResponse>(url, fetcher, {
        revalidateOnFocus: false,
        revalidateOnReconnect: true,
        refreshInterval: 120_000, // 2 minutes
    })
}

// Convenience hook for the lifetime stats using status filter
export function useDashboardKPIs(
    organizationId?: string | null,
    branchId?: string | null,
    branchIds?: string[],
    groupId?: string | null,
    dateRange?: DateRange | null,
    status?: DashboardStatus
) {
    return useSalesPerformance(organizationId, branchId, branchIds, groupId, dateRange, status)
}
