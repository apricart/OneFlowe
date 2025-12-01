 "use client"

import { useMemo } from "react"
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar } from "recharts"
import { cn } from "@/lib/utils"

type TrendPoint = { label: string; value: number }

type ChartDatum = { label: string; value: number }

const currencyFormatter = new Intl.NumberFormat("en-PK", {
  style: "currency",
  currency: "PKR",
  maximumFractionDigits: 0,
})

function ChartTooltip({
  active,
  payload,
  label,
  prefix = "",
}: {
  active?: boolean
  payload?: any[]
  label?: string
  prefix?: "currency" | "count" | ""
}) {
  if (!active || !payload?.length) return null
  const value = payload[0].value as number
  const formatted =
    prefix === "currency"
      ? currencyFormatter.format(value)
      : prefix === "count"
      ? `${value.toLocaleString()} orders`
      : value.toLocaleString()

  return (
    <div className="rounded-xl border bg-background/95 px-3 py-2 text-xs shadow-md">
      <p className="font-semibold">{label}</p>
      <p className="text-muted-foreground">{formatted}</p>
    </div>
  )
}

export function TrendAreaChart({ data, className }: { data: TrendPoint[]; className?: string }) {
  const chartData: ChartDatum[] = useMemo(() => data.map(point => ({ label: point.label, value: point.value })), [data])

  return (
    <div className={cn("h-60 w-full", className)}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 12, right: 12, left: 0, bottom: 8 }}>
          <defs>
            <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#4F46E5" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            stroke="hsl(var(--muted-foreground))"
          />
          <YAxis
            tickFormatter={value => currencyFormatter.format(value as number)}
            width={70}
            axisLine={false}
            tickLine={false}
            tickMargin={8}
            stroke="hsl(var(--muted-foreground))"
          />
          <Tooltip content={<ChartTooltip prefix="currency" />} />
          <Area
            type="monotone"
            dataKey="value"
            stroke="#4F46E5"
            strokeWidth={3}
            fillOpacity={1}
            fill="url(#areaGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

export function ComparisonBarChart({
  data,
  className,
  title,
}: {
  data: TrendPoint[]
  className?: string
  title?: string
}) {
  const chartData: ChartDatum[] = useMemo(() => data.map(point => ({ label: point.label, value: point.value })), [data])

  return (
    <div className={cn("h-60 w-full", className)}>
      {title && <p className="mb-3 text-sm font-medium text-muted-foreground">{title}</p>}
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 8, right: 12, left: -12, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} stroke="hsl(var(--muted-foreground))" />
          <YAxis allowDecimals={false} axisLine={false} tickLine={false} stroke="hsl(var(--muted-foreground))" />
          <Tooltip content={<ChartTooltip prefix="count" />} cursor={{ fill: "hsl(var(--muted))/0.2" }} />
          <Bar
            dataKey="value"
            radius={[6, 6, 0, 0]}
            fill="#10B981"
            label={{ position: "top", fill: "hsl(var(--foreground))", fontSize: 12 }}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

