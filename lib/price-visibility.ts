import { eq, and } from "drizzle-orm"
import { organizationSettings } from "@/db/schema"
import { db } from "@/lib/db"

export const HIDE_PRICES_SETTING_KEY = "hide_prices_for_branch_and_order_portal"

const PRICE_RESTRICTED_ROLES = new Set(["BRANCH_ADMIN", "ORDER_PORTAL"])

export function isPriceRestrictedRole(role: unknown) {
  return typeof role === "string" && PRICE_RESTRICTED_ROLES.has(role)
}

export async function shouldHidePricesForRole(role: unknown, organizationId: unknown) {
  if (!isPriceRestrictedRole(role)) return false

  const orgId = Number(organizationId)
  if (!Number.isFinite(orgId) || orgId <= 0) return false

  const [setting] = await db
    .select({ value: organizationSettings.value })
    .from(organizationSettings)
    .where(and(eq(organizationSettings.organizationId, orgId), eq(organizationSettings.key, HIDE_PRICES_SETTING_KEY)))
    .limit(1)

  return setting?.value === true
}

function redactReceiptItems(items: any[] | undefined) {
  if (!Array.isArray(items)) return items

  return items.map((category) => ({
    ...category,
    items: Array.isArray(category.items)
      ? category.items.map((item: any) => ({ ...item, rate: null, total: null }))
      : category.items,
    subCategories: Array.isArray(category.subCategories)
      ? category.subCategories.map((subCategory: any) => ({
        ...subCategory,
        items: Array.isArray(subCategory.items)
          ? subCategory.items.map((item: any) => ({ ...item, rate: null, total: null }))
          : subCategory.items,
      }))
      : category.subCategories,
  }))
}

export function redactReceiptPrices(receiptData: any) {
  if (!receiptData) return receiptData

  return {
    ...receiptData,
    subtotal: null,
    tax: null,
    discount: null,
    deliveryCharges: null,
    totalAmount: null,
    items: redactReceiptItems(receiptData.items),
  }
}

const ANALYTICS_MONEY_KEYS = new Set([
  "addon",
  "allocated",
  "amount",
  "amountAllocatedCents",
  "amountCreditedCents",
  "amountHeldCents",
  "amountSpentCents",
  "avgSales",
  "avgRevenuePerGroup",
  "baseline",
  "baselineAmount",
  "baselineBudgetCents",
  "basePriceCents",
  "compareRevenue",
  "compareTotalSpentCents",
  "compSpent",
  "compSales",
  "credited",
  "grossRevenue",
  "grossRevenueCents",
  "held",
  "heldCents",
  "fulfilledProductRevenueCents",
  "fulfilledRevenueCents",
  "leakage",
  "netRevenue",
  "netTotalCents",
  "prevRevenue",
  "price",
  "priceCents",
  "remaining",
  "remainingCents",
  "refundAmount",
  "refundAmountCents",
  "refundedValue",
  "refundLossCents",
  "refunds",
  "refundedProductRevenueCents",
  "refundedRevenueCents",
  "revenue",
  "revenueCents",
  "revenueGeneratedCents",
  "sales",
  "spent",
  "spentCents",
  "subtotalCents",
  "taxCents",
  "totalAllocated",
  "totalAmount",
  "totalAmountCents",
  "totalBudget",
  "totalCents",
  "totalCredited",
  "totalHeld",
  "totalNetSales",
  "totalProductRevenueCents",
  "totalRefundCents",
  "totalRefunded",
  "totalRefundedCents",
  "totalRefunds",
  "totalRemaining",
  "totalRejected",
  "totalRevenue",
  "totalRevenueCents",
  "totalSales",
  "totalSpentCents",
  "totalSubtotal",
  "totalTax",
  "unitPriceCents",
  "unitRateCents",
  "valueDeliveredCents",
  "valueFulfilledCents",
  "valuePendingCents",
  "valueRefundedCents",
  "valueRejectedCents",
])

export function redactAnalyticsPrices<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => redactAnalyticsPrices(item)) as T
  }

  if (!value || typeof value !== "object") return value
  if (value instanceof Date) return value

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
      key,
      ANALYTICS_MONEY_KEYS.has(key) ? null : redactAnalyticsPrices(entry),
    ])
  ) as T
}
