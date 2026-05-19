const DATE_ONLY_PARAM_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const APP_TIME_ZONE = "Asia/Karachi"
const APP_TIME_ZONE_OFFSET = "+05:00"

const appMonthFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
})

const parseDateParam = (value: string | null | undefined) => {
  if (!value) return undefined
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date
}

export const parseStartDateParam = (value: string | null | undefined) => {
  if (!value) return undefined
  if (DATE_ONLY_PARAM_PATTERN.test(value)) {
    return new Date(`${value}T00:00:00.000${APP_TIME_ZONE_OFFSET}`)
  }
  return parseDateParam(value)
}

export const parseEndDateParam = (value: string | null | undefined) => {
  if (!value) return undefined
  if (DATE_ONLY_PARAM_PATTERN.test(value)) {
    return new Date(`${value}T23:59:59.999${APP_TIME_ZONE_OFFSET}`)
  }
  return parseDateParam(value)
}

export const getAppMonthParts = (date: Date) => {
  const parts = appMonthFormatter.formatToParts(date)
  const year = Number(parts.find(part => part.type === "year")?.value)
  const month = Number(parts.find(part => part.type === "month")?.value)

  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    const fallbackMonth = date.getUTCMonth() + 1
    return {
      year: date.getUTCFullYear(),
      month: fallbackMonth,
      monthIndex: fallbackMonth - 1,
      period: `${date.getUTCFullYear()}-${String(fallbackMonth).padStart(2, "0")}`,
    }
  }

  return {
    year,
    month,
    monthIndex: month - 1,
    period: `${year}-${String(month).padStart(2, "0")}`,
  }
}

export const getAppMonthPeriod = (date: Date) => getAppMonthParts(date).period

export const buildAppMonthPeriods = (
  startDate: Date,
  endDate: Date,
  months: number[] = [],
  years: number[] = []
) => {
  const periods: string[] = []
  const start = getAppMonthParts(startDate)
  const end = getAppMonthParts(endDate)

  for (let year = start.year; year <= end.year; year++) {
    const firstMonth = year === start.year ? start.monthIndex : 0
    const lastMonth = year === end.year ? end.monthIndex : 11

    for (let monthIndex = firstMonth; monthIndex <= lastMonth; monthIndex++) {
      const month = monthIndex + 1
      if (years.length > 0 && !years.includes(year)) continue
      if (months.length > 0 && !months.includes(month)) continue
      periods.push(`${year}-${String(month).padStart(2, "0")}`)
    }
  }

  return periods
}
