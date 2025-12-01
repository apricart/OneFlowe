"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { MFASettings } from "@/components/mfa/mfa-settings"
import { useSession } from "next-auth/react"
import { Settings, User, Shield, Bell, Building2, GitBranch, Mail, Clock3 } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function SettingsPage() {
  const { data: session } = useSession()
  const userEmail = (session?.user as any)?.email

  const heroStats = [
    {
      label: "Role",
      value: ((session?.user as any)?.role || "N/A").toString().replace(/_/g, " "),
      icon: Shield,
      gradient: "from-sky-400 to-indigo-500",
      sub: "Current permissions",
    },
    {
      label: "Organization",
      value: (session?.user as any)?.organizationName || "Unassigned",
      icon: Building2,
      gradient: "from-purple-400 to-fuchsia-500",
      sub: "Primary org",
    },
    {
      label: "Branch",
      value: (session?.user as any)?.branchName || "All branches",
      icon: GitBranch,
      gradient: "from-emerald-400 to-teal-500",
      sub: "Active branch context",
    },
    {
      label: "Last login",
      value: new Date().toLocaleDateString(),
      icon: Clock3,
      gradient: "from-amber-400 to-orange-500",
      sub: new Date().toLocaleTimeString(),
    },
  ]

  return (
    <div className="space-y-6 p-6">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#121F6F] via-[#2C3AD1] to-[#7C3AED] px-6 py-6 text-white shadow-xl ring-1 ring-indigo-500/30">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs tracking-[0.2em] text-white/70">HEAD OFFICE · ACCOUNT</p>
            <h1 className="text-3xl font-semibold">Preferences & security</h1>
            <p className="text-sm text-white/80">
              Review your profile, MFA, and notifications to keep your workspace secure.
            </p>
          </div>
          <Button variant="secondary" size="sm" className="gap-2 bg-white/15 text-white hover:bg-white/25 border-0">
            <Settings className="h-4 w-4" />
            Refresh data
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {heroStats.map((stat) => {
          const Icon = stat.icon
          return (
            <Card key={stat.label} className="rounded-2xl border-0 p-4 shadow-md">
              <div className={`mb-3 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br ${stat.gradient} text-white shadow-inner`}>
                <Icon className="h-5 w-5" />
              </div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{stat.label}</p>
              <p className="text-2xl font-semibold text-slate-900 capitalize">{stat.value}</p>
              <p className="text-sm text-muted-foreground">{stat.sub}</p>
            </Card>
          )
        })}
      </div>


      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Profile Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Profile Information
            </CardTitle>
            <CardDescription>
              Manage your personal information and account details
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Full Name</label>
                <p className="text-sm text-muted-foreground">
                  {(session?.user as any)?.fullName || "N/A"}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium">Email Address</label>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Mail className="h-4 w-4" />
                  <span>{userEmail || "N/A"}</span>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Role</label>
                <p className="text-sm text-muted-foreground">
                  {(session?.user as any)?.role || "N/A"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Security Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Security Settings
            </CardTitle>
            <CardDescription>
              Manage your account security and authentication
            </CardDescription>
          </CardHeader>
          <CardContent>
            <MFASettings userEmail={userEmail} />
          </CardContent>
        </Card>

        {/* Notification Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notifications
            </CardTitle>
            <CardDescription>
              Configure your notification preferences
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                <p>Notification settings will be available in a future update.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* System Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              System Information
            </CardTitle>
            <CardDescription>
              View system information and account details
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Organization</label>
                <p className="text-sm text-muted-foreground">
                  {(session?.user as any)?.organizationName || "N/A"}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium">Branch</label>
                <p className="text-sm text-muted-foreground">
                  {(session?.user as any)?.branchName || "N/A"}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium">Last Login</label>
                <p className="text-sm text-muted-foreground">
                  {new Date().toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}