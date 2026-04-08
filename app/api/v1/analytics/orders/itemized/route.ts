import { NextResponse, type NextRequest } from "next/server"
import { withTenant, withSuperAdmin } from "@/lib/db"
import { orders, orderItems, branches, users, globalProducts, categories, refundItems, groups, organizations } from "@/db/schema"
import { and, eq, gte, lte, inArray, desc, sql } from "drizzle-orm"
import { getRequestScope } from "@/lib/auth"
import { error, ok } from "@/lib/api"

export async function GET(req: NextRequest) {
  try {
    const scope = await getRequestScope()
    if (!scope) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const url = new URL(req.url)
    const startDateParam = url.searchParams.get("startDate")
    const endDateParam = url.searchParams.get("endDate")
    const branchIdsParam = url.searchParams.get("branchIds")
    const compare = url.searchParams.get("compare") === "true"
    const compareStartDateParam = url.searchParams.get("compareStartDate")
    const compareEndDateParam = url.searchParams.get("compareEndDate")
    const productIdsParam = url.searchParams.get("productIds")
    const organizationIdsParam = url.searchParams.get("organizationIds")
    const groupIdsParam = url.searchParams.get("groupIds")

    const monthsRaw = url.searchParams.get("months")
    const yearsRaw = url.searchParams.get("years")
    const compareMonthsRaw = url.searchParams.get("compareMonths")
    const compareYearsRaw = url.searchParams.get("compareYears")

    const parsedMonths = monthsRaw ? monthsRaw.split(',').map(Number).filter(n => !isNaN(n) && n >= 1 && n <= 12) : []
    const parsedYears = yearsRaw ? yearsRaw.split(',').map(Number).filter(n => !isNaN(n) && n > 2000) : []
    const parsedCompMonths = compareMonthsRaw ? compareMonthsRaw.split(',').map(Number).filter(n => !isNaN(n) && n >= 1 && n <= 12) : []
    const parsedCompYears = compareYearsRaw ? compareYearsRaw.split(',').map(Number).filter(n => !isNaN(n) && n > 2000) : []

    const result = await (scope.role === "SUPER_ADMIN" ? withSuperAdmin(handler) : withTenant(scope as any, handler))

    async function handler(tx: any) {
      let branchIds: number[] = []
      if (branchIdsParam) {
        branchIds = branchIdsParam.split(",").map(id => Number(id)).filter(id => !isNaN(id) && id > 0)
      } else if (scope!.role === "BRANCH_ADMIN") {
        branchIds = [scope!.branchId!]
      } else {
        const targetOrgId = scope!.organizationId
        const b = await tx.select({ id: branches.id }).from(branches).where(targetOrgId ? eq(branches.organizationId, targetOrgId) : undefined)
        branchIds = b.map((br: any) => br.id)
      }

      if (branchIds.length === 0) return { data: [], comparison: null }

      let startDate = startDateParam ? new Date(startDateParam) : undefined
      let endDate = endDateParam ? new Date(endDateParam) : undefined
      if (startDate) startDate.setHours(0, 0, 0, 0)
      if (endDate) endDate.setHours(23, 59, 59, 999)

      const baseConditions: any[] = [
        inArray(orders.branchId, branchIds),
        sql`UPPER(${orders.status}) IN ('FULFILLED', 'APPROVED', 'REFUNDED', 'PENDING', 'REJECTED', 'CANCELLED')`
      ]

      if (parsedMonths.length > 0) baseConditions.push(sql`EXTRACT(MONTH FROM ${orders.createdAt}) IN (${sql.join(parsedMonths, sql`, `)})`)
      if (parsedYears.length > 0) baseConditions.push(sql`EXTRACT(YEAR FROM ${orders.createdAt}) IN (${sql.join(parsedYears, sql`, `)})`)
      if (parsedMonths.length === 0 && parsedYears.length === 0) {
        if (startDate) baseConditions.push(gte(orders.createdAt, startDate))
        if (endDate) baseConditions.push(lte(orders.createdAt, endDate))
      }

      if (productIdsParam) {
        const ids = productIdsParam.split(",").map(Number).filter(id => !isNaN(id) && id > 0)
        if (ids.length > 0) baseConditions.push(inArray(orderItems.globalProductId, ids))
      }
      if (groupIdsParam) {
        const ids = groupIdsParam.split(",").map(Number).filter(id => !isNaN(id) && id > 0)
        if (ids.length > 0) baseConditions.push(inArray(branches.groupId, ids))
      }
      if (organizationIdsParam) {
        const ids = organizationIdsParam.split(",").map(Number).filter(id => !isNaN(id) && id > 0)
        if (ids.length > 0) baseConditions.push(inArray(orders.organizationId, ids))
      }

      const results = await tx.select({
        orderId: orders.id, tid: orders.tid, status: orders.status, orderCreatedAt: orders.createdAt,
        userId: users.id, userName: users.fullName, userEmail: users.email, employeeId: users.employeeId,
        branchName: branches.name, organizationName: organizations.name, groupName: groups.name,
        itemCode: orderItems.productCode, itemName: orderItems.productName, itemUnit: orderItems.unit,
        categoryName: categories.name, qtyOrdered: orderItems.quantity, priceCents: orderItems.priceCents,
        orderItemId: orderItems.id
      }).from(orderItems)
        .innerJoin(orders, eq(orderItems.orderId, orders.id))
        .innerJoin(users, eq(orders.createdByUserId, users.id))
        .innerJoin(branches, eq(orders.branchId, branches.id))
        .leftJoin(organizations, eq(orders.organizationId, organizations.id))
        .leftJoin(groups, eq(branches.groupId, groups.id))
        .innerJoin(globalProducts, eq(orderItems.globalProductId, globalProducts.id))
        .leftJoin(categories, eq(globalProducts.categoryId, categories.id))
        .where(and(...baseConditions))
        .orderBy(desc(orders.createdAt))

      const validOrderItemIds = results.map((r: any) => r.orderItemId)
      let refundQuantities: Record<number, { qty: number; amount: number }> = {}

      if (validOrderItemIds.length > 0) {
        const refundsObj = await tx.select({ orderItemId: refundItems.orderItemId, qty: refundItems.quantity, amount: refundItems.amountCents }).from(refundItems).where(inArray(refundItems.orderItemId, validOrderItemIds))
        refundQuantities = refundsObj.reduce((acc: any, curr: any) => {
          if (curr.orderItemId) {
            acc[curr.orderItemId] = { qty: (acc[curr.orderItemId]?.qty || 0) + curr.qty, amount: (acc[curr.orderItemId]?.amount || 0) + (curr.amount || 0) }
          }
          return acc
        }, {})
      }

      const flattened = results.map((row: any) => {
        const refundData = refundQuantities[row.orderItemId] || { qty: 0, amount: 0 }
        const totalItemValue = row.qtyOrdered * row.priceCents
        const valueRefundedCents = Math.min(totalItemValue, refundData.amount || (refundData.qty * row.priceCents))
        const effectiveRefundedQty = Math.min(row.qtyOrdered, refundData.qty)
        const status = (row.status || "").toUpperCase()

        let qtyDelivered = row.qtyOrdered; let vF = 0; let vR = 0; let vP = 0
        if (['FULFILLED', 'REFUNDED', 'APPROVED'].includes(status)) {
          qtyDelivered = Math.max(0, row.qtyOrdered - effectiveRefundedQty)
          vF = Math.max(0, totalItemValue - valueRefundedCents)
        } else if (status === 'REJECTED' || status === 'CANCELLED') { vR = totalItemValue; qtyDelivered = 0 }
        else if (status === 'PENDING') { vP = totalItemValue; qtyDelivered = 0 }

        return {
          id: row.orderItemId, tid: row.tid, orderId: row.orderId, status: row.status, orderCreatedAt: row.orderCreatedAt,
          userId: row.userId, employeeId: row.employeeId || row.userId.split('-')[0], userName: row.userName || row.userEmail?.split('@')[0], userEmail: row.userEmail,
          organizationName: row.organizationName || 'N/A', group: row.groupName, branchName: row.branchName,
          itemCode: row.itemCode || 'Unknown', itemCategory: row.categoryName || 'Uncategorized', itemDetails: row.itemName,
          unit: row.itemUnit, unitRateCents: row.priceCents, qtyOrdered: row.qtyOrdered, qtyDelivered: qtyDelivered,
          priceCents: row.priceCents, subtotalCents: totalItemValue, refundAmountCents: valueRefundedCents,
          netTotalCents: (status === 'REJECTED' || status === 'CANCELLED') ? 0 : vF,
          valueFulfilledCents: vF, valueDeliveredCents: vF, valueRefundedCents, valueRejectedCents: vR, valuePendingCents: vP
        }
      })

      let comparisonSummary = null
      if (compare) {
        let pS: Date; let pE: Date
        if (compareStartDateParam && compareEndDateParam) {
          pS = new Date(compareStartDateParam); pE = new Date(compareEndDateParam); pS.setHours(0,0,0,0); pE.setHours(23,59,59,999)
        } else if (startDateParam && endDateParam) {
          const start = new Date(startDateParam); const end = new Date(endDateParam); const dur = end.getTime() - start.getTime(); pS = new Date(start.getTime() - dur - 1); pE = new Date(start.getTime() - 1)
        } else { pS = new Date(0); pE = new Date(0) }

        const compCond: any[] = [inArray(orders.branchId, branchIds)]
        if (parsedCompMonths.length > 0 || parsedCompYears.length > 0) {
          if (parsedCompMonths.length > 0) compCond.push(sql`EXTRACT(MONTH FROM ${orders.createdAt}) IN (${sql.join(parsedCompMonths, sql`, `)})`)
          if (parsedCompYears.length > 0) compCond.push(sql`EXTRACT(YEAR FROM ${orders.createdAt}) IN (${sql.join(parsedCompYears, sql`, `)})`)
        } else if (pS.getTime() !== 0) { compCond.push(gte(orders.createdAt, pS), lte(orders.createdAt, pE)) }

        const compResults = await tx.select({ status: orders.status, totalCents: orders.totalCents, refundAmountCents: orders.refundAmountCents }).from(orders).where(and(...compCond))
        const compFulfilled = compResults.filter((r: any) => ['FULFILLED', 'REFUNDED', 'APPROVED'].includes(r.status?.toUpperCase() || ""))
        const compRejected = compResults.filter((r: any) => ['REJECTED', 'CANCELLED'].includes(r.status?.toUpperCase() || ""))

        comparisonSummary = {
          totalOrders: compResults.length,
          totalRevenue: compFulfilled.reduce((s: number, r: any) => s + ((r.totalCents || 0) - (r.refundAmountCents || 0)), 0),
          totalRejected: compRejected.reduce((s: number, r: any) => s + (r.totalCents || 0), 0),
          totalRefunded: compResults.reduce((s: number, r: any) => s + (r.refundAmountCents || 0), 0)
        }
      }

      return { data: flattened, comparison: comparisonSummary }
    }

    return ok(result)
  } catch (e: any) {
    return error(e.message || "Internal error")
  }
}
