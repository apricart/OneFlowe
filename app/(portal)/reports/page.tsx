import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"

export default async function ReportsPage() {
  const session = await getServerSession(authOptions)
  if (!session) return null
  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Reports</h1>
      <p className="text-sm text-muted-foreground">Analytics and trends across branches and orders.</p>
    </div>
  )
}


