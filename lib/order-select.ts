import { orders } from "@/db/schema"
import { sql } from "drizzle-orm"
import type { FulfillmentStatus } from "@/lib/fulfillment-status"
import type { PaymentStatus } from "@/lib/payment-status"

export const orderSelectColumns = {
  id: orders.id,
  tid: orders.tid,
  organizationId: orders.organizationId,
  branchId: orders.branchId,
  status: orders.status,
  fulfillmentStatus: sql<FulfillmentStatus>`COALESCE(to_jsonb("orders") ->> 'fulfillment_status', 'NOT_STARTED')`,
  paymentStatus: sql<PaymentStatus>`COALESCE(to_jsonb("orders") ->> 'payment_status', 'UNPAID')`,
  paidAt: sql<string | null>`to_jsonb("orders") ->> 'paid_at'`,
  paidByUserId: sql<string | null>`to_jsonb("orders") ->> 'paid_by_user_id'`,
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

export async function updateOrderPaymentStatusColumn(
  client: { execute: (query: any) => Promise<any> },
  orderId: number,
  status: PaymentStatus,
  userId: string,
) {
  try {
    if (status === "PAID") {
      await client.execute(sql`
        UPDATE "orders"
        SET "payment_status" = ${status}, "paid_at" = NOW(), "paid_by_user_id" = ${userId}, "updated_at" = NOW()
        WHERE "id" = ${orderId}
      `)
    } else {
      await client.execute(sql`
        UPDATE "orders"
        SET "payment_status" = ${status}, "paid_at" = NULL, "paid_by_user_id" = NULL, "updated_at" = NOW()
        WHERE "id" = ${orderId}
      `)
    }
    return true
  } catch (error) {
    if (isMissingFulfillmentStatusColumn(error)) return false
    throw error
  }
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
