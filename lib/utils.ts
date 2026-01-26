import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function logger(scope: string, data: unknown) {
  const ts = new Date().toISOString()
  // eslint-disable-next-line no-console
  console.log(`[${ts}] [${scope}]`, data)
}

const pkFormatter = new Intl.NumberFormat("en-PK", {
  style: "currency",
  currency: "PKR",
})

export function formatPKR(value: number, options?: Intl.NumberFormatOptions) {
  if (options) {
    return new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", ...options }).format(value)
  }
  return pkFormatter.format(value)
}

/**
 * Escape special characters in SQL LIKE patterns
 * Prevents wildcard injection attacks where users could use % or _ to bypass search filters
 * 
 * @param input - Raw user input
 * @returns Escaped string safe for LIKE queries
 */
export function escapeLikePattern(input: string): string {
  if (!input) return input
  // Escape %, _, and \ which have special meaning in LIKE patterns
  return input.replace(/[%_\\]/g, '\\$&')
}

/**
 * Sanitize string input - removes null bytes and trims whitespace
 * Use for all user-provided string inputs
 */
export function sanitizeInput(input: string): string {
  if (!input) return input
  return input.replace(/\0/g, '').trim()
}