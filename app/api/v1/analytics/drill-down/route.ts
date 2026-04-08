import { NextRequest, NextResponse } from "next/server"
import { eq, and, gte, lte, desc, sql, inArray, gt, or } from "drizzle-orm"
import { withTenant, withSuperAdmin } from "@/lib/db"
import { orders, users, orderItems, branches, organizations, refundItems } from "@/db/schema"
import { getRequestScope } from "@/lib/auth"
import { error, ok, readJson } from "@/lib/api"

export async function GET(req: NextRequest) {
  try {
    const scope = await getRequestScope()
    if (!scope || !["SUPER_ADMIN", "HEAD_OFFICE", "BRANCH_ADMIN"].includes(scope.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const { searchParams } = new URL(req.url)
    const type = searchParams.get("type")?.toUpperCase()
    const startDateParam = searchParams.get("startDate")
    const endDateParam = searchParams.get("endDate")
    const compare = searchParams.get("compare") === "true"
    const compStartParam = searchParams.get("compareStartDate")
    const compEndParam = searchParams.get("compareEndDate")

    const months = searchParams.get("months")?.split(',').map(Number).filter(n => !isNaN(n)) || []
    const years = searchParams.get("years")?.split(',').map(Number).filter(n => !isNaN(n)) || []
    const compMonths = searchParams.get("compareMonths")?.split(',').map(Number).filter(n => !isNaN(n)) || []
    const compYears = searchParams.get("compareYears")?.split(',').map(Number).filter(n => !isNaN(n)) || []

    const sortBy = searchParams.get("sortBy")?.toLowerCase() === "value" ? "value" : "date"

    if (!type || !["REVENUE", "REJECTED", "FULFILLED", "ORDERS", "REFUNDED", "PENDING", "APPROVED", "PARTIAL"].includes(type)) {
      return error("Invalid drill-down type")
    }

    const result = await (scope.role === "SUPER_ADMIN" ? withSuperAdmin(handler) : withTenant(scope as any, handler))

    async function handler(tx: any) {
      // 1. Resolve Branch IDs in scope
      let targetBranchIds: number[] = []
      if (scope!.role === "BRANCH_ADMIN") {
        targetBranchIds = [scope!.branchId!]
      } else {
        const paramBranchId = searchParams.get("branchId")
        const paramBranchIds = searchParams.get("branchIds")

        if (paramBranchIds) {
          const ids = paramBranchIds.split(",").map(Number).filter(n => !isNaN(n))
          const valid = await tx.select({ id: branches.id }).from(branches).where(inArray(branches.id, ids))
          targetBranchIds = valid.map((v: any) => v.id)
        } else if (paramBranchId && paramBranchId !== "0" && paramBranchId !== "null") {
          const valid = await tx.select({ id: branches.id }).from(branches).where(eq(branches.id, Number(paramBranchId))).limit(1)
          if (valid.length > 0) targetBranchIds = [valid[0].id]
        }
      }

      const buildCond = (s: string | null, e: string | null, ms: number[], ys: number[]) => {
        const cond = []
        if (targetBranchIds.length > 0) cond.push(inArray(orders.branchId, targetBranchIds))
        if (ms.length > 0) cond.push(sql`EXTRACT(MONTH FROM ${orders.createdAt}) IN (${sql.join(ms, sql`, `)})`)
        if (ys.length > 0) cond.push(sql`EXTRACT(YEAR FROM ${orders.createdAt}) IN (${sql.join(ys, sql`, `)})`)
        if (ms.length === 0 && ys.length === 0) {
          if (s) cond.push(gte(orders.createdAt, new Date(s)))
          if (e) {
            const end = new Date(e)
            end.setHours(23, 59, 59, 999)
            cond.push(lte(orders.createdAt, end))
          }
        }
        // Type filters
        if (type === "REVENUE") cond.push(sql`UPPER(${orders.status}) IN ('FULFILLED', 'APPROVED', 'PARTIAL', 'PARTIALLY_FULFILLED')`)
        else if (type === "FULFILLED") cond.push(and(eq(sql`UPPER(${orders.status})`, "FULFILLED"), eq(sql`COALESCE(${orders.refundAmountCents}, 0)`, 0)))
        else if (type === "REJECTED") cond.push(or(eq(sql`UPPER(${orders.status})`, "REJECTED"), eq(sql`UPPER(${orders.status})`, "CANCELLED")))
        else if (type === "ORDERS") cond.push(sql`UPPER(${orders.status}) IN ('PENDING', 'APPROVED', 'FULFILLED', 'REFUNDED', 'REJECTED', 'CANCELLED', 'PARTIAL', 'PARTIALLY_FULFILLED')`)
        else if (type === "REFUNDED") cond.push(eq(sql`UPPER(${orders.status})`, "REFUNDED"))
        else if (type === "PARTIAL") cond.push(or(and(eq(sql`UPPER(${orders.status})`, "FULFILLED"), gt(sql`COALESCE(${orders.refundAmountCents}, 0)`, 0)), inArray(sql`UPPER(${orders.status})`, ["PARTIAL", "PARTIALLY_FULFILLED"])))
        else if (type === "PENDING") cond.push(eq(sql`UPPER(${orders.status})`, "PENDING"))
        else if (type === "APPROVED") cond.push(eq(sql`UPPER(${orders.status})`, "APPROVED"))
        return and(...cond)
      }

      const rawData = await tx.select({
        id: orders.id, tid: orders.tid, status: orders.status, totalCents: orders.totalCents,
        subtotalCents: orders.subtotalCents, taxCents: orders.taxCents, refundAmountCents: orders.refundAmountCents,
        createdAt: orders.createdAt, fulfilledAt: orders.fulfilledAt, branchId: orders.branchId,
        branchName: branches.name, organizationName: organizations.name, receiptData: orders.receiptData,
        creatorName: users.fullName, creatorEmployeeId: users.employeeId
      }).from(orders).leftJoin(branches, eq(orders.branchId, branches.id)).leftJoin(organizations, eq(orders.organizationId, organizations.id)).leftJoin(users, eq(orders.createdByUserId, users.id))
        .where(buildCond(startDateParam, endDateParam, months, years))
        .orderBy(sortBy === "value" ? desc(orders.totalCents) : desc(orders.createdAt)).limit(1000)

      const oIds = rawData.map((o: any) => o.id)
      const displayIds = oIds.slice(0, 100)
      let detailedMap: any = {}
      let itemCounts: any = {}

      if (displayIds.length > 0) {
        const items = await tx.select({
          id: orderItems.id, orderId: orderItems.orderId, productName: orderItems.productName, productCode: orderItems.productCode,
          quantity: orderItems.quantity, priceCents: orderItems.priceCents, refundQty: sql`COALESCE(${refundItems.quantity}, 0)`.mapWith(Number), refundAmt: sql`COALESCE(${refundItems.amountCents}, 0)`.mapWith(Number)
        }).from(orderItems).leftJoin(refundItems, eq(orderItems.id, refundItems.orderItemId)).where(inArray(orderItems.orderId, displayIds))

        items.forEach((i: any) => {
          if (!detailedMap[i.orderId]) detailedMap[i.orderId] = []
          detailedMap[i.orderId].push({ id: i.id, name: i.productName, productCode: i.productCode, quantity: i.quantity, price: i.priceCents / 100, refundQuantity: i.refundQty, refundAmount: i.refundAmt / 100 })
        })

        const counts = await tx.select({ orderId: orderItems.orderId, totalQty: sql`sum(${orderItems.quantity})`.mapWith(Number) }).from(orderItems).where(inArray(orderItems.orderId, oIds)).groupBy(orderItems.orderId)
        counts.forEach((c: any) => { itemCounts[c.orderId] = c.totalQty })
      }

      // Aggregates
      let gross = 0; let refTotal = 0; let rejTotal = 0; let discTotal = 0; let itemsTotal = 0; let fulCount = 0; let refCount = 0; let procTime = 0; let procCount = 0
      rawData.forEach((o: any) => {
        itemsTotal += (itemCounts[o.id] || 0)
        const total = (o.totalCents || 0) / 100
        const refund = (o.refundAmountCents || 0) / 100
        const status = (o.status || "").toUpperCase()
        if (['FULFILLED', 'APPROVED', 'PARTIAL', 'PARTIALLY_FULFILLED'].includes(status)) {
          gross += total; refTotal += refund
          if (['FULFILLED', 'PARTIAL', 'PARTIALLY_FULFILLED'].includes(status)) fulCount++
        }
        if (status === 'REFUNDED') refCount++
        if (status === "REJECTED" || status === "CANCELLED") rejTotal += total
        discTotal += (o.receiptData?.discount || 0)
        if (o.createdAt && o.fulfilledAt) {
          const diff = (new Date(o.fulfilledAt).getTime() - new Date(o.createdAt).getTime()) / 1000
          if (diff >= 0) { procTime += diff; procCount++ }
        }
      })

      const summary = { grossRevenue: gross, netRevenue: gross - refTotal, refundRate: gross > 0 ? (refTotal / gross) * 100 : 0, leakage: rejTotal + discTotal, avgProcessingTime: procCount > 0 ? Math.round(procTime / procCount / 60) : 0, totalItems: itemsTotal, fulfilledOrderCount: fulCount, refundedOrdersCount: refCount }

      // Comparison
      let compSummary = null
      if (compare) {
        const compData = await tx.select({ status: orders.status, totalCents: orders.totalCents, refundAmountCents: orders.refundAmountCents, receiptData: orders.receiptData }).from(orders).where(buildCond(compStartParam, compEndParam, compMonths, compYears))
        let cG = 0; let cR = 0; let cRej = 0; let cD = 0
        compData.forEach((o: any) => {
          const g = (o.totalCents || 0) / 100
          const r = (o.refundAmountCents || 0) / 100
          const s = (o.status || "").toUpperCase()
          if (['FULFILLED', 'APPROVED', 'PARTIAL', 'PARTIALLY_FULFILLED'].includes(s)) { cG += g; cR += r }
          else if (s === "REJECTED" || s === "CANCELLED") cRej += g
          cD += (o.receiptData?.discount || 0)
        })
        compSummary = { grossRevenue: cG, netRevenue: cG - cR, leakage: cRej + cD, totalOrders: compData.length }
      }

      const formatted = rawData.slice(0, 100).map((o: any) => ({
        id: o.id, tid: o.tid, status: o.status, date: o.createdAt, branchName: o.branchName, organizationName: o.organizationName,
        netValue: (o.totalCents - o.refundAmountCents) / 100, grossValue: o.totalCents / 100, refundAmount: o.refundAmountCents / 100,
        skuCount: itemCounts[o.id] || 0, preparationTime: o.fulfilledAt ? `${Math.round((new Date(o.fulfilledAt).getTime() - new Date(o.createdAt).getTime()) / 60000)} mins` : "N/A",
        buyerName: o.receiptData?.buyerName || o.creatorName || "Customer", creatorName: o.creatorName, items: detailedMap[o.id] || []
      }))

      return { items: formatted, summary, comparison: compSummary, total: rawData.length }
    }

    return ok(result)
  } catch (e: any) {
    return error(e.message || "Internal error")
  }
}

