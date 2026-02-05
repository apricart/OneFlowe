"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Download, FileSpreadsheet, FileIcon as FilePdf } from "lucide-react"
import * as XLSX from "xlsx"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import { formatPKR } from "@/lib/utils"

interface OrderExportProps {
    orders: any[]
    role?: string
}

export function OrderExport({ orders, role }: OrderExportProps) {
    const [isExporting, setIsExporting] = useState(false)

    const formatDataForExcel = () => {
        return orders.map(order => ({
            "Order ID": order.id,
            "Example TID": order.tid,
            "Date": new Date(order.createdAt).toLocaleDateString(),
            "Status": order.status,
            "Organization": order.organizationName || "-",
            "Branch": order.branchName || "-",
            "Items": order.items?.length || "-", // If items are loaded
            "Subtotal": (order.subtotalCents / 100).toFixed(2),
            "Tax": (order.taxCents / 100).toFixed(2),
            "Total": (order.totalCents / 100).toFixed(2),
            "Rejection Reason": order.rejectionReason || "-",
        }))
    }

    const handleExportCSV = () => {
        try {
            setIsExporting(true)
            const data = formatDataForExcel()
            const worksheet = XLSX.utils.json_to_sheet(data)
            const workbook = XLSX.utils.book_new()
            XLSX.utils.book_append_sheet(workbook, worksheet, "Orders")
            XLSX.writeFile(workbook, `orders-export-${new Date().toISOString().split('T')[0]}.csv`)
        } catch (error) {
            console.error("Export failed", error)
        } finally {
            setIsExporting(false)
        }
    }

    const handleExportExcel = () => {
        try {
            setIsExporting(true)
            const data = formatDataForExcel()
            const worksheet = XLSX.utils.json_to_sheet(data)
            const workbook = XLSX.utils.book_new()
            XLSX.utils.book_append_sheet(workbook, worksheet, "Orders")
            XLSX.writeFile(workbook, `orders-export-${new Date().toISOString().split('T')[0]}.xlsx`)
        } catch (error) {
            console.error("Export failed", error)
        } finally {
            setIsExporting(false)
        }
    }

    const handleExportPDF = () => {
        try {
            setIsExporting(true)
            const doc = new jsPDF()

            // Header
            doc.setFontSize(18)
            doc.text("Orders Report", 14, 22)
            doc.setFontSize(10)
            doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 30)
            if (role) doc.text(`Role: ${role}`, 14, 36)

            const tableData = orders.map(order => [
                order.id,
                new Date(order.createdAt).toLocaleDateString(),
                order.organizationName || "-",
                order.branchName || "-",
                order.status,
                formatPKR(order.totalCents / 100),
                order.rejectionReason || "-"
            ])

            autoTable(doc, {
                head: [["ID", "Date", "Org", "Branch", "Status", "Total", "Reason"]],
                body: tableData,
                startY: 44,
                styles: { fontSize: 8 },
                headStyles: { fillColor: [66, 66, 66] },
            })

            doc.save(`orders-export-${new Date().toISOString().split('T')[0]}.pdf`)
        } catch (error) {
            console.error("Export failed", error)
        } finally {
            setIsExporting(false)
        }
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2" disabled={isExporting || orders.length === 0}>
                    <Download className="h-4 w-4" />
                    Export
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleExportCSV}>
                    CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportExcel}>
                    <FileSpreadsheet className="mr-2 h-4 w-4" />
                    Excel
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportPDF}>
                    <FilePdf className="mr-2 h-4 w-4" />
                    PDF
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
