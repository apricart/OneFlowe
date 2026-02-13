"use client"

import React, { useState } from "react"
import { Button } from "@/components/ui/button"
import { Download, X, Printer, FileText } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import useSWR from "swr"
import Image from "next/image"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

interface ReceiptContentProps {
    orderId: number
    standalone?: boolean
    onClose?: () => void
}

export function ReceiptContent({ orderId, standalone = false, onClose }: ReceiptContentProps) {
    const { toast } = useToast()
    const [isDownloading, setIsDownloading] = useState(false)

    const { data, error, isLoading } = useSWR(
        `/api/v1/receipts/${orderId}`,
        fetcher
    )

    const handleDownload = async () => {
        setIsDownloading(true)
        try {
            const response = await fetch(`/api/v1/receipts/${orderId}/download`)
            if (!response.ok) throw new Error("Failed to download receipt")

            const blob = await response.blob()
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement("a")
            a.href = url
            a.download = `receipt-${data?.receiptData?.invoiceNumber || orderId}.pdf`
            document.body.appendChild(a)
            a.click()
            window.URL.revokeObjectURL(url)
            document.body.removeChild(a)

            toast({ title: "Success", description: "Receipt downloaded successfully" })
        } catch (error: any) {
            toast({
                title: "Error",
                description: error.message || "Failed to download receipt",
                variant: "destructive",
            })
        } finally {
            setIsDownloading(false)
        }
    }

    const handlePrint = () => {
        window.print()
    }

    const receiptData = data?.receiptData
    const refundHistory = data?.refundHistory || []

    let serialCounter = 0

    return (
        <div className={`bg-slate-50 ${standalone ? 'min-h-screen py-8 px-4' : 'p-4'}`}>
            {/* Professional Styles */}
            {/* Font preload links */}
            <link rel="preconnect" href="https://fonts.googleapis.com" />
            <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />
            <style dangerouslySetInnerHTML={{
                __html: `
                .receipt-paper {
                    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    color: #0f172a;
                    background: #ffffff;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 10px 40px rgba(0,0,0,0.04);
                    border-radius: 6px;
                    overflow: hidden;
                }
                .receipt-accent-bar {
                    height: 3px;
                    background: linear-gradient(90deg, #0f172a 0%, #334155 40%, #94a3b8 100%);
                }
                .receipt-table th {
                    font-size: 9px;
                    font-weight: 600;
                    letter-spacing: 0.08em;
                    text-transform: uppercase;
                    color: #64748b;
                    padding: 8px 6px;
                    border-bottom: 1.5px solid #e2e8f0;
                    white-space: nowrap;
                }
                .receipt-table td {
                    font-size: 11px;
                    padding: 5px 6px;
                    vertical-align: middle;
                }
                .receipt-table .item-row { border-bottom: 1px solid #f8fafc; }
                .receipt-table .item-row:hover { background: #fafbfc; }
                .receipt-table .cat-header td {
                    font-size: 9px;
                    font-weight: 700;
                    letter-spacing: 0.1em;
                    text-transform: uppercase;
                    color: #475569;
                    padding: 7px 6px 5px;
                    background: #f8fafc;
                    border-top: 1px solid #e2e8f0;
                    border-bottom: 1px solid #f1f5f9;
                }
                .receipt-table .subcat-header td {
                    font-size: 8.5px;
                    font-weight: 600;
                    letter-spacing: 0.06em;
                    text-transform: uppercase;
                    color: #94a3b8;
                    padding: 4px 6px 3px 16px;
                }
                .receipt-table .subtotal-row td {
                    font-size: 9px;
                    font-weight: 600;
                    color: #64748b;
                    padding: 3px 6px;
                    border-bottom: 1px solid #f1f5f9;
                }
                .receipt-table .cat-total-row td {
                    font-size: 10px;
                    font-weight: 700;
                    color: #0f172a;
                    padding: 6px 6px;
                    background: #f8fafc;
                    border-top: 1px solid #e2e8f0;
                    border-bottom: 1.5px solid #e2e8f0;
                }
                @media print {
                    .print-hidden { display: none !important; }
                    body { background: white !important; margin: 0 !important; padding: 0 !important; }
                    .receipt-paper { box-shadow: none !important; border-radius: 0 !important; }
                    .receipt-outer { padding: 0 !important; background: white !important; min-height: auto !important; }
                }
            ` }} />

            {/* Floating Action Bar */}
            {standalone && (
                <div className="fixed top-4 right-4 flex gap-2 print-hidden z-50">
                    <Button
                        onClick={handlePrint}
                        disabled={!receiptData}
                        variant="outline"
                        size="sm"
                        className="shadow-lg bg-white/90 backdrop-blur-sm border-slate-200 hover:bg-white gap-1.5 h-9 text-xs font-semibold"
                    >
                        <Printer className="h-3.5 w-3.5" />
                        Print
                    </Button>
                    <Button
                        onClick={handleDownload}
                        disabled={isDownloading || !receiptData}
                        size="sm"
                        className="shadow-lg bg-slate-900 hover:bg-slate-800 text-white gap-1.5 h-9 text-xs font-semibold"
                    >
                        <Download className="h-3.5 w-3.5" />
                        {isDownloading ? "Downloading..." : "Download PDF"}
                    </Button>
                </div>
            )}

            {/* Inline Action Bar (non-standalone) */}
            {!standalone && (
                <div className="flex items-center justify-end gap-2 mb-4 print-hidden">
                    <Button
                        onClick={handlePrint}
                        disabled={!receiptData}
                        size="sm"
                        variant="outline"
                        className="gap-1.5 h-8 text-xs font-medium"
                    >
                        <Printer className="h-3.5 w-3.5" />
                        Print
                    </Button>
                    <Button
                        onClick={handleDownload}
                        disabled={isDownloading || !receiptData}
                        size="sm"
                        className="bg-slate-900 hover:bg-slate-800 text-white gap-1.5 h-8 text-xs font-medium"
                    >
                        <Download className="h-3.5 w-3.5" />
                        {isDownloading ? "..." : "PDF"}
                    </Button>
                    {onClose && (
                        <Button
                            onClick={onClose}
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-slate-400 hover:text-slate-600"
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    )}
                </div>
            )}

            {/* Loading State */}
            {isLoading && (
                <div className="flex flex-col items-center justify-center py-24">
                    <div className="relative">
                        <div className="h-10 w-10 rounded-full border-2 border-slate-100" />
                        <div className="absolute inset-0 h-10 w-10 animate-spin rounded-full border-2 border-transparent border-t-slate-800" />
                    </div>
                    <p className="text-xs text-slate-400 mt-4 font-medium tracking-wide">Loading receipt...</p>
                </div>
            )}

            {/* Error State */}
            {error && (
                <div className="flex flex-col items-center justify-center py-24">
                    <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mb-3">
                        <X className="h-5 w-5 text-red-400" />
                    </div>
                    <p className="text-sm text-slate-600 font-medium">Receipt Not Available</p>
                    <p className="text-xs text-slate-400 mt-1">This receipt may not exist or could not be loaded.</p>
                </div>
            )}

            {/* Receipt Paper */}
            {receiptData && (
                <div className={`receipt-paper max-w-[820px] mx-auto receipt-outer ${standalone ? '' : ''}`}>
                    {/* Top Accent Bar */}
                    <div className="receipt-accent-bar" />

                    <div className="p-6 sm:p-8">
                        {/* ─── Header ─── */}
                        <div className="flex justify-between items-start">
                            <div>
                                <Image
                                    src="/logo-web.png"
                                    alt="Apricart Logo"
                                    width={130}
                                    height={38}
                                    className="mb-3 grayscale opacity-90"
                                />
                                <p className="text-[9px] uppercase tracking-[0.15em] text-slate-400 font-semibold mb-0.5">From</p>
                                <p className="text-[11px] font-semibold text-slate-800">{receiptData.organizationName || "Apricart E-Store Pvt Ltd"}</p>
                            </div>

                            <div className="text-right">
                                <div className="inline-flex items-center gap-1.5 bg-slate-50 rounded px-2.5 py-1 mb-2">
                                    <FileText className="h-3 w-3 text-slate-400" />
                                    <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Invoice</span>
                                </div>
                                <div className="space-y-0.5">
                                    <p className="text-[11px] text-slate-500">
                                        <span className="font-medium text-slate-400 mr-1">No.</span>
                                        <span className="font-bold text-slate-800 tracking-tight">{receiptData.invoiceNumber}</span>
                                    </p>
                                    <p className="text-[11px] text-slate-500">
                                        <span className="font-medium text-slate-400 mr-1">Date</span>
                                        <span className="font-semibold text-slate-700">{receiptData.date}</span>
                                    </p>
                                    <p className="text-[11px] text-slate-500">
                                        <span className="font-medium text-slate-400 mr-1">Ph.</span>
                                        <span className="font-medium text-slate-600">{receiptData.organizationContact || "0333-3182410"}</span>
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* ─── Billing / Shipping ─── */}
                        <div className="grid grid-cols-2 gap-6 mt-5 mb-5 py-3.5 border-y border-slate-100">
                            <div>
                                <p className="text-[9px] uppercase tracking-[0.15em] text-slate-400 font-semibold mb-1">Billed To</p>
                                <p className="text-[12px] font-bold text-slate-900 uppercase tracking-wide">{receiptData.buyerName}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-[9px] uppercase tracking-[0.15em] text-slate-400 font-semibold mb-1">Ship To</p>
                                <p className="text-[11px] leading-relaxed text-slate-600 max-w-[240px] ml-auto">{receiptData.buyerAddress || "—"}</p>
                            </div>
                        </div>

                        {/* ─── Invoice Title ─── */}
                        <div className="text-center mb-5">
                            <h2 className="text-[11px] font-bold uppercase tracking-[0.5em] text-slate-300">Official Invoice</h2>
                        </div>

                        {/* ─── Items Table ─── */}
                        <div className="mb-6">
                            <table className="receipt-table w-full border-collapse">
                                <thead>
                                    <tr>
                                        <th className="text-left w-8 pl-1">#</th>
                                        <th className="text-left w-40">Category</th>
                                        <th className="text-left">Description</th>
                                        <th className="text-right w-10">Qty</th>
                                        <th className="text-right w-20">Rate</th>
                                        <th className="text-right w-14">Tax</th>
                                        <th className="text-right w-24 pr-1">Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {receiptData.items.map((mainCat: any, mainIndex: number) => (
                                        <React.Fragment key={mainIndex}>
                                            {/* Main Category Header */}
                                            <tr className="cat-header">
                                                <td colSpan={7}>
                                                    {mainCat.mainCategoryName || mainCat.categoryName}
                                                </td>
                                            </tr>

                                            {(mainCat.subCategories || [{ subCategoryName: "", items: mainCat.items, subtotal: mainCat.subtotal }]).map((subCat: any, subIndex: number) => (
                                                <React.Fragment key={`${mainIndex}-${subIndex}`}>
                                                    {subCat.subCategoryName && (
                                                        <tr className="subcat-header">
                                                            <td colSpan={7}>
                                                                ▸ {subCat.subCategoryName}
                                                            </td>
                                                        </tr>
                                                    )}
                                                    {subCat.items.map((item: any, itemIndex: number) => {
                                                        serialCounter++
                                                        return (
                                                            <tr key={`${mainIndex}-${subIndex}-${itemIndex}`} className="item-row">
                                                                <td className="text-slate-400 pl-1 font-medium">{serialCounter}</td>
                                                                <td className="text-slate-300 font-medium text-[10px]">
                                                                    {itemIndex === 0 ? (subCat.subCategoryName || "") : ""}
                                                                </td>
                                                                <td className="text-slate-800 font-medium">{item.description}</td>
                                                                <td className="text-right text-slate-700">{item.quantity}</td>
                                                                <td className="text-right text-slate-700 tabular-nums">{Number(item.rate).toFixed(3)}</td>
                                                                <td className="text-right text-slate-400 tabular-nums">{Number(item.tax || 0).toFixed(1)}</td>
                                                                <td className="text-right font-semibold text-slate-900 pr-1 tabular-nums">{Number(item.total).toFixed(3)}</td>
                                                            </tr>
                                                        )
                                                    })}
                                                    {/* Subcategory Subtotal */}
                                                    <tr className="subtotal-row">
                                                        <td colSpan={7} className="text-right pr-1">
                                                            <span className="tracking-wider">
                                                                Sub {subCat.subCategoryName || mainCat.categoryName}:
                                                            </span>
                                                            <span className="ml-2 tabular-nums font-bold">{Number(subCat.subtotal).toFixed(3)}</span>
                                                        </td>
                                                    </tr>
                                                </React.Fragment>
                                            ))}
                                            {/* Main Category Total */}
                                            <tr className="cat-total-row">
                                                <td colSpan={7} className="text-right pr-1">
                                                    <span className="tracking-wider text-[9px]">TOTAL {(mainCat.mainCategoryName || mainCat.categoryName)?.toUpperCase()}:</span>
                                                    <span className="ml-2 tabular-nums text-[11px]">{Number(mainCat.total ?? mainCat.subtotal ?? 0).toFixed(3)}</span>
                                                </td>
                                            </tr>
                                        </React.Fragment>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* ─── Summary ─── */}
                        <div className="flex justify-end">
                            <div className="w-64">
                                <div className="space-y-1.5">
                                    <div className="flex justify-between text-[11px]">
                                        <span className="text-slate-400 font-medium">Subtotal</span>
                                        <span className="font-semibold text-slate-700 tabular-nums">{Number(receiptData.subtotal).toFixed(3)}</span>
                                    </div>
                                    <div className="flex justify-between text-[11px]">
                                        <span className="text-slate-400 font-medium">Discount</span>
                                        <span className="font-semibold text-slate-700 tabular-nums">{Number(receiptData.discount).toFixed(3)}</span>
                                    </div>
                                    <div className="flex justify-between text-[11px]">
                                        <span className="text-slate-400 font-medium">Tax</span>
                                        <span className="font-semibold text-slate-700 tabular-nums">{Number(receiptData.tax).toFixed(3)}</span>
                                    </div>
                                    <div className="flex justify-between text-[11px]">
                                        <span className="text-slate-400 font-medium">Delivery</span>
                                        <span className="font-semibold text-slate-700 tabular-nums">{Number(receiptData.deliveryCharges).toFixed(3)}</span>
                                    </div>

                                    {receiptData.refund > 0 && (
                                        <div className="flex justify-between text-[11px] text-red-500 pt-1 border-t border-dashed border-slate-200">
                                            <span className="font-semibold">Refund</span>
                                            <span className="font-bold tabular-nums">−{Number(receiptData.refund).toFixed(3)}</span>
                                        </div>
                                    )}
                                </div>

                                {/* Total Payable - highlighted */}
                                <div className="mt-3 pt-3 border-t-2 border-slate-800">
                                    <div className="flex justify-between items-baseline">
                                        <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">Total Payable</span>
                                        <span className="text-[17px] font-black text-slate-900 tabular-nums tracking-tight">
                                            PKR {Number(receiptData.totalAmount).toFixed(3)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* ─── Footer ─── */}
                        <div className="mt-10 pt-4 border-t border-slate-100">
                            <div className="flex items-start gap-1 mb-1">
                                <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-400">Note</span>
                            </div>
                            <p className="text-[10px] text-slate-400 leading-relaxed">
                                This is an electronically generated invoice and does not require a physical signature.
                            </p>

                            <div className="flex justify-between items-end mt-8">
                                <p className="text-[9px] text-slate-300 font-medium">Powered by Apricart Solutions</p>
                                <div className="text-center">
                                    <div className="w-36 border-t border-slate-300 mb-1" />
                                    <p className="text-[8px] uppercase font-bold tracking-[0.15em] text-slate-400">Authorized Signatory</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Bottom Accent Bar */}
                    <div className="h-[2px] bg-gradient-to-r from-slate-200 via-slate-300 to-slate-200" />
                </div>
            )}

            {/* Close Button */}
            {onClose && (
                <div className="mt-6 flex justify-center print-hidden">
                    <Button
                        onClick={onClose}
                        variant="outline"
                        className="text-xs font-semibold px-8 h-9 shadow-sm"
                    >
                        Close Receipt
                    </Button>
                </div>
            )}
        </div>
    )
}
