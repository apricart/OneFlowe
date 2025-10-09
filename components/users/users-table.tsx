"use client"

import useSWR from "swr"
import { useState } from "react"
import { jsonFetcher } from "@/lib/fetcher"
import { Button } from "@/components/ui/button"
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table"
import { Input } from "@/components/ui/input"

type UserRow = { id: string; email: string; roleId: number; isActive: boolean }
type UsersResp = { data: UserRow[] }

export function UsersTable() {
  const { data, error, mutate, isLoading } = useSWR<UsersResp>("/api/v1/users", jsonFetcher)
  const [filter, setFilter] = useState("")

  async function toggleActive(u: UserRow) {
    await jsonFetcher(`/api/v1/users/${u.id}`, {
      method: "PATCH",
      body: JSON.stringify({ isActive: !u.isActive }),
    })
    mutate()
  }

  async function deleteUser(u: UserRow) {
    if (!confirm("Delete this user?")) return
    await jsonFetcher(`/api/v1/users/${u.id}`, { method: "DELETE" })
    mutate()
  }

  if (error)
    return (
      <div className="text-sm" style={{ color: "var(--color-destructive)" }}>
        {error.message}
      </div>
    )

  const rows = (data?.data || []).filter((u) => u.email.toLowerCase().includes(filter.toLowerCase()))

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between gap-2">
        <Input
          placeholder="Filter by email"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="max-w-xs"
        />
        {isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Email</TableHead>
            <TableHead>Role ID</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                No users found.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((u) => (
              <TableRow key={u.id}>
                <TableCell>{u.email}</TableCell>
                <TableCell>{u.roleId}</TableCell>
                <TableCell>
                  <span
                    className="px-2 py-0.5 rounded text-xs"
                    style={{
                      background: u.isActive
                        ? "color-mix(in oklab, var(--color-brand-accent), transparent 85%)"
                        : "color-mix(in oklab, var(--color-border), transparent 50%)",
                      color: "var(--color-foreground)",
                    }}
                  >
                    {u.isActive ? "Active" : "Inactive"}
                  </span>
                </TableCell>
                <TableCell className="text-right space-x-2">
                  <Button size="sm" variant="outline" onClick={() => toggleActive(u)}>
                    {u.isActive ? "Deactivate" : "Activate"}
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => deleteUser(u)}>
                    Delete
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
