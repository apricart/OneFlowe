"use client"

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import useSWR from "swr"
import { format } from "date-fns"
import { useAppContext } from "@/components/context/app-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
    Loader2, RefreshCw, Search, FileText, FileSpreadsheet, FileIcon as FilePdf, Download, LineChart, Package, Tags, AlertOctagon, TrendingUp, History, Layers, Calculator, ChevronDown, Check, ArrowUpRight, ArrowDownRight, ChartBar as ChartBarIcon, ShieldCheck, ShieldX, Eye, Building2, Filter, RotateCcw, X, LayoutGrid, LayoutDashboard, Database
} from "lucide-react"
import {
    ComposedChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell
} from "recharts"
import * as XLSX from "xlsx"
import { formatPKR, cn } from "@/lib/utils"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import { Badge } from "@/components/ui/badge"
import { Role } from "@/lib/rbac"
import { useSession } from "next-auth/react"
import { Input } from "@/components/ui/input"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

import { GlobalDateFilter, type FilterPreset } from "@/components/dashboard/global-date-filter"
import { BranchFilter } from "@/components/reports/branch-filter"
import { GroupFilter } from "@/components/reports/group-filter"
import { MultiSelectFilter } from "@/components/reports/multi-select-filter"
import { useBranches, useGlobalProducts, useOrganizations } from "@/lib/hooks/use-api"

import { ExpandableRowDrawer, type DetailField } from "@/components/reports/expandable-row-drawer"
import { ColumnSelector, useColumnSelector, type ColumnDef } from "@/components/reports/column-selector"
import { ProductFilter } from "@/components/reports/product-filter"
import { OrganizationFilter } from "@/components/reports/organization-filter"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

const CHART_COLORS = ['#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd', '#818cf8', '#7c3aed', '#4f46e5', '#4338ca', '#6d28d9', '#5b21b6']

const LEDGER_COLUMNS: ColumnDef[] = [
    { key: "date", label: "Date", defaultVisible: true },
    { key: "item", label: "Item / SKU", defaultVisible: true },
    { key: "branch", label: "Branch Context", defaultVisible: true },
    { key: "qty", label: "Qty", defaultVisible: true },
    { key: "unit_price", label: "Unit Price", defaultVisible: true },
    { key: "total", label: "Net Total", defaultVisible: true },
    { key: "tid", label: "Trans ID", defaultVisible: true },
    { key: "status", label: "Status", defaultVisible: true },
]

