import { invoiceSequences } from "@/db/schema"
import { eq, sql } from "drizzle-orm"

const INVOICE_PREFIX = "APR"
const INVOICE_SEQUENCE_WIDTH = 6
const MAX_INVOICE_SEQUENCE = 999999

type InvoiceSequenceClient = {
  insert: (table: typeof invoiceSequences) => any
  update: (table: typeof invoiceSequences) => any
}

type InvoiceSequenceReadClient = {
  execute: (query: any) => Promise<any>
}

export function formatInvoiceNumber(sequenceValue: number) {
  if (!Number.isInteger(sequenceValue) || sequenceValue < 1 || sequenceValue > MAX_INVOICE_SEQUENCE) {
    throw new Error(`Invoice sequence must be between 1 and ${MAX_INVOICE_SEQUENCE}`)
  }

  return `${INVOICE_PREFIX}-${String(sequenceValue).padStart(INVOICE_SEQUENCE_WIDTH, "0")}`
}

export async function generateNextInvoiceNumber(client: InvoiceSequenceClient, tenantId: number) {
  if (!Number.isInteger(tenantId) || tenantId < 1) {
    throw new Error("A valid tenant ID is required to generate an invoice number")
  }

  await client
    .insert(invoiceSequences)
    .values({ organizationId: tenantId, lastValue: 0 })
    .onConflictDoNothing()

  const [row] = await client
    .update(invoiceSequences)
    .set({
      lastValue: sql`${invoiceSequences.lastValue} + 1`,
      updatedAt: sql`now()`,
    })
    .where(eq(invoiceSequences.organizationId, tenantId))
    .returning({ nextValue: invoiceSequences.lastValue })

  if (!row) {
    throw new Error("Failed to generate invoice number")
  }

  return formatInvoiceNumber(Number(row.nextValue))
}

export async function hasInvoiceSequenceTable(client: InvoiceSequenceReadClient) {
  try {
    const result = await client.execute(sql`
      SELECT to_regclass('public.invoice_sequences') AS table_name
    `)
    return Boolean((result as any)?.rows?.[0]?.table_name)
  } catch (error) {
    console.error("Invoice sequence readiness check failed", error)
    return false
  }
}
