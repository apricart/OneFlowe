const COMMON_HEADERS = { "Content-Type": "application/json", "Cache-Control": "max-age=60, stale-while-revalidate=300" }

export async function jsonFetcher<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "max-age=60, stale-while-revalidate=300", // 1min cache, 5min stale
    },
    ...init,
  })
  if (!res.ok) {
    let message = "Request failed"
    try {
      const data = await res.json()
      message = data?.error || message
    } catch {}
    throw new Error(message)
  }
  return res.json()
}

export const apiFetch = jsonFetcher

// Optimized fetcher for SWR with better error handling
export async function fetcher<T>(url: string): Promise<T> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort("timeout" as any), 15000)

  try {
    const res = await fetch(url, {
      headers: COMMON_HEADERS,
      signal: controller.signal,
      cache: "default",
    })

    if (!res.ok) {
      const error = new Error(`HTTP ${res.status}: ${res.statusText}`)
      ;(error as any).status = res.status
      throw error
    }

    return res.json()
  } catch (error: any) {
    if (error?.name === "AbortError") {
      throw new Error("Request timed out. Please try again.")
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
  }
}
