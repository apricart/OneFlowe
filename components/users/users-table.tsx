"use client"

import useSWR from "swr"
import { useState } from "react"
import { jsonFetcher } from "@/lib/fetcher"
import { Button } from "@/components/ui/button"
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/skeleton"

type UserRow = { id: string; firstName: string; lastName: string; email: string; role: string; organizationId?: string | null; branchId?: string | null; phone?: string; loginCode?: string; mfaEnabled?: boolean; createdAt: string }
type UsersResp = { items: UserRow[] }

export function UsersTable() {
  const { data, error, mutate, isLoading } = useSWR<UsersResp>("/api/v1/users", jsonFetcher)
  const [filter, setFilter] = useState("")

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

  const f = filter.toLowerCase()
  const rows = (data?.items || []).filter((u) =>
    (u.firstName || "").toLowerCase().includes(f) ||
    (u.lastName || "").toLowerCase().includes(f) ||
    (u.email || "").toLowerCase().includes(f)
  )

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between gap-2">
        <Input placeholder="Search by name or email" value={filter} onChange={(e) => setFilter(e.target.value)} className="max-w-xs" />
        {isLoading && <span className="inline-flex items-center gap-2 text-sm text-muted-foreground"><Spinner size={14} /> Loading…</span>}
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Org</TableHead>
            <TableHead>Branch</TableHead>
            <TableHead>MFA</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="text-center text-sm text-muted-foreground">No users found.</TableCell>
            </TableRow>
          ) : (
            rows.map((u) => (
              <TableRow key={u.id}>
                <TableCell>{u.firstName} {u.lastName}</TableCell>
                <TableCell>{u.email}</TableCell>
                <TableCell>{u.phone || "-"}</TableCell>
                <TableCell>{u.role}</TableCell>
                <TableCell>{u.organizationId || "-"}</TableCell>
                <TableCell>{u.branchId || "-"}</TableCell>
                <TableCell>{u.mfaEnabled ? "✓" : "-"}</TableCell>
                <TableCell className="text-right space-x-2">
                  <Button size="sm" variant="destructive" onClick={() => deleteUser(u)}>Delete</Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
