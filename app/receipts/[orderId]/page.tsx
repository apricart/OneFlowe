import { redirect } from "next/navigation"

export default async function LegacyReceiptPage({ params }: { params: Promise<{ orderId: string }> }) {
    const { orderId } = await params
    redirect(`/invoices/${orderId}`)
}
