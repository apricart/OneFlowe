type RangeBoundary = "start" | "end"

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

const dateFromUtcParts = (year: number, monthIndex: number, day: number) =>
  new Date(Date.UTC(year, monthIndex, day))

/**
 * Date filters arrive as ISO instants from the browser's local calendar.
 * Budget allocation is monthly, so derive the selected calendar month without
 * letting UTC conversion pull start/end boundaries into neighboring months.
 */
export const parseBudgetPeriodBoundary = (value: string | null, boundary: RangeBoundary) => {
  if (!value) return null

  if (DATE_ONLY_PATTERN.test(value)) {
    const [year, month, day] = value.split("-").map(Number)
    return dateFromUtcParts(year, month - 1, day)
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null

  const calendarDate = dateFromUtcParts(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate()
  )
  const utcHour = date.getUTCHours()

  if (boundary === "start" && utcHour >= 12) {
    calendarDate.setUTCDate(calendarDate.getUTCDate() + 1)
  }

  if (boundary === "end" && utcHour < 12) {
    calendarDate.setUTCDate(calendarDate.getUTCDate() - 1)
  }

  return calendarDate
}

export const buildBudgetPeriods = (
  startDate: Date,
  endDate: Date,
  months: number[],
  years: number[]
) => {
  const periods: string[] = []
  const startYear = startDate.getUTCFullYear()
  const startMonth = startDate.getUTCMonth()
  const endYear = endDate.getUTCFullYear()
  const endMonth = endDate.getUTCMonth()

  for (let year = startYear; year <= endYear; year++) {
    const firstMonth = year === startYear ? startMonth : 0
    const lastMonth = year === endYear ? endMonth : 11

    for (let month = firstMonth; month <= lastMonth; month++) {
      const oneBasedMonth = month + 1
      if (years.length > 0 && !years.includes(year)) continue
      if (months.length > 0 && !months.includes(oneBasedMonth)) continue
      periods.push(`${year}-${String(oneBasedMonth).padStart(2, "0")}`)
    }
  }

  return periods
}
