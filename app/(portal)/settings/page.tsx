"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { SectionHeader } from "@/components/ui/section-header"
import { MFASettings } from "@/components/mfa/mfa-settings"
import { useSession } from "next-auth/react"
import { Settings, User, Shield, Bell } from "lucide-react"

export default function SettingsPage() {
  const { data: session } = useSession()
  const userEmail = (session?.user as any)?.email

  return (
    <div className="space-y-6 p-6">
      <SectionHeader
        title="Settings"
        subtitle="Manage your account settings and preferences"
        actions={
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Settings className="h-4 w-4" />
            Account Settings
          </div>
        }
      />

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
                <p className="text-sm text-muted-foreground">
                  {userEmail || "N/A"}
                </p>
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