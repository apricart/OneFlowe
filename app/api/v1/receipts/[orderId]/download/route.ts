import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { db } from "@/lib/db"
import { orders } from "@/db/schema"
import { eq } from "drizzle-orm"
import { jsPDF } from "jspdf"
import path from "path"
import fs from "fs"

export async function GET(
    req: NextRequest,
    props: { params: Promise<{ orderId: string }> }
) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const params = await props.params
        const orderId = parseInt(params.orderId)
        if (isNaN(orderId)) {
            return NextResponse.json({ error: "Invalid order ID" }, { status: 400 })
        }

        const [order] = await db
            .select()
            .from(orders)
            .where(eq(orders.id, orderId))
            .limit(1)

        if (!order || !order.receiptData) {
            return NextResponse.json({ error: "Receipt not found" }, { status: 404 })
        }

        const receiptData = order.receiptData as any

        // Generate PDF (A4 size: 210mm x 297mm)
        const doc = new jsPDF()

        // --- Header Section ---
        // Logo (Attempt to load from public folder)
        try {
            const logoPath = path.join(process.cwd(), "public", "logo-pos.png")
            if (fs.existsSync(logoPath)) {
                const logoData = fs.readFileSync(logoPath).toString("base64")
                doc.addImage(`data:image/png;base64,${logoData}`, "PNG", 15, 15, 60, 16, undefined, 'FAST')
            } else {
                doc.setTextColor(25, 34, 109) // Navy blue from logo
                doc.setFont("helvetica", "bold")
                doc.setFontSize(24)
                doc.text("ONEFLOWE", 15, 25)
            }
        } catch (e) {
            console.error("Logo loading error:", e)
            doc.setFontSize(20)
            doc.text("ONEFLOWE", 15, 25)
        }

        // Company info under logo
        doc.setTextColor(30, 41, 59)
        doc.setFont("helvetica", "bold")
        doc.setFontSize(9)
        doc.text("From:", 15, 38)
        doc.setFont("helvetica", "normal")
        doc.setFontSize(10)
        doc.text(receiptData.organizationName || "Apricart E-Store Pvt Ltd", 15, 43)

        // Right side: Invoice Meta
        doc.setFont("helvetica", "bold")
        doc.setFontSize(18)
        doc.text(`INVOICE#: ${receiptData.invoiceNumber}`, 195, 22, { align: "right" })

        doc.setFontSize(9)
        doc.setTextColor(100, 116, 139)
        doc.text("DATE:", 160, 28)
        doc.setTextColor(30, 41, 59)
        doc.text(receiptData.date, 195, 28, { align: "right" })

        doc.setTextColor(100, 116, 139)
        doc.text("Contact No:", 160, 33)
        doc.setTextColor(30, 41, 59)
        doc.text(receiptData.organizationContact || "0333-3182410", 195, 33, { align: "right" })

        // Buyer details on right
        doc.setTextColor(100, 116, 139)
        doc.setFont("helvetica", "bold")
        doc.text("BUYER NAME:", 160, 45)
        doc.setTextColor(15, 23, 42)
        doc.text(String(receiptData.buyerName).toUpperCase(), 195, 45, { align: "right" })

        doc.setTextColor(100, 116, 139)
        doc.text("Deliver to:", 160, 50)
        doc.setFont("helvetica", "normal")
        doc.setFontSize(8)
        const addrLines = doc.splitTextToSize(receiptData.buyerAddress || '—', 50)
        doc.text(addrLines, 195, 50, { align: "right" })

        // Divider
        doc.setDrawColor(226, 232, 240)
        doc.setLineWidth(0.5)
        doc.line(15, 65, 195, 65)

        // --- Items Table ---
        let y = 75
        doc.setFillColor(15, 23, 42)
        doc.rect(15, y, 180, 10, "F")
        doc.setTextColor(255, 255, 255)
        doc.setFont("helvetica", "bold")
        doc.setFontSize(9)
        doc.text("DESCRIPTION", 20, y + 7)
        doc.text("RATE", 140, y + 7, { align: "right" })
        doc.text("QTY", 160, y + 7, { align: "right" })
        doc.text("TOTAL", 190, y + 7, { align: "right" })

        y += 15
        doc.setTextColor(30, 41, 59)

        receiptData.items?.forEach((cat: any) => {
            // Category Header
            if (y > 270) { doc.addPage(); y = 20; }
            doc.setFillColor(248, 250, 252)
            doc.rect(15, y - 4, 180, 6, "F")
            doc.setFont("helvetica", "bold")
            doc.setFontSize(7)
            doc.text((cat.mainCategoryName || cat.categoryName || "ITEMS")?.toUpperCase(), 17, y)
            y += 6

            const subCats = cat.subCategories || [{ items: cat.items }]
            subCats.forEach((sub: any) => {
                sub.items?.forEach((item: any) => {
                    if (y > 270) {
                        doc.addPage()
                        y = 20
                    }
                    doc.setFont("helvetica", "normal")
                    doc.setFontSize(8)
                    doc.text(item.description?.substring(0, 60) || "", 20, y)
                    doc.text(Number(item.rate).toLocaleString(), 140, y, { align: "right" })
                    doc.text(String(item.quantity), 160, y, { align: "right" })
                    doc.setFont("helvetica", "bold")
                    doc.text(Number(item.total).toLocaleString(), 190, y, { align: "right" })

                    doc.setDrawColor(241, 245, 249)
                    doc.line(15, y + 2, 195, y + 2)
                    y += 8
                })
            })
        })

        // --- Summary Block ---
        y += 10
        if (y > 250) {
            doc.addPage()
            y = 20
        }

        const drawSummaryRow = (label: string, value: string, isTotal = false) => {
            doc.setFont("helvetica", isTotal ? "bold" : "normal")
            doc.setFontSize(isTotal ? 12 : 9)
            doc.text(label, 140, y)
            doc.text(value, 190, y, { align: "right" })
            y += isTotal ? 10 : 6
        }

        drawSummaryRow("Subtotal:", `PKR ${Number(receiptData.subtotal).toLocaleString()}`)
        drawSummaryRow("Discounts:", `-PKR ${Number(receiptData.discount).toLocaleString()}`)
        drawSummaryRow("Tax & Fees:", `PKR ${Number(receiptData.tax).toLocaleString()}`)
        if (receiptData.deliveryCharges > 0) {
            drawSummaryRow("Delivery:", `PKR ${Number(receiptData.deliveryCharges).toLocaleString()}`)
        }

        doc.setDrawColor(15, 23, 42)
        doc.setLineWidth(1)
        doc.line(140, y - 2, 195, y - 2)
        y += 5
        drawSummaryRow("NET TOTAL:", `PKR ${Number(receiptData.totalAmount).toLocaleString()}`, true)

        // Footer
        doc.setFontSize(7)
        doc.setTextColor(148, 163, 184)
        doc.text(`Official Document - Generated by OneFlowe ERP on ${new Date().toLocaleString()}`, 105, 285, { align: "center" })

        const pdfBuffer = doc.output("arraybuffer")

        return new NextResponse(pdfBuffer, {
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `attachment; filename="invoice-${receiptData.invoiceNumber}.pdf"`,
            },
        })
    } catch (e: any) {
        console.error("Invoice generation error:", e)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