export default function ProductPerformancePage() {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const { visibleKeys, isVisible, setVisibleKeys } = useColumnSelector(LEDGER_COLUMNS, "product-intelligence-ledger")

    const {
        organizationId,
        branchId: contextBranchId,
        branchIds: contextBranchIds,
        setBranchIds: setContextBranchIds
    } = useAppContext()

    const [searchTerm, setSearchTerm] = useState("")
    const [reportSearchTerm, setReportSearchTerm] = useState("")
    const [generatedDate, setGeneratedDate] = useState("")
    const [selectedRow, setSelectedRow] = useState<any>(null)
    const [drawerOpen, setDrawerOpen] = useState(false)
    const tabFromUrl = (searchParams.get("tab") as "analytics" | "reports") || "analytics"
    const [activeTab, setActiveTab] = useState<"analytics" | "reports">(tabFromUrl)

    useEffect(() => {
        if (tabFromUrl !== activeTab) {
            setActiveTab(tabFromUrl)
        }
    }, [tabFromUrl])
    const [expandedRow, setExpandedRow] = useState<string | null>(null)

    const { data: session } = useSession()
    const role = (session?.user as any)?.role as Role
    const [hasMounted, setHasMounted] = useState(false)

    // URL States for filtering
    const presetFromUrl = (searchParams.get("preset") as FilterPreset) || "all"
    const startFromUrl = searchParams.get("startDate") || ""
    const endFromUrl = searchParams.get("endDate") || ""
    const compareFromUrl = searchParams.get("compare") === "true"

    const [compare, setCompare] = useState(compareFromUrl)
    const [compareRange, setCompareRange] = useState<{ startDate: Date; endDate: Date } | null>(null)
    
    // Multi-select month/year states
    const [selectedMonths, setSelectedMonths] = useState<number[]>(
        searchParams.get("months")?.split(",").map(Number).filter(n => !isNaN(n)) || []
    )
    const [selectedYears, setSelectedYears] = useState<number[]>(
        searchParams.get("years")?.split(",").map(Number).filter(n => !isNaN(n)) || []
    )
    const [compareMonths, setCompareMonths] = useState<number[]>(
        searchParams.get("compareMonths")?.split(",").map(Number).filter(n => !isNaN(n)) || []
    )
    const [compareYears, setCompareYears] = useState<number[]>(
        searchParams.get("compareYears")?.split(",").map(Number).filter(n => !isNaN(n)) || []
    )

    // Chart-local filters
    const [chartYears, setChartYears] = useState<number[]>([])
    const [chartMonths, setChartMonths] = useState<number[]>([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
    const [chartBranchIds, setChartBranchIds] = useState<string[]>([])
    const [chartGroupIds, setChartGroupIds] = useState<string[]>([])
    const [chartOrgIds, setChartOrgIds] = useState<string[]>([])
    const [chartProductIds, setChartProductIds] = useState<string[]>([])
    const [globalGroupId, setGlobalGroupId] = useState<string>("")
    const hasInitializedChartDefaults = useRef(false)

    // Report-local filters
    const [reportYears, setReportYears] = useState<number[]>([])
    const [reportMonths, setReportMonths] = useState<number[]>([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
    const [reportBranchIds, setReportBranchIds] = useState<string[]>([])
    const [reportGroupIds, setReportGroupIds] = useState<string[]>([])
    const [reportProductIds, setReportProductIds] = useState<string[]>([])
    const [reportOrganizationIds, setReportOrganizationIds] = useState<string[]>([])

    // ━━━ CASCADING SELECTION CLEARING ━━━
    useEffect(() => {
        setChartProductIds([])
        setChartBranchIds([])
        setChartGroupIds([])
        setChartOrgIds([])
        setReportProductIds([])
        setReportBranchIds([])
        setReportGroupIds([])
        setReportOrganizationIds([])
    }, [organizationId])

    useEffect(() => {
        setChartProductIds([])
        setChartBranchIds([])
        setChartGroupIds([])
    }, [chartOrgIds])

    useEffect(() => {
        setChartProductIds([])
        setChartBranchIds([])
    }, [chartGroupIds])

    useEffect(() => {
        setChartProductIds([])
    }, [chartBranchIds])

    useEffect(() => {
        setReportProductIds([])
        setReportBranchIds([])
        setReportGroupIds([])
    }, [reportOrganizationIds])

    useEffect(() => {
        setReportProductIds([])
        setReportBranchIds([])
    }, [reportGroupIds])

    useEffect(() => {
        setReportProductIds([])
    }, [reportBranchIds])

    const CHART_MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

    const toggleChartYear = (year: number) => setChartYears(prev => prev.includes(year) ? prev.filter(y => y !== year) : [...prev, year])
    const toggleChartMonth = (month: number) => setChartMonths(prev => prev.includes(month) ? prev.filter(m => m !== month) : [...prev, month])
    const toggleChartBranch = (branchId: string) => setChartBranchIds(prev => prev.includes(branchId) ? prev.filter(b => b !== branchId) : [...prev, branchId])
    const toggleChartGroup = (groupId: string) => setChartGroupIds(prev => prev.includes(groupId) ? prev.filter(g => g !== groupId) : [...prev, groupId])
    
    const toggleReportYear = (year: number) => setReportYears(prev => prev.includes(year) ? prev.filter(y => y !== year) : [...prev, year])
    const toggleReportMonth = (month: number) => setReportMonths(prev => prev.includes(month) ? prev.filter(m => m !== month) : [...prev, month])
    const toggleReportBranch = (branchId: string) => setReportBranchIds(prev => prev.includes(branchId) ? prev.filter(b => b !== branchId) : [...prev, branchId])
    const toggleReportGroup = (groupId: string) => setReportGroupIds(prev => prev.includes(groupId) ? prev.filter(g => g !== groupId) : [...prev, groupId])

    // ━━━ DATA FOR DYNAMIC FILTERS (All-Time) ━━━
    const allTimeQueryParams = new URLSearchParams()
    if (organizationId) allTimeQueryParams.set("organizationId", organizationId.toString())
    allTimeQueryParams.set("preset", "all")
    const { data: allTimeData } = useSWR<any>(`/api/v1/analytics/products/performance?${allTimeQueryParams.toString()}`, fetcher)
    
    const { data: groupsData } = useSWR( organizationId ? `/api/v1/groups?organizationId=${organizationId}` : "/api/v1/groups", fetcher )
    const availableGroups = groupsData?.groups || []
    const { data: branchesData } = useSWR( organizationId ? `/api/v1/branches?organizationId=${organizationId}` : "/api/v1/branches", fetcher )
    const availableBranches = branchesData?.items || []
    
    // Organizations for filter display names
    const { data: orgsData } = useOrganizations()
    const availableOrgs = orgsData?.items || []
    
    // Products for filter display names
    const { data: productsData } = useGlobalProducts(organizationId ? String(organizationId) : undefined)
    const availableProducts = productsData?.items || []
    
    const validChartBranches = availableGroups.length > 0 && chartGroupIds.length > 0 
        ? availableBranches.filter((b: any) => chartGroupIds.includes(String(b.groupId))) 
        : availableBranches;
        
    const validReportBranches = availableGroups.length > 0 && reportGroupIds.length > 0 
        ? availableBranches.filter((b: any) => reportGroupIds.includes(String(b.groupId))) 
        : availableBranches;

    const availableChartYears = useMemo(() => {
        const years = new Set<number>()
        const currentY = new Date().getFullYear();
        
        // Derive from ALL-TIME trend data if available
        if (allTimeData?.trend?.length) {
            allTimeData.trend.forEach((d: any) => {
                const y = parseInt(d.date.split("-")[0]);
                if (!isNaN(y)) years.add(y);
            });
        }
        
        // Ensure at least current year
        if (years.size === 0) {
            years.add(currentY);
        }
        
        return Array.from(years).sort((a, b) => a - b)
    }, [allTimeData?.trend])

    // Smart defaults logic
    useEffect(() => {
        if (!hasInitializedChartDefaults.current && availableChartYears.length > 0) {
            const currentYear = new Date().getFullYear();
            if (availableChartYears.includes(currentYear)) {
                setChartYears([currentYear])
                setReportYears([currentYear])
            } else {
                setChartYears([availableChartYears[availableChartYears.length - 1]])
                setReportYears([availableChartYears[availableChartYears.length - 1]])
            }
            hasInitializedChartDefaults.current = true
        }
    }, [availableChartYears])

    const activePreset = presetFromUrl
    const dateRange = useMemo(() => {
        if (startFromUrl && endFromUrl) {
            return { startDate: new Date(startFromUrl), endDate: new Date(endFromUrl) }
        }
        return null
    }, [startFromUrl, endFromUrl])

    const handleDateChange = useCallback((
        range: { startDate: Date; endDate: Date } | null, 
        preset: FilterPreset, 
        compareMode?: boolean, 
        compRange?: { startDate: Date; endDate: Date } | null,
        months: number[] = [],
        years: number[] = [],
        cMonths: number[] = [],
        cYears: number[] = []
    ) => {
        const params = new URLSearchParams(searchParams.toString())
        params.set("preset", preset)
        if (compareMode !== undefined) {
            params.set("compare", String(compareMode))
            setCompare(compareMode)
        }
        if (compRange !== undefined) {
            setCompareRange(compRange)
        }
        
        setSelectedMonths(months)
        setSelectedYears(years)
        setCompareMonths(cMonths)
        setCompareYears(cYears)

        if (months.length > 0) params.set("months", months.join(","))
        else params.delete("months")
        
        if (years.length > 0) params.set("years", years.join(","))
        else params.delete("years")
        
        if (cMonths.length > 0) params.set("compareMonths", cMonths.join(","))
        else params.delete("compareMonths")
        
        if (cYears.length > 0) params.set("compareYears", cYears.join(","))
        else params.delete("compareYears")

        if (range) {
            params.set("startDate", range.startDate.toISOString())
            params.set("endDate", range.endDate.toISOString())
        } else {
            params.delete("startDate")
            params.delete("endDate")
        }
        router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    }, [searchParams, pathname, router])

    const handleBranchChange = useCallback((ids: string[]) => {
        setContextBranchIds(ids)
    }, [setContextBranchIds])

    // ━━━ GLOBAL DATA (Bento Grid) ━━━
    const globalQueryParams = new URLSearchParams()
    if (organizationId) globalQueryParams.set("organizationId", organizationId.toString())
    if (contextBranchIds.length > 0) globalQueryParams.set("branchIds", contextBranchIds.join(","))
    if (globalGroupId) globalQueryParams.set("groupIds", globalGroupId)
    if (selectedMonths.length > 0) globalQueryParams.set("months", selectedMonths.join(","))
    if (selectedYears.length > 0) globalQueryParams.set("years", selectedYears.join(","))
    if (dateRange) {
        globalQueryParams.set("startDate", dateRange.startDate.toISOString())
        globalQueryParams.set("endDate", dateRange.endDate.toISOString())
    }
    if (compare) globalQueryParams.set("compare", "true")

    const { data: globalPerfData, isLoading: isGlobalPerfLoading, mutate: mutateGlobalPerf } = useSWR<any>(`/api/v1/analytics/products/performance?${globalQueryParams.toString()}`, fetcher)

    // ━━━ CHART DATA (Local Filtered) ━━━
    const isChartProductView = chartProductIds.length > 1
    const chartQueryParams = new URLSearchParams()
    if (chartOrgIds.length > 0) chartQueryParams.set("organizationIds", chartOrgIds.join(","))
    else if (organizationId) chartQueryParams.set("organizationIds", organizationId.toString())
    if (chartBranchIds.length > 0) chartQueryParams.set("branchIds", chartBranchIds.join(","))
    if (chartGroupIds.length > 0) chartQueryParams.set("groupIds", chartGroupIds.join(","))
    if (chartProductIds.length > 0) chartQueryParams.set("productIds", chartProductIds.join(","))
    if (chartMonths.length > 0) chartQueryParams.set("months", chartMonths.join(","))
    if (chartYears.length > 0) chartQueryParams.set("years", chartYears.join(","))
    if (compare) chartQueryParams.set("compare", "true")

    const { data: chartPerfData, isLoading: isChartPerfLoading, mutate: mutateChart } = useSWR<any>(`/api/v1/analytics/products/performance?${chartQueryParams.toString()}`, fetcher)

    // ━━━ REPORT DATA (Local Filtered) ━━━
    const reportQueryParams = new URLSearchParams()
    if (organizationId) reportQueryParams.set("organizationId", organizationId.toString())
    if (reportBranchIds.length > 0) reportQueryParams.set("branchIds", reportBranchIds.join(","))
    if (reportGroupIds.length > 0) reportQueryParams.set("groupIds", reportGroupIds.join(","))
    if (reportOrganizationIds.length > 0) reportQueryParams.set("organizationIds", reportOrganizationIds.join(","))
    if (reportProductIds.length > 0) reportQueryParams.set("productIds", reportProductIds.join(","))
    if (reportMonths.length > 0) reportQueryParams.set("months", reportMonths.join(","))
    if (reportYears.length > 0) reportQueryParams.set("years", reportYears.join(","))
    if (reportSearchTerm) reportQueryParams.set("searchTerm", reportSearchTerm)

    const { data: catalogData, isLoading: isCatalogLoading, mutate: mutateCatalog } = useSWR<any>(`/api/v1/analytics/products/catalog-performance?${reportQueryParams.toString()}`, fetcher)
    
    useEffect(() => {
        setHasMounted(true)
        setGeneratedDate(new Date().toLocaleString())

        if (!startFromUrl && !endFromUrl && selectedMonths.length === 0 && selectedYears.length === 0) {
            handleDateChange(null, "all")
        }
    }, [])

    const products = useMemo(() => {
        const p = globalPerfData?.data || []
        return [...p].sort((a: any, b: any) => (b.revenueGeneratedCents || 0) - (a.revenueGeneratedCents || 0))
    }, [globalPerfData])
    
    const chartProducts = useMemo(() => {
        const p = chartPerfData?.data || []
        return [...p].sort((a: any, b: any) => (b.revenueGeneratedCents || 0) - (a.revenueGeneratedCents || 0))
    }, [chartPerfData])

    const catalogItems = useMemo(() => {
        const items = catalogData?.data || []
        return [...items].sort((a: any, b: any) => (b.revenueGeneratedCents || 0) - (a.revenueGeneratedCents || 0))
    }, [catalogData])

    const filteredCatalog = useMemo(() => {
        if (!reportSearchTerm) return catalogItems
        const term = reportSearchTerm.toLowerCase()
        return catalogItems.filter((i: any) => 
            (i.productCode || "").toLowerCase().includes(term) ||
            (i.productName || "").toLowerCase().includes(term)
        )
    }, [catalogItems, reportSearchTerm])

    const filteredProducts = products.filter((p: any) =>
        (p.productName || p.productCode || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.category || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.subCategory || "").toLowerCase().includes(searchTerm.toLowerCase())
    )

    const totalRevenue = products.reduce((sum: number, p: any) => sum + (p.revenueGeneratedCents || 0), 0)
    const totalOrdered = products.reduce((sum: number, p: any) => sum + (p.qtyOrdered || 0), 0)
    const totalVolume = products.reduce((sum: number, p: any) => sum + (p.qtyFulfilled || 0), 0)
    const totalRefunds = products.reduce((sum: number, p: any) => sum + (p.qtyRefunded || 0), 0)
    const totalRefundLoss = products.reduce((sum: number, p: any) => sum + (p.refundLossCents || 0), 0)
    const fulfillmentRate = totalOrdered > 0 ? (totalVolume / totalOrdered) * 100 : 0
    const refundRate = totalOrdered > 0 ? (totalRefunds / totalOrdered) * 100 : 0
    const activeProductCount = products.filter((p: any) => p.status === 'active').length
    const inactiveProductCount = products.filter((p: any) => p.status === 'inactive').length
    const deletedProductCount = products.filter((p: any) => p.status === 'deleted').length

    // Comparison Trends
    const comparison = globalPerfData?.comparison
    const getTrend = (current: number, prev: number) => {
        if (!prev || prev === 0) return null
        const diff = ((current - prev) / prev) * 100
        return { value: Math.abs(diff).toFixed(1), isUp: diff > 0, isDown: diff < 0 }
    }
    const revenueTrend = getTrend(totalRevenue, comparison?.totalRevenue || 0)
    const volumeTrend = getTrend(totalVolume, comparison?.totalVolume || 0)
    const refundTrend = getTrend(totalRefunds, comparison?.totalRefunds || 0)

    // ━━━ CHART DATA: Normalized trends ━━━
    const chartData = useMemo(() => {
        if (isChartProductView) {
            const productsData = chartPerfData?.data || []
            return productsData.map((p: any) => ({
                name: p.productName || p.productCode || "N/A",
                revenue: Math.round((p.revenueGeneratedCents || 0) / 100),
                compareRevenue: Math.round((p.compareRevenue || 0) / 100),
                ordered: p.qtyOrdered || 0,
                fulfilled: p.qtyFulfilled || 0,
                refunded: p.qtyRefunded || 0,
                fulfillRate: (p.qtyOrdered || 0) > 0 ? ((p.qtyFulfilled / p.qtyOrdered) * 100).toFixed(1) : "0.0",
                fullName: p.productName
            }))
        }

        const trend = chartPerfData?.trend || []
        
        // If multiple years selected, show years on X-axis
        if (chartYears.length > 1) {
            return chartYears.sort((a, b) => a - b).map(year => {
                const yearStr = String(year);
                // Aggregating by year if the trend data is monthly or raw
                const yearData = trend.filter((d: any) => d.date.startsWith(yearStr));
                return {
                    name: yearStr,
                    revenue: Math.round(yearData.reduce((sum: number, d: any) => sum + (d.revenue || 0), 0) / 100),
                    compareRevenue: Math.round(yearData.reduce((sum: number, d: any) => sum + (d.compareRevenue || 0), 0) / 100),
                    ordered: yearData.reduce((sum: number, d: any) => sum + (d.qtyOrdered || 0), 0),
                    fulfilled: yearData.reduce((sum: number, d: any) => sum + (d.qtyFulfilled || 0), 0),
                    refunded: yearData.reduce((sum: number, d: any) => sum + (d.qtyRefunded || 0), 0),
                    fulfillRate: yearData.reduce((sum: number, d: any) => sum + (d.qtyOrdered || 0), 0) > 0 
                        ? ((yearData.reduce((sum: number, d: any) => sum + (d.qtyFulfilled || 0), 0) / yearData.reduce((sum: number, d: any) => sum + (d.qtyOrdered || 0), 0)) * 100).toFixed(1)
                        : "0.0",
                    fullName: `${yearStr} Annual Performance`
                }
            });
        }

        // One year selected (or default to current year) -> show months
        const activeYear = chartYears.length === 1 ? chartYears[0] : new Date().getFullYear();
        
        // If specific months are filtered, show only those. Otherwise show all 12.
        const monthsToShow = chartMonths.length > 0 && chartMonths.length < 12 
            ? [...chartMonths].sort((a, b) => a - b) 
            : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

        return monthsToShow.map(m => {
            const dateStr = `${activeYear}-${String(m).padStart(2, '0')}`;
            const dataPoint = trend.find((d: any) => d.date === dateStr);
            return {
                name: CHART_MONTH_NAMES[m - 1],
                revenue: dataPoint ? Math.round(dataPoint.revenue / 100) : 0,
                compareRevenue: dataPoint ? Math.round((dataPoint.compareRevenue || 0) / 100) : 0,
                fullName: `${CHART_MONTH_NAMES[m - 1]} ${activeYear}`,
                ordered: dataPoint?.qtyOrdered || 0,
                fulfilled: dataPoint?.qtyFulfilled || 0,
                refunded: dataPoint?.qtyRefunded || 0,
                fulfillRate: dataPoint?.qtyOrdered > 0 ? ((dataPoint.qtyFulfilled / dataPoint.qtyOrdered) * 100).toFixed(1) : "0.0"
            }
        });
    }, [chartPerfData, chartYears, chartMonths, CHART_MONTH_NAMES])

    const isPriceCustom = reportGroupIds.length > 0 || reportOrganizationIds.length > 0
    const priceLabel = isPriceCustom ? "Price" : "Base Price"

    const handleRowClick = (item: any) => {
        setSelectedRow(item)
        setDrawerOpen(true)
    }

    const getDrawerFields = (item: any): DetailField[] => [
        { key: "s2", label: "Product Details", value: "", type: "section" },
        { key: "status", label: "Status", value: (
            <Badge className={cn(
                "border-none text-[10px] uppercase font-black tracking-widest px-2.5 py-0.5",
                item.status === "active" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" :
                item.status === "inactive" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" :
                "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
            )}>
                {item.status}
            </Badge>
        )},
        { key: "productCode", label: "Product Code", value: item.productCode || "-", type: "mono" },
        { key: "productName", label: "Product Name", value: item.productName || "-" },
        { key: "category", label: "Category", value: item.categoryName || "-" },
        { key: "price", label: priceLabel, value: formatPKR(item.basePriceCents / 100), type: "currency" },
        { key: "unit", label: "Unit", value: item.unit || "unit" },
        { key: "s3", label: "Quantities & Revenue", value: "", type: "section" },
        { key: "qtyOrdered", label: "Qty Ordered", value: String(item.qtyOrdered || 0) },
        { key: "qtyFulfilled", label: "Qty Fulfilled", value: String(item.qtyFulfilled || 0) },
        { key: "revenue", label: "Revenue Generated", value: formatPKR(item.revenueGeneratedCents / 100), type: "currency" },
    ]

    const handleExport = (format: 'csv' | 'excel' | 'pdf') => {
        const isReports = activeTab === "reports"
        const exportData = isReports ? filteredCatalog : filteredProducts

        const headers = isReports 
            ? ["Product Code", "Product Name", "Category", "Status", "Base Price", "Qty Sold", "Revenue"]
            : ["Product Code", "Product Name", "Category", "Sub-category", "Status", "Qty Ordered", "Qty Fulfilled", "Qty Refunded", "Revenue Generated"]
        
        const rows = exportData.map((p: any) => isReports ? [
            p.productCode, p.productName, p.categoryName || "-", p.status, 
            (p.basePriceCents / 100).toFixed(2), p.qtyFulfilled, (p.revenueGeneratedCents / 100).toFixed(2)
        ] : [
            p.productCode, p.productName, p.category, p.subCategory, p.status || 'active', p.qtyOrdered, p.qtyFulfilled, p.qtyRefunded,
            (p.revenueGeneratedCents / 100).toFixed(2)
        ])

        if (format === 'pdf') {
            const doc = new jsPDF('landscape')
            doc.setFontSize(20); doc.text("Product Intelligence Report", 14, 20)
            doc.setFontSize(10); doc.text(`Generated: ${new Date().toLocaleString()} | Tab: ${activeTab.toUpperCase()}`, 14, 28)
            autoTable(doc, { startY: 40, head: [headers], body: rows, theme: 'grid' })
            doc.save(`product-intelligence-${activeTab}-${new Date().getTime()}.pdf`)
            return
        }

        const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows])
        const workbook = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(workbook, worksheet, "Performance")
        XLSX.writeFile(workbook, `product-intelligence-${activeTab}-${new Date().getTime()}.${format === 'excel' ? 'xlsx' : 'csv'}`)
    }

    // Custom tooltip for horizontal bar chart
    const CustomBarTooltip = ({ active, payload }: any) => {
        if (!active || !payload?.length) return null
        const d = payload[0]?.payload
        return (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xl p-4 min-w-[220px]">
                <p className="font-bold text-sm text-slate-900 dark:text-white mb-2">{d.fullName}</p>
                <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                        <span className="text-slate-500">Revenue</span>
                        <span className="font-bold text-indigo-600">{formatPKR(d.revenue)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                        <span className="text-slate-500">Ordered</span>
                        <span className="font-semibold">{d.ordered}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                        <span className="text-slate-500">Fulfilled</span>
                        <span className="font-semibold text-emerald-600">{d.fulfilled}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                        <span className="text-slate-500">Refunded</span>
                        <span className="font-semibold text-rose-500">{d.refunded}</span>
                    </div>
                    <div className="pt-1 border-t border-slate-100 dark:border-slate-800 flex justify-between text-xs">
                        <span className="text-slate-500">Fulfillment</span>
                        <span className="font-bold text-emerald-600">{d.fulfillRate}%</span>
                    </div>
                </div>
            </div>
        )
    }

    if (!hasMounted) {
        return (
            <div className="flex h-[50vh] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
        )
    }

    return (
        <div className="space-y-5 pb-12 bg-slate-50 dark:bg-slate-950 min-h-screen">

            {/* ━━━ GLOBAL STICKY HEADER ━━━ */}
            <div className="sticky top-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 px-6 h-14 flex items-center shadow-sm">
                <div className="flex items-center gap-3">
                    <GlobalDateFilter
                        value={dateRange}
                        onChange={handleDateChange}
                        activePreset={activePreset}
                        hidePresets={false}
                        compare={compare}
                        compareRange={compareRange}
                        months={selectedMonths}
                        years={selectedYears}
                        compareMonths={compareMonths}
                        compareYears={compareYears}
                    />

                    {(role === "SUPER_ADMIN" || role === "HEAD_OFFICE") && organizationId && (
                        <div className="flex items-center gap-2 h-6 pl-3 border-l border-slate-200 dark:border-slate-800">
                            <GroupFilter
                                selectedIds={globalGroupId ? [globalGroupId] : []}
                                onChange={(ids) => setGlobalGroupId(ids[0] || "")}
                                organizationId={organizationId}
                                disabled={contextBranchIds.length > 0}
                            />
                            <BranchFilter
                                selectedIds={contextBranchIds}
                                onChange={handleBranchChange}
                                organizationId={organizationId}
                                groupIds={globalGroupId ? [globalGroupId] : undefined}
                            />
                        </div>
                    )}
                </div>
                <div className="flex-1" />
            </div>

            <div className="px-4 md:px-6 pt-6 space-y-6">
                <Tabs value={activeTab} onValueChange={(val) => {
                    setActiveTab(val as any)
                    const params = new URLSearchParams(searchParams.toString())
                    params.set("tab", val)
                    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
                }} className="space-y-6">
                    
                    {/* ━━━ LUXURY INTELLIGENCE HEADER ━━━ */}
                    <div className="relative overflow-hidden bg-slate-900 border-b border-slate-800 shadow-2xl rounded-[2.5rem]">
                        {/* Ambient Background Elements */}
                        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 bg-indigo-600/20 blur-[120px] rounded-full animate-pulse" />
                        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-72 h-72 bg-blue-600/10 blur-[100px] rounded-full" />
                        
                        <div className="px-8 py-10 relative">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 max-w-7xl mx-auto">
                                <div className="space-y-3">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2.5 rounded-2xl bg-indigo-600/20 text-indigo-400 ring-1 ring-indigo-500/30 shadow-lg shadow-indigo-500/10">
                                            <TrendingUp className="h-5 w-5" />
                                        </div>
                                        <Badge variant="outline" className="bg-indigo-500/10 text-indigo-400 border-indigo-500/20 text-[10px] font-black uppercase tracking-widest px-3 py-1 animate-in slide-in-from-left-4 duration-700">
                                            Centralized Reporting
                                        </Badge>
                                    </div>
                                    <h1 className="text-4xl font-black text-white tracking-tight sm:text-5xl">
                                        Product <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-blue-400 to-emerald-400">Intelligence</span>
                                    </h1>
                                    <p className="text-slate-400 font-medium text-sm flex items-center gap-2 max-w-md">
                                        <Calculator className="h-4 w-4 opacity-50" />
                                        Unified view of product performance metrics and transactional history across all branches.
                                    </p>
                                </div>

                                <div className="flex flex-col items-end gap-6">
                                    <TabsList className="bg-slate-800/50 p-1.5 rounded-2xl border border-slate-700/50 backdrop-blur-md">
                                        <TabsTrigger value="analytics" className="rounded-xl px-8 py-3 text-[11px] font-black uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:text-indigo-600 transition-all duration-300 gap-2">
                                            <LayoutDashboard className="h-3.5 w-3.5" /> Analytics
                                        </TabsTrigger>
                                        <TabsTrigger value="reports" className="rounded-xl px-8 py-3 text-[11px] font-black uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:text-indigo-600 transition-all duration-300 gap-2">
                                            <Database className="h-3.5 w-3.5" /> Reports
                                        </TabsTrigger>
                                    </TabsList>
                                    
                                    <div className="flex items-center gap-3">
                                        <Button 
                                            variant="outline" 
                                            onClick={() => { mutateGlobalPerf(); mutateCatalog(); mutateChart(); }}
                                            className="h-11 bg-slate-800/50 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white rounded-xl px-5 gap-2 transition-all duration-300 group"
                                        >
                                            <RefreshCw className={cn("h-4 w-4 transition-transform duration-500 group-hover:rotate-180", (isGlobalPerfLoading || isCatalogLoading || isChartPerfLoading) && "animate-spin")} />
                                            Synchronize
                                        </Button>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button className="h-11 bg-indigo-600 hover:bg-indigo-500 text-white border-none rounded-xl px-6 gap-2 shadow-lg shadow-indigo-600/20 transition-all duration-300 font-bold uppercase tracking-widest text-[11px]">
                                                    <Download className="h-4 w-4" /> Export
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-52 bg-slate-900 border-slate-800 text-slate-300 rounded-2xl p-2 shadow-2xl">
                                                <DropdownMenuItem onClick={() => handleExport('csv')} className="gap-3 py-3 rounded-xl hover:bg-slate-800 focus:bg-slate-800 cursor-pointer text-xs font-bold uppercase tracking-wider">
                                                    <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500"><FileSpreadsheet className="h-4 w-4" /></div> CSV Spreadsheet
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleExport('excel')} className="gap-3 py-3 rounded-xl hover:bg-slate-800 focus:bg-slate-800 cursor-pointer text-xs font-bold uppercase tracking-wider">
                                                    <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-500"><FileText className="h-4 w-4" /></div> Excel Workbook
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleExport('pdf')} className="gap-3 py-3 rounded-xl hover:bg-slate-800 focus:bg-slate-800 cursor-pointer text-xs font-bold uppercase tracking-wider">
                                                    <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-500"><FilePdf className="h-4 w-4" /></div> PDF Document
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <TabsContent value="analytics" className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                        {/* ━━━ KPI BENTO GRID ━━━ */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            <KPICard
                                label="Total Revenue"
                                value={formatPKR(totalRevenue / 100)}
                                icon={<TrendingUp className="h-4 w-4" />}
                                iconBg="bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400"
                                trend={revenueTrend}
                                trendColor="emerald"
                                subtitle="From fulfilled products"
                                compare={compare}
                                compareValue={comparison ? formatPKR(comparison.totalRevenue / 100) : undefined}
                            />
                            <KPICard
                                label="Qty Fulfilled"
                                value={totalVolume.toLocaleString()}
                                icon={<Package className="h-4 w-4" />}
                                iconBg="bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400"
                                trend={volumeTrend}
                                trendColor="emerald"
                                subtitle={`${fulfillmentRate.toFixed(1)}% fulfillment rate`}
                                compare={compare}
                                compareValue={comparison ? comparison.totalVolume.toLocaleString() : undefined}
                            />
                            <KPICard
                                label="Refund Loss"
                                value={formatPKR(totalRefundLoss / 100)}
                                icon={<AlertOctagon className="h-4 w-4" />}
                                iconBg="bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400"
                                trend={refundTrend}
                                trendColor="rose"
                                subtitle={`${totalRefunds.toLocaleString()} items (${refundRate.toFixed(1)}%)`}
                                compare={compare}
                                compareValue={comparison ? `${comparison.totalRefunds.toLocaleString()} items` : undefined}
                            />
                            <Card className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900 flex flex-col justify-between">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="p-2 rounded-xl bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400">
                                        <Layers className="h-4 w-4" />
                                    </div>
                                    <Badge variant="outline" className="text-[9px] uppercase font-bold tracking-wider opacity-60 font-mono">Status</Badge>
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-slate-900 dark:text-white mb-1">{products.length.toLocaleString()}</p>
                                    <div className="flex items-center gap-3">
                                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                                            <ShieldCheck className="h-3 w-3" /> {activeProductCount} active
                                        </span>
                                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                                            <ShieldX className="h-3 w-3" /> {inactiveProductCount} inactive
                                        </span>
                                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-600 dark:text-red-400">
                                            <ShieldX className="h-3 w-3" /> {deletedProductCount} deleted
                                        </span>
                                    </div>
                                </div>
                            </Card>
                        </div>
                        {/* Revenue Chart */}
                        {/* Revenue Chart with Filters */}
                        <Card className="overflow-hidden border border-slate-200/80 dark:border-slate-800 shadow-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-3xl rounded-[2rem] relative group transition-all duration-700 hover:shadow-indigo-500/10 hover:border-indigo-400/40">
                            <CardHeader className="relative z-10 pb-4 border-b border-slate-100/80 dark:border-slate-800/50 space-y-4 bg-gradient-to-r from-slate-50/50 via-white/50 to-indigo-50/20 dark:from-slate-950/20 dark:via-slate-900/80 dark:to-indigo-950/10">
                                <div className="flex flex-row items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <CardTitle className="text-sm font-bold flex items-center gap-2.5 uppercase tracking-tight text-slate-800 dark:text-slate-200">
                                            <div className="p-1.5 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/20">
                                                <ChartBarIcon className="h-3.5 w-3.5" />
                                            </div>
                                            Top Products by Revenue
                                            <Badge variant="outline" className="text-[9px] font-bold tracking-widest border-indigo-200 dark:border-indigo-800 text-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30 ml-1">Fulfilled Only</Badge>
                                        </CardTitle>
                                    </div>
                                    {(chartYears.length > 0 || chartMonths.length > 0 || chartBranchIds.length > 0 || chartGroupIds.length > 0) && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => {
                                                setChartYears([]);
                                                setChartMonths([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
                                                setChartBranchIds([]);
                                                setChartGroupIds([]);
                                            }}
                                            className="h-7 text-[10px] font-bold text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-full px-3 gap-1 transition-all duration-200 hover:scale-105"
                                        >
                                            <RotateCcw className="h-3 w-3" /> Reset Defaults
                                        </Button>
                                    )}
                                </div>

                                {/* ── Chart Filters ── */}
                                <div className="flex flex-wrap items-center gap-3">
                                    <MultiSelectFilter
                                        title="Months"
                                        items={CHART_MONTH_NAMES.map((name, i) => ({ id: i + 1, label: name }))}
                                        selectedIds={chartMonths}
                                        onChange={(ids) => setChartMonths(ids.sort((a, b) => a - b))}
                                        icon={<Filter className="h-3.5 w-3.5 text-emerald-500" />}
                                        placeholder="Months"
                                        showSearch={false}
                                    />
                                    <MultiSelectFilter
                                        title="Years"
                                        items={availableChartYears.map(y => ({ id: y, label: String(y) }))}
                                        selectedIds={chartYears}
                                        onChange={(ids) => setChartYears(ids.sort((a, b) => b - a))}
                                        icon={<History className="h-3.5 w-3.5 text-indigo-500" />}
                                        placeholder="Years"
                                        showSearch={false}
                                    />
                                    {(role === "SUPER_ADMIN" || role === "HEAD_OFFICE") && (
                                        <>
                                            <OrganizationFilter
                                                selectedIds={chartOrgIds}
                                                onChange={setChartOrgIds}
                                                placeholder="Organizations"
                                            />
                                            {(chartOrgIds.length > 0 || organizationId) && (
                                                <>
                                                    <GroupFilter
                                                        selectedIds={chartGroupIds}
                                                        onChange={setChartGroupIds}
                                                        organizationId={organizationId || undefined}
                                                        organizationIds={chartOrgIds.length > 0 ? chartOrgIds : undefined}
                                                        disabled={chartBranchIds.length > 0}
                                                        placeholder="Groups"
                                                    />
                                                    <BranchFilter
                                                        selectedIds={chartBranchIds}
                                                        onChange={setChartBranchIds}
                                                        organizationId={organizationId || undefined}
                                                        organizationIds={chartOrgIds.length > 0 ? chartOrgIds : undefined}
                                                        groupIds={chartGroupIds}
                                                        placeholder="Branches"
                                                    />
                                                    <ProductFilter
                                                        selectedIds={chartProductIds}
                                                        onChange={setChartProductIds}
                                                        organizationId={organizationId || undefined}
                                                        organizationIds={chartOrgIds.length > 0 ? chartOrgIds : undefined}
                                                        groupIds={chartGroupIds}
                                                        branchIds={chartBranchIds}
                                                        placeholder="Products"
                                                    />
                                                </>
                                            )}
                                        </>
                                    )}
                                </div>
                                    
                                    {/* Active Filters Badges */}
                                    {chartYears.length > 0 && (
                                        <div className="flex flex-wrap gap-1.5 ml-1">
                                            {chartYears.map(y => (
                                                <Badge key={y} className="text-[10px] font-bold bg-gradient-to-r from-indigo-500 to-violet-500 text-white border-0 gap-1 cursor-pointer shadow-sm px-2.5 py-0.5 rounded-full" onClick={() => toggleChartYear(y)}>
                                                    {y} <X className="h-2.5 w-2.5" />
                                                </Badge>
                                            ))}
                                        </div>
                                    )}
                                    {chartMonths.length > 0 && chartMonths.length < 12 && (
                                        <div className="flex flex-wrap gap-1.5 ml-1">
                                            {chartMonths.map(m => (
                                                <Badge key={m} className="text-[10px] font-bold bg-gradient-to-r from-emerald-500 to-teal-500 text-white border-0 gap-1 cursor-pointer shadow-sm px-2.5 py-0.5 rounded-full" onClick={() => toggleChartMonth(m)}>
                                                    {CHART_MONTH_NAMES[m - 1]} <X className="h-2.5 w-2.5" />
                                                </Badge>
                                            ))}
                                        </div>
                                    )}
                                    {chartGroupIds.length > 0 && (
                                        <div className="flex flex-wrap gap-1.5 ml-1">
                                            {chartGroupIds.map(gid => {
                                                const gr = availableGroups.find((g: any) => String(g.id) === gid)
                                                return (
                                                    <Badge key={gid} className="text-[10px] font-bold bg-gradient-to-r from-sky-500 to-blue-500 text-white border-0 gap-1 cursor-pointer shadow-sm px-2.5 py-0.5 rounded-full" onClick={() => toggleChartGroup(gid)}>
                                                        {gr?.name || gid} <X className="h-2.5 w-2.5" />
                                                    </Badge>
                                                )
                                            })}
                                        </div>
                                    )}
                                    {chartBranchIds.length > 0 && (
                                        <div className="flex flex-wrap gap-1.5 ml-1">
                                            {chartBranchIds.map(bid => {
                                                const br = availableBranches.find((b: any) => String(b.id) === bid)
                                                return (
                                                    <Badge key={bid} className="text-[10px] font-bold bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0 gap-1 cursor-pointer shadow-sm px-2.5 py-0.5 rounded-full" onClick={() => toggleChartBranch(bid)}>
                                                        {br?.name || bid} <X className="h-2.5 w-2.5" />
                                                    </Badge>
                                                )
                                            })}
                                        </div>
                                    )}
                            </CardHeader>
                            <CardContent className="pt-6 pb-6 pr-6 pl-0">
                                {isChartPerfLoading || isGlobalPerfLoading ? (
                                    <div className="h-[320px] flex items-center justify-center">
                                        <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
                                    </div>
                                ) : (
                                    <div className="h-[320px] w-full ml-4">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.3} />
                                                <XAxis 
                                                    dataKey="name" 
                                                    axisLine={false} 
                                                    tickLine={false} 
                                                    tick={{ fill: '#475569', fontSize: 11, fontWeight: 600 }}
                                                    dy={10}
                                                />
                                                <YAxis 
                                                    axisLine={false} 
                                                    tickLine={false} 
                                                    tick={{ fill: '#94a3b8', fontSize: 10 }} 
                                                    tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}K` : v.toString()}
                                                    dx={-10}
                                                />
                                                <Tooltip content={<CustomBarTooltip />} cursor={{ fill: 'rgba(99, 102, 241, 0.05)' }} />
                                                <Legend 
                                                    verticalAlign="top" 
                                                    align="right" 
                                                    iconType="circle" 
                                                    wrapperStyle={{ paddingBottom: 20, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}
                                                />
                                                <Bar 
                                                    dataKey="revenue" 
                                                    name="REVENUE" 
                                                    fill="#6366f1" 
                                                    radius={[6, 6, 0, 0]} 
                                                    barSize={24} 
                                                />
                                                {compare && (
                                                    <Bar 
                                                        dataKey="compareRevenue" 
                                                        name="PRIOR PERIOD" 
                                                        fill="#94a3b8" 
                                                        fillOpacity={0.4}
                                                        radius={[6, 6, 0, 0]} 
                                                        barSize={24} 
                                                    />
                                                )}
                                                </ComposedChart>
                                            </ResponsiveContainer>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Product Table */}
                        <Card className="overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900">
                            <div className="p-4 border-b border-slate-100 dark:border-slate-800/50 flex flex-wrap justify-between items-center gap-3">
                                <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200 flex items-center gap-2">
                                    <Package className="h-4 w-4 text-indigo-500" />
                                    All Products
                                    <Badge variant="secondary" className="text-[10px] ml-1 font-mono">{filteredProducts.length}</Badge>
                                </h3>

                                <div className="flex flex-wrap items-center gap-2">
                                    <div className="relative">
                                        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                                        <Input
                                            placeholder="Search products..."
                                            className="pl-8 h-8 w-44 text-xs bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-700 rounded-lg"
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                        />
                                    </div>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button size="sm" className="h-8 text-[11px] font-bold bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 px-3 rounded-lg shadow-lg shadow-indigo-600/20" disabled={isGlobalPerfLoading}>
                                                <Download className="h-3.5 w-3.5" /> EXPORT
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="w-40 rounded-xl">
                                            <DropdownMenuItem onClick={() => handleExport('csv')} className="text-xs py-2 cursor-pointer font-bold"><FileText className="mr-2 h-4 w-4 text-slate-400" /> CSV</DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => handleExport('excel')} className="text-xs py-2 cursor-pointer font-bold"><FileSpreadsheet className="mr-2 h-4 w-4 text-emerald-500" /> Excel</DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => handleExport('pdf')} className="text-xs py-2 cursor-pointer font-bold"><FilePdf className="mr-2 h-4 w-4 text-rose-500" /> PDF</DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </div>
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-200 dark:border-slate-800">
                                            <TableHead className="pl-6 h-10 text-[10px] font-bold uppercase tracking-wider text-slate-500">Code</TableHead>
                                            <TableHead className="h-10 text-[10px] font-bold uppercase tracking-wider text-slate-500">Product Name</TableHead>
                                            <TableHead className="h-10 text-[10px] font-bold uppercase tracking-wider text-slate-500">Category</TableHead>
                                            <TableHead className="h-10 text-[10px] font-bold uppercase tracking-wider text-slate-500">Sub-category</TableHead>
                                            <TableHead className="h-10 text-[10px] font-bold uppercase tracking-wider text-slate-500 text-center">Status</TableHead>
                                            <TableHead className="h-10 text-[10px] font-bold uppercase tracking-wider text-slate-500 text-center">{compare ? "Qty Ord (A/B)" : "Qty Ordered"}</TableHead>
                                            <TableHead className="h-10 text-[10px] font-bold uppercase tracking-wider text-slate-500 text-center text-emerald-600">{compare ? "Fulfilled (A/B)" : "Fulfilled"}</TableHead>
                                            <TableHead className="h-10 text-[10px] font-bold uppercase tracking-wider text-slate-500 text-center text-rose-500">{compare ? "Refunded (A/B)" : "Refunded"}</TableHead>
                                            <TableHead className="text-right pr-6 h-10 text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono">{compare ? "Revenue (A/B)" : "Revenue"}</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {isGlobalPerfLoading ? (
                                            <TableRow><TableCell colSpan={8} className="h-32 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-amber-500" /></TableCell></TableRow>
                                        ) : filteredProducts.length === 0 ? (
                                            <TableRow><TableCell colSpan={8} className="h-32 text-center text-slate-500 text-sm">No products found.</TableCell></TableRow>
                                        ) : (
                                            filteredProducts.map((p: any) => (
                                                <TableRow key={p.productId} className="hover:bg-amber-50/40 dark:hover:bg-amber-900/10 border-b border-slate-100 dark:border-slate-800/50">
                                                    <TableCell className="font-mono text-[11px] pl-6 text-slate-500 font-semibold">{p.productCode}</TableCell>
                                                    <TableCell className="font-medium text-xs text-slate-900 dark:text-slate-200">
                                                        <div className="flex flex-col">
                                                            <span>{p.productName}</span>
                                                            <span className="text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded w-fit mt-1">{p.unit}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-xs text-slate-600 dark:text-slate-400">{p.category}</TableCell>
                                                    <TableCell className="text-xs text-slate-600 dark:text-slate-400">{p.subCategory}</TableCell>
                                                    <TableCell className="text-center">
                                                        <Badge 
                                                            className={cn(
                                                                "text-[9px] uppercase px-2 py-0.5 rounded-full border-none font-bold tracking-wider",
                                                                (p.status === 'active' || !p.status) 
                                                                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" 
                                                                    : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                                                            )}
                                                        >
                                                            {p.status || 'ACTIVE'}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-center font-mono text-xs">
                                                        <div className="flex flex-col items-center">
                                                            <span>{p.qtyOrdered}</span>
                                                            {compare && <span className="text-[10px] text-slate-400 border-t border-slate-100 mt-0.5">{p.compareQtyOrdered || 0}</span>}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-center font-mono font-bold text-xs text-emerald-600 dark:text-emerald-400">
                                                        <div className="flex flex-col items-center">
                                                            <span>{p.qtyFulfilled}</span>
                                                            {compare && <span className="text-[10px] text-slate-400 border-t border-slate-100 mt-0.5 font-normal">{p.compareQty || 0}</span>}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-center font-mono font-bold text-xs text-rose-500">
                                                        <div className="flex flex-col items-center">
                                                            <span>{p.qtyRefunded}</span>
                                                            {compare && <span className="text-[10px] text-slate-400 border-t border-slate-100 mt-0.5 font-normal">{p.compareQtyRefunded || 0}</span>}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right font-mono font-bold text-xs text-slate-900 dark:text-white">
                                                        <div className="flex flex-col items-end">
                                                            <span>{formatPKR(p.revenueGeneratedCents / 100)}</span>
                                                            {compare && <span className="text-[10px] text-slate-400 border-t border-slate-100 mt-0.5 font-normal">{formatPKR((p.compareRevenue || 0) / 100)}</span>}
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </Card>
                        </TabsContent>
                        <TabsContent value="reports" className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                        {/* ━━━ REPORTS TAB ━━━ */}
                        <Card className="overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900">
                        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <History className="h-4 w-4 text-indigo-500" />
                                    <h3 className="font-bold text-sm uppercase tracking-tight text-slate-800 dark:text-slate-200">
                                        Product Catalog Report
                                    </h3>
                                </div>
                                {(reportYears.length > 0 || reportMonths.length > 0 || reportBranchIds.length > 0 || reportGroupIds.length > 0) && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                            setReportYears([]);
                                            setReportMonths([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
                                            setReportBranchIds([]);
                                            setReportGroupIds([]);
                                            setReportProductIds([]);
                                            setReportOrganizationIds([]);
                                        }}
                                        className="h-7 text-[10px] font-bold text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-full px-3 gap-1 transition-all duration-200 hover:scale-105"
                                    >
                                        <RotateCcw className="h-3 w-3" /> Reset Defaults
                                    </Button>
                                )}
                            </div>
                            
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                {/* ── Report Filters ── */}
                                <div className="flex flex-wrap items-center gap-3">
                                    <MultiSelectFilter
                                        title="Months"
                                        items={CHART_MONTH_NAMES.map((name, i) => ({ id: i + 1, label: name }))}
                                        selectedIds={reportMonths}
                                        onChange={(ids) => setReportMonths(ids.sort((a,b) => a - b))}
                                        icon={<Filter className="h-3.5 w-3.5 text-emerald-500" />}
                                        placeholder="Months"
                                        showSearch={false}
                                    />
                                    <MultiSelectFilter
                                        title="Years"
                                        items={availableChartYears.map(y => ({ id: y, label: String(y) }))}
                                        selectedIds={reportYears}
                                        onChange={(ids) => setReportYears(ids.sort((a, b) => b - a))}
                                        icon={<History className="h-3.5 w-3.5 text-indigo-500" />}
                                        placeholder="Years"
                                        showSearch={false}
                                    />
                                    {(role === "SUPER_ADMIN" || role === "HEAD_OFFICE") && (
                                        <>
                                            <OrganizationFilter
                                                selectedIds={reportOrganizationIds}
                                                onChange={setReportOrganizationIds}
                                                placeholder="Organizations"
                                            />
                                            {(reportOrganizationIds.length > 0 || organizationId) && (
                                                <>
                                                    <GroupFilter
                                                        selectedIds={reportGroupIds}
                                                        onChange={setReportGroupIds}
                                                        organizationId={organizationId || undefined}
                                                        organizationIds={reportOrganizationIds.length > 0 ? reportOrganizationIds : undefined}
                                                        disabled={reportBranchIds.length > 0}
                                                        placeholder="Groups"
                                                    />
                                                    <BranchFilter
                                                        selectedIds={reportBranchIds}
                                                        onChange={setReportBranchIds}
                                                        organizationId={organizationId || undefined}
                                                        organizationIds={reportOrganizationIds.length > 0 ? reportOrganizationIds : undefined}
                                                        groupIds={reportGroupIds}
                                                        placeholder="Branches"
                                                    />
                                                    <ProductFilter
                                                        selectedIds={reportProductIds}
                                                        onChange={setReportProductIds}
                                                        organizationId={organizationId || undefined}
                                                        organizationIds={reportOrganizationIds.length > 0 ? reportOrganizationIds : undefined}
                                                        groupIds={reportGroupIds}
                                                        branchIds={reportBranchIds}
                                                        placeholder="Products"
                                                    />
                                                </>
                                            )}
                                        </>
                                    )}
                                    <ProductFilter
                                        selectedIds={reportProductIds}
                                        onChange={setReportProductIds}
                                        organizationId={organizationId || undefined}
                                        organizationIds={reportOrganizationIds}
                                        groupIds={reportGroupIds}
                                        branchIds={reportBranchIds}
                                        placeholder="Products"
                                    />
                                </div>
                                
                                <div className="flex items-center gap-2">
                                    <div className="relative">
                                        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                                        <Input
                                            placeholder="Search by code, product..."
                                            className="pl-8 h-8 w-56 text-xs bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-700 rounded-lg"
                                            value={reportSearchTerm}
                                            onChange={(e) => setReportSearchTerm(e.target.value)}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Active Filters Badges */}
                            <div className="flex flex-wrap gap-2">
                                {reportYears.length > 0 && reportYears.map(y => (
                                    <Badge key={y} className="text-[10px] font-bold bg-indigo-500 text-white gap-1 cursor-pointer rounded-full px-2.5 py-0.5" onClick={() => toggleReportYear(y)}>
                                        {y} <X className="h-2.5 w-2.5" />
                                    </Badge>
                                ))}
                                {reportMonths.length > 0 && reportMonths.length < 12 && reportMonths.map(m => (
                                    <Badge key={m} className="text-[10px] font-bold bg-emerald-500 text-white gap-1 cursor-pointer rounded-full px-2.5 py-0.5" onClick={() => toggleReportMonth(m)}>
                                        {CHART_MONTH_NAMES[m - 1]} <X className="h-2.5 w-2.5" />
                                    </Badge>
                                ))}
                                {reportGroupIds.length > 0 && reportGroupIds.map(gid => {
                                    const gr = availableGroups.find((g: any) => String(g.id) === gid)
                                    return (
                                        <Badge key={gid} className="text-[10px] font-bold bg-sky-500 text-white gap-1 cursor-pointer rounded-full px-2.5 py-0.5" onClick={() => toggleReportGroup(gid)}>
                                            {gr?.name || gid} <X className="h-2.5 w-2.5" />
                                        </Badge>
                                    )
                                })}
                                {reportBranchIds.length > 0 && reportBranchIds.map(bid => {
                                    const br = availableBranches.find((b: any) => String(b.id) === bid)
                                    return (
                                        <Badge key={bid} className="text-[10px] font-bold bg-amber-500 text-white gap-1 cursor-pointer rounded-full px-2.5 py-0.5" onClick={() => toggleReportBranch(bid)}>
                                            {br?.name || bid} <X className="h-2.5 w-2.5" />
                                        </Badge>
                                    )
                                })}
                                {reportOrganizationIds.length > 0 && reportOrganizationIds.map(oid => {
                                    const org = availableOrgs.find((o: any) => String(o.id) === oid)
                                    return (
                                        <Badge key={oid} className="text-[10px] font-bold bg-indigo-600 text-white gap-1 cursor-pointer rounded-full px-2.5 py-0.5" onClick={() => setReportOrganizationIds(prev => prev.filter(p => p !== oid))}>
                                            Org: {org?.name || oid} <X className="h-2.5 w-2.5" />
                                        </Badge>
                                    )
                                })}
                                {reportProductIds.length > 0 && reportProductIds.map(pid => {
                                    const pr = availableProducts.find((p: any) => String(p.id) === pid)
                                    return (
                                        <Badge key={pid} className="text-[10px] font-bold bg-slate-600 text-white gap-1 cursor-pointer rounded-full px-2.5 py-0.5" onClick={() => setReportProductIds(prev => prev.filter(p => p !== pid))}>
                                            {pr?.name || pid} <X className="h-2.5 w-2.5" />
                                        </Badge>
                                    )
                                })}
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-slate-50/20 dark:bg-slate-800/10">
                                        <TableHead className="pl-6 h-10 text-[9px] font-black uppercase tracking-widest text-slate-400">Status</TableHead>
                                        <TableHead className="h-10 text-[9px] font-black uppercase tracking-widest text-slate-400">Product Info</TableHead>
                                        <TableHead className="h-10 text-[9px] font-black uppercase tracking-widest text-slate-400">Category</TableHead>
                                        <TableHead className="h-10 text-[9px] font-black uppercase tracking-widest text-slate-400 text-center">{priceLabel}</TableHead>
                                        <TableHead className="h-10 text-[9px] font-black uppercase tracking-widest text-slate-400 text-center">Qty Sold</TableHead>
                                        <TableHead className="h-10 text-[9px] font-black uppercase tracking-widest text-slate-400 text-right pr-6">Revenue</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isCatalogLoading ? (
                                        <TableRow><TableCell colSpan={6} className="h-32 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-indigo-300" /></TableCell></TableRow>
                                    ) : filteredCatalog.length === 0 ? (
                                        <TableRow><TableCell colSpan={6} className="h-32 text-center text-slate-400 text-xs">No products found in catalog.</TableCell></TableRow>
                                    ) : (
                                        filteredCatalog.map((product: any) => {
                                            return (
                                                <TableRow key={product.globalProductId} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer" onClick={() => handleRowClick(product)}>
                                                    <TableCell className="pl-6 py-3">
                                                        {product.status === "active" ? (
                                                            <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-none text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full">Active</Badge>
                                                        ) : product.status === "inactive" ? (
                                                            <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-none text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full">Inactive</Badge>
                                                        ) : (
                                                            <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-none text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full">Deleted</Badge>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="py-3">
                                                        <div className="flex flex-col">
                                                            <span className="font-bold text-[11px] text-slate-900 dark:text-white uppercase truncate max-w-[200px]">
                                                                {product.productName}
                                                            </span>
                                                            <span className="text-[10px] text-slate-400 font-mono">{product.productCode}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="py-3">
                                                        <Badge variant="outline" className="text-[10px] font-medium opacity-70 px-2 rounded-full truncate max-w-[120px]">{product.categoryName}</Badge>
                                                    </TableCell>
                                                    <TableCell className="text-center font-mono text-[11px] font-bold text-slate-600 dark:text-slate-400">
                                                        {formatPKR(product.basePriceCents / 100)}
                                                    </TableCell>
                                                    <TableCell className="text-center font-mono text-[11px] font-bold text-emerald-600">
                                                        {product.qtyFulfilled}
                                                    </TableCell>
                                                    <TableCell className="text-right pr-6 font-mono text-[11px] font-black text-indigo-600">
                                                        {formatPKR(product.revenueGeneratedCents / 100)}
                                                    </TableCell>
                                                </TableRow>
                                            )
                                        })
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>

            <ExpandableRowDrawer
                open={drawerOpen} onClose={() => setDrawerOpen(false)}
                title={selectedRow?.productName || "Product Transaction"}
                subtitle={`${selectedRow?.branchName} • ${selectedRow?.productCode}`}
                fields={selectedRow ? getDrawerFields(selectedRow) : []}
            />
        </div>
    )
}

/* ━━━ KPI Card Component ━━━ */
function KPICard({ label, value, icon, iconBg, trend, trendColor, subtitle, compare, compareValue }: {
    label: string
    value: string | number
    icon: React.ReactNode
    iconBg: string
    trend: { value: string; isUp: boolean; isDown: boolean } | null
    trendColor: 'emerald' | 'rose'
    subtitle: string
    compare?: boolean
    compareValue?: string
}) {
    return (
        <Card className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900">
            <div className="flex items-center justify-between mb-2">
                <div className={cn("p-2 rounded-xl", iconBg)}>{icon}</div>
                <div className="flex flex-col items-end gap-1">
                    <Badge variant="outline" className="text-[9px] uppercase font-bold tracking-wider opacity-60">{label}</Badge>
                    {trend && trend.value !== "0.0" && (
                        <div className={cn(
                            "flex items-center gap-0.5 text-[10px] font-bold",
                            trendColor === 'rose'
                                ? (trend.isUp ? "text-rose-500" : "text-emerald-500")
                                : (trend.isUp ? "text-emerald-500" : "text-rose-500")
                        )}>
                            {trend.isUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                            {trend.value}%
                        </div>
                    )}
                </div>
            </div>
            <div className="flex items-baseline gap-2">
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
                {compare && compareValue && (
                    <span className="text-[10px] font-bold text-slate-400 line-through opacity-50">{compareValue}</span>
                )}
            </div>
            <p className="text-[10px] font-semibold text-slate-400 mt-1.5">{subtitle}</p>
        </Card>
    )
}
