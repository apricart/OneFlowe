
import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { db } from "@/lib/db"
import { orders } from "@/db/schema"
import { eq } from "drizzle-orm"
import { jsPDF } from "jspdf"

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

        // Fetch order with receipt data
        const [order] = await db
            .select()
            .from(orders)
            .where(eq(orders.id, orderId))
            .limit(1)

        if (!order || !order.receiptData) {
            return NextResponse.json(
                { error: "Receipt not found" },
                { status: 404 }
            )
        }

        const receiptData = order.receiptData as any

        // Generate PDF (A4 size: 210mm x 297mm)
        const doc = new jsPDF()

        // Helper for formatting currency
        const formatNum = (num: number, digits = 3) =>
            Number(num).toFixed(digits)

        // 1. Header Section
        doc.setFont("helvetica", "bold")
        doc.setFontSize(22)
        doc.setTextColor(26, 58, 92)
        doc.text("APRICART", 15, 25)

        doc.setFontSize(10)
        doc.setTextColor(71, 85, 105)
        doc.setFont("helvetica", "bold")
        doc.text(`From: ${receiptData.organizationName || "Apricart E-Store Pvt Ltd"}`, 15, 32)

        // 2. Invoice Details (Top Right)
        doc.setTextColor(0, 0, 0)
        doc.setFont("helvetica", "bold")
        doc.setFontSize(9)
        doc.text("INVOICE#:", 140, 25)
        doc.setFont("helvetica", "normal")
        doc.text(String(receiptData.invoiceNumber), 165, 25)

        doc.setFont("helvetica", "bold")
        doc.text("DATE:", 140, 31)
        doc.setFont("helvetica", "normal")
        doc.text(receiptData.date, 165, 31)

        doc.setFont("helvetica", "bold")
        doc.text("Contact No:", 140, 37)
        doc.setFont("helvetica", "normal")
        doc.text(receiptData.organizationContact || "0333-3182410", 165, 37)

        // Buyer Info
        doc.setFont("helvetica", "bold")
        doc.text("BUYER NAME:", 140, 47)
        doc.setFont("helvetica", "normal")
        doc.text(receiptData.buyerName?.toUpperCase() || "", 165, 47)

        doc.setFont("helvetica", "bold")
        doc.text("Deliver to:", 140, 53)
        doc.setFont("helvetica", "normal")
        doc.setFontSize(8)
        const addressLines = doc.splitTextToSize(receiptData.buyerAddress || 'N/A', 40)
        doc.text(addressLines, 165, 53)

        // 3. Invoice Title
        doc.setFontSize(14)
        doc.setFont("helvetica", "bold")
        doc.setTextColor(0, 0, 0)
        doc.text("INVOICE", 105, 75, { align: "center" })
        doc.setLineWidth(0.5)
        doc.line(15, 78, 195, 78)

        // 4. Table Header
        let yPos = 85

        const drawTableHeader = (y: number) => {
            doc.setFontSize(8)
            doc.setFont("helvetica", "bold")
            doc.setTextColor(0, 0, 0)
            doc.setLineWidth(0.2)
            doc.line(15, y - 4, 195, y - 4)
            doc.line(15, y + 2, 195, y + 2)

            doc.text("S.#", 15, y)
            doc.text("CATEGORY", 25, y)
            doc.text("DESCRIPTION", 65, y)
            doc.text("QTY", 135, y, { align: "right" })
            doc.text("RATE", 155, y, { align: "right" })
            doc.text("TAX", 170, y, { align: "right" })
            doc.text("TOTAL", 195, y, { align: "right" })
        }

        // 4. Items Table
        yPos = 85
        drawTableHeader(yPos)
        yPos += 7

        let serial = 1
        receiptData.items.forEach((mainCat: any) => {
            // Main Category Header
            if (yPos > 275) {
                doc.addPage()
                yPos = 20
                drawTableHeader(yPos)
                yPos += 7
            }

            doc.setFillColor(250, 250, 250)
            doc.rect(15, yPos - 4, 180, 5, "F")
            doc.setFont("helvetica", "bold")
            doc.setFontSize(7)
            doc.setTextColor(51, 65, 85)
            doc.text((mainCat.mainCategoryName || mainCat.categoryName)?.toUpperCase(), 17, yPos - 0.5)
            yPos += 4

            const subCats = mainCat.subCategories || [{ subCategoryName: "", items: mainCat.items, subtotal: mainCat.subtotal }]

            subCats.forEach((subCat: any) => {
                if (subCat.subCategoryName) {
                    doc.setFont("helvetica", "boldoblique")
                    doc.setFontSize(6.5)
                    doc.setTextColor(148, 163, 184)
                    doc.text(subCat.subCategoryName, 22, yPos)
                    yPos += 3.5
                }

                subCat.items.forEach((item: any, idx: number) => {
                    if (yPos > 275) {
                        doc.addPage()
                        yPos = 20
                        drawTableHeader(yPos)
                        yPos += 7
                    }

                    doc.setFontSize(8)
                    doc.setFont("helvetica", "normal")
                    doc.setTextColor(30, 41, 59)

                    doc.text(String(serial++), 15, yPos)

                    const descLines = doc.splitTextToSize(item.description || '', 65)
                    doc.text(descLines, 65, yPos)

                    doc.text(String(item.quantity), 135, yPos, { align: "right" })
                    doc.text(formatNum(item.rate), 155, yPos, { align: "right" })
                    doc.text(formatNum(item.tax || 0, 1), 170, yPos, { align: "right" })
                    doc.setFont("helvetica", "bold")
                    doc.text(formatNum(item.total), 195, yPos, { align: "right" })

                    yPos += Math.max(descLines.length * 3.5, 5)
                })

                // Sub Category Subtotal
                doc.setFont("helvetica", "bold")
                doc.setFontSize(6.5)
                doc.setTextColor(100, 116, 139)
                doc.text(`Sub ${subCat.subCategoryName || mainCat.categoryName}: ${formatNum(subCat.subtotal)}`, 195, yPos, { align: "right" })
                yPos += 1.5
                doc.setLineWidth(0.1)
                doc.setDrawColor(241, 245, 249)
                doc.line(22, yPos, 195, yPos)
                yPos += 4.5
            })

            // Main Category Total
            doc.setFont("helvetica", "bold")
            doc.setFontSize(8)
            doc.setTextColor(15, 23, 42)
            doc.text(`TOTAL ${(mainCat.mainCategoryName || mainCat.categoryName)?.toUpperCase()}: ${formatNum(mainCat.total ?? mainCat.subtotal ?? 0)}`, 195, yPos, { align: "right" })
            yPos += 1.5
            doc.setLineWidth(0.2)
            doc.setDrawColor(226, 232, 240)
            doc.line(15, yPos, 195, yPos)
            yPos += 6
        })

        // 5. Totals Section
        yPos += 6
        if (yPos > 250) {
            doc.addPage()
            yPos = 20
        }

        const totalsX = 140
        const valuesX = 195

        doc.setFontSize(8.5)
        doc.setTextColor(51, 65, 85)

        const drawTotalRow = (label: string, value: number, isBold = false) => {
            doc.setFont("helvetica", isBold ? "bold" : "normal")
            doc.text(label, totalsX, yPos)
            doc.text(formatNum(value), valuesX, yPos, { align: "right" })
            yPos += 5
        }

        drawTotalRow("SubTotal", receiptData.subtotal)
        drawTotalRow("Discount", receiptData.discount)
        drawTotalRow("Tax", receiptData.tax)
        drawTotalRow("Delivery Charges", receiptData.deliveryCharges)

        if (receiptData.refund > 0) {
            doc.setTextColor(220, 38, 38)
            drawTotalRow("**Refund", receiptData.refund)
        }

        yPos += 4
        doc.setFontSize(10)
        doc.setFont("helvetica", "bold")
        doc.text("Total Amount", 140, yPos, { align: "right" })
        doc.setFontSize(14)
        doc.text(`PKR ${formatNum(receiptData.totalAmount)}`, 195, yPos, { align: "right" })

        // 6. Final Footer
        yPos = 275
        doc.setFontSize(9)
        doc.setFont("helvetica", "bold")
        doc.text("Thanks for your business.", 15, yPos)

        doc.setFontSize(7)
        doc.setTextColor(150, 150, 150)
        doc.text("Powered by Apricart Solutions", 15, yPos + 10)

        doc.setFontSize(8)
        doc.setTextColor(100, 100, 100)
        doc.line(160, yPos + 8, 195, yPos + 8)
        doc.text("Authorized Sign", 177, yPos + 12, { align: "center" })

        // Generate PDF buffer
        const pdfBuffer = doc.output("arraybuffer")

        // Return PDF as downloadable file
        return new NextResponse(pdfBuffer, {
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `attachment; filename="receipt-${receiptData.invoiceNumber}.pdf"`,
            },
        })
    } catch (e: any) {
        console.error("PDF generation error:", e)
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
        )
    }
}
