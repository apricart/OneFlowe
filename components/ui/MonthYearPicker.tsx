"use client"

import * as React from "react"
import * as Select from "@radix-ui/react-select"
import * as Checkbox from "@radix-ui/react-checkbox"
import { ChevronDownIcon, CheckIcon } from "lucide-react"

const months = [
  { label: "January", value: "01" },
  { label: "February", value: "02" },
  { label: "March", value: "03" },
  { label: "April", value: "04" },
  { label: "May", value: "05" },
  { label: "June", value: "06" },
  { label: "July", value: "07" },
  { label: "August", value: "08" },
  { label: "September", value: "09" },
  { label: "October", value: "10" },
  { label: "November", value: "11" },
  { label: "December", value: "12" },
]

const years = ["2022", "2023", "2024", "2025"]

interface MonthYearPickerProps {
  selectedYear?: string
  selectedMonths?: string[]
  onYearChange?: (year: string) => void
  onMonthsChange?: (months: string[]) => void
}

export default function MonthYearPicker({
  selectedYear: controlledYear,
  selectedMonths: controlledMonths,
  onYearChange,
  onMonthsChange,
}: MonthYearPickerProps) {
  const [internalYear, setInternalYear] = React.useState("2025")
  const [internalMonths, setInternalMonths] = React.useState<string[]>([])

  // Use controlled values if provided, otherwise use internal state
  const year = controlledYear ?? internalYear
  const selectedMonths = controlledMonths ?? internalMonths

  const handleYearChange = (newYear: string) => {
    if (onYearChange) {
      onYearChange(newYear)
    } else {
      setInternalYear(newYear)
    }
  }

  const toggleMonth = (month: string) => {
    const newMonths = selectedMonths.includes(month)
      ? selectedMonths.filter((m) => m !== month)
      : [...selectedMonths, month]

    if (onMonthsChange) {
      onMonthsChange(newMonths)
    } else {
      setInternalMonths(newMonths)
    }
  }

  const selectAllMonths = () => {
    const allMonthValues = months.map(m => m.value)
    if (onMonthsChange) {
      onMonthsChange(allMonthValues)
    } else {
      setInternalMonths(allMonthValues)
    }
  }

  const clearAllMonths = () => {
    if (onMonthsChange) {
      onMonthsChange([])
    } else {
      setInternalMonths([])
    }
  }

  return (
    <div className="space-y-4 rounded-xl border-0 p-5 w-80 bg-white">
      {/* Year Select */}
      <div>
        <label className="block mb-2 text-sm font-semibold text-slate-700">Year</label>

        <Select.Root value={year} onValueChange={handleYearChange}>
          <Select.Trigger className="inline-flex w-full items-center justify-between rounded-lg border-2 border-slate-200 bg-white px-4 py-2.5 text-sm font-medium hover:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors">
            <Select.Value />
            <Select.Icon>
              <ChevronDownIcon className="h-4 w-4 text-slate-500" />
            </Select.Icon>
          </Select.Trigger>

          <Select.Portal>
            <Select.Content 
              className="bg-white border-2 border-slate-200 rounded-lg shadow-xl z-[100] overflow-hidden"
              position="popper"
              sideOffset={4}
            >
              <Select.Viewport className="p-1">
                {years.map((y) => (
                  <Select.Item
                    key={y}
                    value={y}
                    className="relative flex items-center px-8 py-2.5 text-sm rounded-md cursor-pointer hover:bg-indigo-50 focus:bg-indigo-50 outline-none data-[highlighted]:bg-indigo-50 transition-colors"
                  >
                    <Select.ItemIndicator className="absolute left-2 inline-flex items-center">
                      <CheckIcon className="h-4 w-4 text-indigo-600" />
                    </Select.ItemIndicator>
                    <Select.ItemText className="font-medium text-slate-900">{y}</Select.ItemText>
                  </Select.Item>
                ))}
              </Select.Viewport>
            </Select.Content>
          </Select.Portal>
        </Select.Root>
      </div>

      {/* Month Checkboxes */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <label className="block text-sm font-semibold text-slate-700">
            Months
          </label>
          <div className="flex gap-2">
            <button
              onClick={selectAllMonths}
              className="text-xs font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
            >
              Select All
            </button>
            <span className="text-slate-300">|</span>
            <button
              onClick={clearAllMonths}
              className="text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors"
            >
              Clear
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          {months.map((month) => (
            <label
              key={month.value}
              className="flex items-center gap-2.5 text-sm cursor-pointer group py-1.5 px-2 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <Checkbox.Root
                checked={selectedMonths.includes(month.value)}
                onCheckedChange={() => toggleMonth(month.value)}
                className="h-5 w-5 rounded-md border-2 border-slate-300 flex items-center justify-center data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600 hover:border-indigo-400 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              >
                <Checkbox.Indicator>
                  <CheckIcon className="h-3.5 w-3.5 text-white" />
                </Checkbox.Indicator>
              </Checkbox.Root>

              <span className="font-medium text-slate-700 group-hover:text-slate-900 transition-colors">
                {month.label}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Summary */}
      <div className="text-xs bg-gradient-to-br from-indigo-50 to-purple-50 p-3 rounded-lg border border-indigo-100">
        <div className="font-semibold text-indigo-900 mb-1">Selection Summary</div>
        <div className="text-slate-600">
          <span className="font-medium">Year:</span> {year}
        </div>
        <div className="text-slate-600">
          <span className="font-medium">Months:</span> {selectedMonths.length > 0 ? `${selectedMonths.length} selected` : "None"}
        </div>
      </div>
    </div>
  )
}