/**
 * Centralized Metric Utility — Single Source of Truth
 * 
 * ALL analytics APIs must use these expressions for KPI calculations.
 * This eliminates data drift between Dashboard, Reports, and Drill-downs.
 * 
 * BUSINESS RULES:
 * - Revenue = SUM of totalCents WHERE status = 'FULFILLED' ONLY
 * - Order Count (for revenue context) = COUNT WHERE status = 'FULFILLED'
 * - REJECTED and REFUNDED orders are EXCLUDED from Revenue & Order Count
 * - Refund Amount = SUM of refundAmountCents WHERE status = 'REFUNDED'
 */

import { sql } from "drizzle-orm"
import { orders } from "@/db/schema"

/**
 * Shared SQL expressions for all analytics queries.
 * Import these into every analytics route to guarantee parity.
 */
export const metricExpressions = {
    /** Revenue: FULFILLED orders only, no deductions */
    revenue: sql<number>`COALESCE(SUM(
    CASE WHEN UPPER(${orders.status}) = 'FULFILLED'
         THEN ${orders.totalCents}
         ELSE 0
    END
  ), 0)`.mapWith(Number),

    /** Fulfilled order count */
    fulfilledCount: sql<number>`COALESCE(COUNT(
    CASE WHEN UPPER(${orders.status}) = 'FULFILLED' THEN 1 END
  ), 0)`.mapWith(Number),

    /** Rejected order count (includes CANCELLED) */
    rejectedCount: sql<number>`COALESCE(COUNT(
    CASE WHEN UPPER(${orders.status}) IN ('REJECTED', 'CANCELLED') THEN 1 END
  ), 0)`.mapWith(Number),

    /** Refunded order count */
    refundedCount: sql<number>`COALESCE(COUNT(
    CASE WHEN UPPER(${orders.status}) = 'REFUNDED' THEN 1 END
  ), 0)`.mapWith(Number),

    /** Approved order count */
    approvedCount: sql<number>`COALESCE(COUNT(
    CASE WHEN UPPER(${orders.status}) = 'APPROVED' THEN 1 END
  ), 0)`.mapWith(Number),

    /** Total refund amount (from REFUNDED orders) */
    totalRefundAmount: sql<number>`COALESCE(SUM(
    CASE WHEN UPPER(${orders.status}) = 'REFUNDED'
         THEN COALESCE(${orders.refundAmountCents}, 0)
         ELSE 0
    END
  ), 0)`.mapWith(Number),

    /** Total order count across ALL statuses (for "Orders" KPI on dashboard) */
    totalOrderCount: sql<number>`COALESCE(COUNT(${orders.id}), 0)`.mapWith(Number),
}

/**
 * Status filter for queries that should only include revenue-eligible orders.
 * Use this in WHERE clauses when the query is specifically for revenue/financial data.
 */
export const FULFILLED_ONLY_FILTER = sql`UPPER(${orders.status}) = 'FULFILLED'`

/**
 * Status filter that includes both FULFILLED and REFUNDED (for backward compat views).
 */
export const FULFILLED_AND_REFUNDED_FILTER = sql`UPPER(${orders.status}) IN ('FULFILLED', 'REFUNDED')`
