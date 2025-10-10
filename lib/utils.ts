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