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

        // Custom colors
        const colors = {
            primary: [15, 23, 42], // slate-900
            secondary: [100, 116, 139], // slate-500
            light: [248, 250, 252], // slate-50
            border: [226, 232, 240], // slate-200
            accent: [37, 99, 235], // blue-600
        }

        // --- Top Accent Bar ---
        doc.setFillColor(colors.primary[0], colors.primary[1], colors.primary[2])
        doc.rect(0, 0, 210, 8, "F")

        // --- Header Section ---
        try {
            const logoPath = path.join(process.cwd(), "public", "logo-pos.png")
            if (fs.existsSync(logoPath)) {
                const logoData = fs.readFileSync(logoPath).toString("base64")
                doc.addImage(`data:image/png;base64,${logoData}`, "PNG", 20, 20, 50, 14, undefined, 'FAST')
            } else {
                doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2])
                doc.setFont("helvetica", "bold")
                doc.setFontSize(24)
                doc.text("ONEFLOWE", 20, 30)
            }
        } catch (e) {
            doc.setFontSize(24)
            doc.text("ONEFLOWE", 20, 30)
        }

        // From Address
        doc.setTextColor(colors.secondary[0], colors.secondary[1], colors.secondary[2])
        doc.setFont("helvetica", "bold")
        doc.setFontSize(9)
        doc.text("FROM:", 20, 45)
        doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2])
        doc.text(receiptData.organizationName || "Apricart E-Store Pvt Ltd", 20, 50)
        doc.setFont("helvetica", "normal")
        doc.text(receiptData.organizationContact || "0333-3182410", 20, 55)

        // Right side: Invoice Meta
        doc.setFont("helvetica", "bold")
        doc.setFontSize(22)
        doc.text("INVOICE", 190, 32, { align: "right" })

        doc.setFontSize(10)
        doc.text(`#${receiptData.invoiceNumber}`, 190, 38, { align: "right" })

        doc.setFontSize(9)
        doc.setTextColor(colors.secondary[0], colors.secondary[1], colors.secondary[2])
        doc.text("DATE:", 155, 48)
        doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2])
        doc.text(receiptData.date, 190, 48, { align: "right" })

        // --- Billed To Box ---
        doc.setFillColor(colors.light[0], colors.light[1], colors.light[2])
        doc.setDrawColor(colors.border[0], colors.border[1], colors.border[2])
        doc.roundedRect(20, 65, 170, 35, 2, 2, "FD")

        doc.setFont("helvetica", "bold")
        doc.setFontSize(9)
        doc.setTextColor(colors.secondary[0], colors.secondary[1], colors.secondary[2])
        doc.text("BILLED TO:", 25, 75)

        doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2])
        doc.setFontSize(11)
        doc.text(String(receiptData.buyerName).toUpperCase(), 25, 83)
        doc.setFont("helvetica", "normal")
        doc.setFontSize(9)
        if (receiptData.buyerPhone) doc.text(`Phone: ${receiptData.buyerPhone}`, 25, 89)

        doc.setFont("helvetica", "bold")
        doc.setTextColor(colors.secondary[0], colors.secondary[1], colors.secondary[2])
        doc.text("DELIVER TO:", 100, 75)
        doc.setFont("helvetica", "normal")
        doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2])
        const addrLines = doc.splitTextToSize(receiptData.buyerAddress || '—', 85)
        doc.text(addrLines, 100, 83)

        // --- Items Table ---
        let y = 110

        // Table Header
        doc.setFillColor(colors.primary[0], colors.primary[1], colors.primary[2])
        doc.rect(20, y, 170, 10, "F")
        doc.setTextColor(255, 255, 255)
        doc.setFont("helvetica", "bold")
        doc.setFontSize(9)
        doc.text("#", 25, y + 7)
        doc.text("DESCRIPTION", 40, y + 7)
        doc.text("PRICE", 130, y + 7, { align: "right" })
        doc.text("QTY", 155, y + 7, { align: "right" })
        doc.text("TOTAL", 185, y + 7, { align: "right" })

        y += 15

        // Table Body
        let counter = 0
        receiptData.items?.forEach((cat: any) => {
            if (y > 260) { doc.addPage(); y = 20; }

            // Category Row
            doc.setFillColor(colors.light[0], colors.light[1], colors.light[2])
            doc.rect(20, y - 5, 170, 7, "F")
            doc.setTextColor(colors.secondary[0], colors.secondary[1], colors.secondary[2])
            doc.setFont("helvetica", "bold")
            doc.setFontSize(8)
            doc.text((cat.mainCategoryName || cat.categoryName || "ITEMS")?.toUpperCase(), 25, y)
            y += 7

            const subCats = cat.subCategories || [{ items: cat.items }]
            subCats.forEach((sub: any) => {
                if (sub.subCategoryName) {
                    if (y > 260) { doc.addPage(); y = 20; }
                    doc.setTextColor(colors.secondary[0], colors.secondary[1], colors.secondary[2])
                    doc.setFont("helvetica", "bold")
                    doc.setFontSize(8)
                    doc.text(`> ${sub.subCategoryName}`, 30, y)
                    y += 6
                }

                sub.items?.forEach((item: any) => {
                    if (y > 260) { doc.addPage(); y = 20; }
                    counter++
                    doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2])

                    // S#
                    doc.setFont("helvetica", "normal")
                    doc.text(String(counter), 25, y)

                    // Description (truncate nicely)
                    const desc = item.description?.substring(0, 50) + (item.description?.length > 50 ? "..." : "") || ""
                    doc.text(desc, 40, y)

                    doc.text(Number(item.rate).toLocaleString(), 130, y, { align: "right" })
                    doc.text(String(item.quantity), 155, y, { align: "right" })

                    doc.setFont("helvetica", "bold")
                    doc.text(Number(item.total).toLocaleString(), 185, y, { align: "right" })

                    // Line separator
                    doc.setDrawColor(241, 245, 249)
                    doc.setLineWidth(0.5)
                    doc.line(20, y + 2, 190, y + 2)
                    y += 8
                })
            })
            y += 4
        })

        // --- Summary Block ---
        y += 5
        if (y > 220) { doc.addPage(); y = 20; }

        const drawSummaryRow = (label: string, value: string, isTotal = false) => {
            doc.setFont("helvetica", isTotal ? "bold" : "normal")
            doc.setFontSize(isTotal ? 14 : 10)
            doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2])
            doc.text(label, 130, y)
            doc.text(value, 185, y, { align: "right" })
            y += isTotal ? 12 : 7
        }

        drawSummaryRow("Subtotal:", `PKR ${Number(receiptData.subtotal).toLocaleString()}`)
        drawSummaryRow("Tax & Fees:", `PKR ${Number(receiptData.tax).toLocaleString()}`)

        if (Number(receiptData.discount) > 0) {
            doc.setTextColor(239, 68, 68) // red-500
            doc.setFont("helvetica", "normal")
            doc.text("Discounts:", 130, y)
            doc.text(`-PKR ${Number(receiptData.discount).toLocaleString()}`, 185, y, { align: "right" })
            y += 7
        }

        if (receiptData.deliveryCharges > 0) {
            doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2])
            drawSummaryRow("Delivery:", `PKR ${Number(receiptData.deliveryCharges).toLocaleString()}`)
        }

        // Total Box
        y += 2
        doc.setFillColor(colors.primary[0], colors.primary[1], colors.primary[2])
        doc.roundedRect(120, y - 6, 70, 14, 2, 2, "F")
        doc.setTextColor(255, 255, 255)
        doc.setFont("helvetica", "bold")
        doc.setFontSize(10)
        doc.text("TOTAL PAYABLE", 125, y + 2)
        doc.setFontSize(14)
        doc.text(`PKR ${Number(receiptData.totalAmount).toLocaleString()}`, 185, y + 2, { align: "right" })

        // --- Footer ---
        doc.setFontSize(8)
        doc.setTextColor(colors.secondary[0], colors.secondary[1], colors.secondary[2])

        doc.text("Generated by OneFlowe ERP System", 105, 285, { align: "center" })
        doc.text(`Printed on: ${new Date().toLocaleString()}`, 105, 289, { align: "center" })

        // Signatures
        doc.setDrawColor(colors.secondary[0], colors.secondary[1], colors.secondary[2])
        doc.line(30, 275, 70, 275)
        doc.text("Authorized Signature", 50, 280, { align: "center" })

        doc.line(140, 275, 180, 275)
        doc.text("Accountant", 160, 280, { align: "center" })

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
