import { orders } from "@/db/schema"
import { sql } from "drizzle-orm"
import type { FulfillmentStatus } from "@/lib/fulfillment-status"

export const orderSelectColumns = {
  id: orders.id,
  tid: orders.tid,
  organizationId: orders.organizationId,
  branchId: orders.branchId,
  status: orders.status,
  fulfillmentStatus: sql<FulfillmentStatus>`COALESCE(to_jsonb("orders") ->> 'fulfillment_status', 'NOT_STARTED')`,
  subtotalCents: orders.subtotalCents,
  taxCents: orders.taxCents,
  totalCents: orders.totalCents,
  notes: orders.notes,
  createdByUserId: orders.createdByUserId,
  createdAt: orders.createdAt,
  fulfilledAt: orders.fulfilledAt,
  updatedAt: orders.updatedAt,
  approvedByUserId: orders.approvedByUserId,
  approvedAt: orders.approvedAt,
  rejectedByUserId: orders.rejectedByUserId,
  rejectedAt: orders.rejectedAt,
  rejectionReason: orders.rejectionReason,
  approvalToken: orders.approvalToken,
  approvalTokenHash: orders.approvalTokenHash,
  approvalTokenCreatedAt: orders.approvalTokenCreatedAt,
  fulfilledByUserId: orders.fulfilledByUserId,
  refundedAt: orders.refundedAt,
  refundedByUserId: orders.refundedByUserId,
  statusAtRefund: orders.statusAtRefund,
  refundAmountCents: orders.refundAmountCents,
  refundReason: orders.refundReason,
  receiptData: orders.receiptData,
}

export function isMissingFulfillmentStatusColumn(error: any) {
  return error?.code === "42703" || error?.cause?.code === "42703"
}

export async function updateOrderFulfillmentStatusColumn(
  client: { execute: (query: any) => Promise<any> },
  orderId: number,
  status: FulfillmentStatus,
) {
  try {
    await client.execute(sql`
      UPDATE "orders"
      SET "fulfillment_status" = ${status}, "updated_at" = NOW()
      WHERE "id" = ${orderId}
    `)
    return true
  } catch (error) {
    if (isMissingFulfillmentStatusColumn(error)) return false
    throw error
  }
}
