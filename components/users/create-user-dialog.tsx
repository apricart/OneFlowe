"use client"

import { useEffect, useState } from "react"
import useSWR from "swr"
import { jsonFetcher } from "@/lib/fetcher"
import { Button } from "@/components/ui/button"
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

type RolesResp = { data: { id: number; name: string }[] }

export function CreateUserDialog() {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [role, setRole] = useState<string>("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { data: roles, error: rolesError } = useSWR<RolesResp>(open ? "/api/v1/roles" : null, jsonFetcher)

  useEffect(() => {
    if (!open) {
      setEmail("")
      setPassword("")
      setRole("")
      setError(null)
    }
  }, [open])

  async function onCreate() {
    setSubmitting(true)
    setError(null)
    try {
      if (!email || !password || !role) {
        setError("All fields are required")
        setSubmitting(false)
        return
      }
      await jsonFetcher("/api/v1/users", {
        method: "POST",
        body: JSON.stringify({ name: email.split('@')[0], email, role, organizationId: null, branchId: null }),
      })
      setOpen(false)
      // Hard refresh users table by reloading page, or better: send custom event
      window.location.reload()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button style={{ background: "var(--color-brand-primary)", color: "white" }}>New User</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create User</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>Role</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger>
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                {(["SUPER_ADMIN", "HEAD_OFFICE", "BRANCH_ADMIN"]).map((name) => (
                  <SelectItem key={name} value={name}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {rolesError && (
              <p className="text-sm" style={{ color: "var(--color-destructive)" }}>
                Failed to load roles
              </p>
            )}
          </div>
          {error && (
            <p className="text-sm" style={{ color: "var(--color-destructive)" }}>
              {error}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={onCreate}
            disabled={submitting}
            style={{ background: "var(--color-brand-accent)", color: "black" }}
          >
            {submitting ? "Creating…" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
