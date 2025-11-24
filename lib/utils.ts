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