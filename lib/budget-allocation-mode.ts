export const BUDGET_ALLOCATION_MODE_SETTING_KEY = "budget_allocation_mode"

export const BUDGET_ALLOCATION_MODES = ["money", "quantity"] as const

export type BudgetAllocationMode = typeof BUDGET_ALLOCATION_MODES[number]

export const DEFAULT_BUDGET_ALLOCATION_MODE: BudgetAllocationMode = "money"

export function isBudgetAllocationMode(value: unknown): value is BudgetAllocationMode {
  return typeof value === "string" && BUDGET_ALLOCATION_MODES.includes(value as BudgetAllocationMode)
}

export function parseBudgetAllocationMode(value: unknown): BudgetAllocationMode {
  return isBudgetAllocationMode(value) ? value : DEFAULT_BUDGET_ALLOCATION_MODE
}
