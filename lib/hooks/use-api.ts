import useSWR, { preload } from 'swr'
import { fetcher } from '@/lib/fetcher'

// Generic API hook with SWR caching
export function useAPI<T>(url: string | null, options?: any) {
  return useSWR<T>(url, fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
    dedupingInterval: 60000, // 1 minute deduplication
    errorRetryCount: 3,
    ...options,
  })
}

// Predefined hooks for common endpoints
export function useUsers(organizationId?: string) {
  const url = organizationId 
    ? `/api/v1/users?organizationId=${organizationId}` 
    : '/api/v1/users'
  return useAPI<{ items: any[] }>(url)
}

export function useOrganizations() {
  return useAPI<{ items: any[] }>('/api/v1/organizations')
}

export function useBranches(organizationId?: string) {
  const url = organizationId 
    ? `/api/v1/branches?organizationId=${organizationId}` 
    : '/api/v1/branches'
  return useAPI<{ items: any[] }>(url)
}

export function useRoles() {
  return useAPI<{ data: any[] }>('/api/v1/roles')
}

// Prefetch functions for critical data
export const prefetchData = {
  async users() {
    const { fetcher } = await import('@/lib/fetcher')
    preload('/api/v1/users', fetcher)
  },
  
  async organizations() {
    const { fetcher } = await import('@/lib/fetcher')
    preload('/api/v1/organizations', fetcher)
  },
  
  async roles() {
    const { fetcher } = await import('@/lib/fetcher')
    preload('/api/v1/roles', fetcher)
  },
}

export function useOrders(params?: { organizationId?: string; branchId?: string; status?: string }) {
  const qs = new URLSearchParams()
  if (params?.organizationId) qs.set('organizationId', params.organizationId)
  if (params?.branchId) qs.set('branchId', params.branchId)
  if (params?.status) qs.set('status', params.status)
  const url = `/api/v1/orders${qs.toString() ? `?${qs.toString()}` : ''}`
  return useAPI<{ items: any[] }>(url)
}
