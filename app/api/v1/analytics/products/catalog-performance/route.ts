import { NextResponse, type NextRequest } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { db } from "@/lib/db"
import { orders, orderItems, branches, globalProducts, categories, organizationInventory, branchInventory } from "@/db/schema"
import { and, eq, gte, lte, inArray, desc, isNull, sql, exists, or, isNotNull } from "drizzle-orm"
import { getCached, scopedCacheKey, CACHE_TTL } from "@/lib/cache-utils"
import { redactAnalyticsPrices, shouldHidePricesForRole } from "@/lib/price-visibility"
import { parseEndDateParam, parseStartDateParam } from "@/lib/date-range-params"

export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

        const userRole = ((session.user as any).role || "").toUpperCase().replace(/\s+/g, '_')
        const userOrgId = (session.user as any).organizationId
        const userBranchId = (session.user as any).branchId
        const pricesHidden = await shouldHidePricesForRole(userRole, userOrgId)
        const isBranchScopedRole = userRole === "BRANCH_ADMIN" || userRole === "BRANCH_MANAGER" || userRole === "ORDER_PORTAL"

        const url = new URL(req.url)
        const startDateParam = url.searchParams.get("startDate")
        const endDateParam = url.searchParams.get("endDate")
        const branchIdsParam = url.searchParams.get("branchIds")
        const groupIdsRaw = url.searchParams.get("groupIds")
        const organizationIdsRaw = url.searchParams.get("organizationIds")
        const productIdsRaw = url.searchParams.get("productIds")

        const monthsRaw = url.searchParams.get("months")
        const yearsRaw = url.searchParams.get("years")

        const parsedMonths = monthsRaw ? monthsRaw.split(',').map(Number).filter(n => !isNaN(n) && n >= 1 && n <= 12) : []
        const parsedYears = yearsRaw ? yearsRaw.split(',').map(Number).filter(n => !isNaN(n) && n > 2000) : []
        const parsedGroupIds = groupIdsRaw ? groupIdsRaw.split(',').map(Number).filter(n => !isNaN(n) && n > 0) : []
        const parsedOrganizationIds = organizationIdsRaw ? organizationIdsRaw.split(',').map(Number).filter(n => !isNaN(n) && n > 0) : []
        const parsedProductIds = productIdsRaw ? productIdsRaw.split(',').map(Number).filter(n => !isNaN(n) && n > 0) : []

        // RBAC Context Parsing
        let branchIds: number[] = []
        if (isBranchScopedRole) {
            if (!userBranchId) return NextResponse.json({ error: "Branch not assigned" }, { status: 403 })
            branchIds = [userBranchId]
        } else if (branchIdsParam) {
            branchIds = branchIdsParam.split(",").map(id => Number(id)).filter(id => !isNaN(id) && id > 0)
        }

        // If specific groups selected, resolve branches for them
        if (parsedGroupIds.length > 0) {
            const groupBranches = await db.select({ id: branches.id })
                .from(branches)
                .where(inArray(branches.groupId, parsedGroupIds));
            const groupBranchIds = groupBranches.map(b => b.id);
            
            if (branchIds.length > 0) {
                branchIds = branchIds.filter(id => groupBranchIds.includes(id));
            } else {
                branchIds = groupBranchIds;
            }
        }

        const startDate = parseStartDateParam(startDateParam)
        const endDate = parseEndDateParam(endDateParam)

        const cacheKey = scopedCacheKey('analytics:catalog-performance', {
            orgId: userOrgId,
            role: userRole
        }, {
            branchIds: branchIds.join(','),
            startDate: startDate?.toISOString(),
            endDate: endDate?.toISOString(),
            months: parsedMonths.join(','),
            years: parsedYears.join(','),
            productIds: parsedProductIds.join(','),
            groupIds: parsedGroupIds.join(','),
            organizationIds: parsedOrganizationIds.join(',')
        })

        const result = await getCached(cacheKey, async () => {
            // 1. Fetch products with optional Organization Price and Branch Assignment filtering
            const productConditions: any[] = []
            
            if (parsedProductIds.length > 0) {
                productConditions.push(inArray(globalProducts.id, parsedProductIds))
            }

            // REFINED SCOPING LOGIC
            if (branchIds.length > 0) {
                // If branch/group context specified, only show products assigned to those branches
                productConditions.push(
                    exists(
                        db.select()
                        .from(branchInventory)
                        .innerJoin(organizationInventory, eq(branchInventory.organizationInventoryId, organizationInventory.id))
                        .where(and(
                            eq(organizationInventory.globalProductId, globalProducts.id),
                            inArray(branchInventory.branchId, branchIds),
                            inArray(branchInventory.branchId, branchIds)
                        ))
                    )
                )
            } else if (parsedOrganizationIds.length > 0) {
                // If ONLY organization context is specified, only show products in organization inventory
                productConditions.push(
                    exists(
                        db.select()
                        .from(organizationInventory)
                        .where(and(
                            eq(organizationInventory.globalProductId, globalProducts.id),
                            inArray(organizationInventory.organizationId, parsedOrganizationIds),
                            // Only include those that are NOT unassigned, UNLESS they have historical sales 
                            // (we'll handle sales-based inclusion by allowing unassigned ones if they have transactions later if needed,
                            // OR we just allow them if they were deleted GLOBALLY)
                             or(
                                isNull(organizationInventory.deletedAt),
                                isNotNull(globalProducts.deletedAt)
                            )
                        ))
                    )
                )
            } else if (userOrgId && (userRole === "HEAD_OFFICE" || userRole === "SUPER_ADMIN")) {
                // Default: show products for the user's organization if no filter is active
                // (Optional: keep as-is to show all active global products if no filter)
            }


            // Determine which organization ID to use for customPrice (take the first specific one or session org)
            const targetOrgId = isBranchScopedRole
                ? userOrgId
                : parsedOrganizationIds.length === 1 ? parsedOrganizationIds[0] : userOrgId

            const productsQuery = db.select({
                id: globalProducts.id,
                productCode: globalProducts.productCode,
                name: globalProducts.name,
                unit: globalProducts.unit,
                status: globalProducts.status,
                basePrice: globalProducts.basePrice,
                stockQuantity: globalProducts.stockQuantity,
                categoryId: globalProducts.categoryId,
                customPrice: organizationInventory.customPrice,
                customName: organizationInventory.customName,
                deletedAt: globalProducts.deletedAt,
                organizationIsActive: organizationInventory.isActive,
            })
            .from(globalProducts)
            .leftJoin(organizationInventory, and(
                eq(organizationInventory.globalProductId, globalProducts.id),
                targetOrgId ? eq(organizationInventory.organizationId, targetOrgId) : sql`FALSE`
            ))
            .where(and(...productConditions))
            .orderBy(desc(globalProducts.id))

            const allProducts = await productsQuery

            const categoriesMap = new Map()
            const cats = await db.select({ id: categories.id, name: categories.name, parentId: categories.parentId }).from(categories)
            cats.forEach(c => categoriesMap.set(c.id, c))

            // 2. Fetch Aggregated Sales Data
            // We need to resolve branchIds if we haven't already for the sales data filter
            let salesBranchIds = branchIds;
            if (salesBranchIds.length === 0) {
                if (userOrgId) {
                    const orgBranches = await db.select({ id: branches.id }).from(branches).where(eq(branches.organizationId, userOrgId))
                    salesBranchIds = orgBranches.map(b => b.id)
                }
            }

            const baseConditions: any[] = [
                salesBranchIds.length > 0 ? inArray(orders.branchId, salesBranchIds) : sql`TRUE`,
                sql`UPPER(${orders.status}) IN ('FULFILLED', 'APPROVED', 'PARTIAL', 'PARTIALLY_FULFILLED')`,
                parsedProductIds.length > 0 ? inArray(orderItems.globalProductId, parsedProductIds) : sql`TRUE`
            ]

            if (parsedMonths.length > 0) {
                baseConditions.push(sql`EXTRACT(MONTH FROM ${orders.createdAt}) IN (${sql.join(parsedMonths, sql`, `)})`)
            }
            if (parsedYears.length > 0) {
                baseConditions.push(sql`EXTRACT(YEAR FROM ${orders.createdAt}) IN (${sql.join(parsedYears, sql`, `)})`)
            }

            if (parsedMonths.length === 0 && parsedYears.length === 0) {
                if (startDate) baseConditions.push(gte(orders.createdAt, startDate))
                if (endDate) baseConditions.push(lte(orders.createdAt, endDate))
            }

            const salesData = await db
                .select({
                    globalProductId: orderItems.globalProductId,
                    totalQtyOrdered: sql<number>`COALESCE(SUM(${orderItems.quantity}), 0)::numeric`,
                    totalQtyFulfilled: sql<number>`COALESCE(SUM(COALESCE(${orderItems.quantity}, 0)), 0)::numeric`, 
                    totalRevenueCents: sql<number>`SUM(ROUND(COALESCE(${orderItems.quantity}, 0) * COALESCE(${orderItems.priceCents}, 0)))::bigint`
                })
                .from(orderItems)
                .innerJoin(orders, eq(orders.id, orderItems.orderId))
                .where(and(...baseConditions))
                .groupBy(orderItems.globalProductId)

            const salesMap = new Map()
            salesData.forEach(s => salesMap.set(s.globalProductId, s))

            // 3. Merge Data
            const data = allProducts.map(p => {
                const s = salesMap.get(p.id) || { totalQtyOrdered: 0, totalQtyFulfilled: 0, totalRevenueCents: 0 }
                const catInfo = categoriesMap.get(p.categoryId)
                const parentCatInfo = catInfo?.parentId ? categoriesMap.get(catInfo.parentId) : null
                const isSuperAdmin = userRole === "SUPER_ADMIN"

                return {
                    globalProductId: p.id,
                    productCode: p.productCode,
                    productName: p.customName || p.name,
                    unit: p.unit,
                    status: p.deletedAt 
                        ? "deleted" 
                        : (p.organizationIsActive === false ? "inactive" : p.status),
                    basePriceCents: isSuperAdmin ? (p.basePrice || 0) : 0,
                    unitPriceCents: p.customPrice || p.basePrice,
                    stockQuantity: p.stockQuantity,
                    categoryName: catInfo?.name || "Uncategorized",
                    subCategoryName: parentCatInfo ? catInfo?.name : "",
                    
                    qtyOrdered: s.totalQtyOrdered,
                    qtyFulfilled: s.totalQtyFulfilled,
                    revenueGeneratedCents: Number(s.totalRevenueCents || 0),
                }
            })

            return { data }
        }, CACHE_TTL.ANALYTICS)

        return NextResponse.json(
            pricesHidden ? redactAnalyticsPrices({ ...result, pricesHidden: true }) : result
        )

    } catch (error: any) {
        console.error("Error fetching catalog performance:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
