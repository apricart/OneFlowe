export async function jsonFetcher<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...init })
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
