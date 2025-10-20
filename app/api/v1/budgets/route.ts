import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { db } from "@/lib/db"
import { budgets } from "@/db/schema"
import { and, eq } from "drizzle-orm"

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const role = (session.user as any).role
    const orgId = (session.user as any).organizationId
    const userBranchId = (session.user as any).branchId

    const { searchParams } = new URL(req.url)
    const branchIdParam = searchParams.get("branchId")
    const branchId = (role === 'HEAD_OFFICE' || role === 'SUPER_ADMIN') && branchIdParam ? parseInt(branchIdParam) : parseInt(userBranchId)
    if (!branchId) return NextResponse.json({ error: 'Branch ID required' }, { status: 400 })

    const [b] = await db.select().from(budgets).where(eq(budgets.branchId, branchId)).limit(1)
    if (!b) return NextResponse.json({ error: 'Budget not configured' }, { status: 404 })

    const remainingCents = (b.amountAllocatedCents + b.amountCreditedCents) - (b.amountSpentCents + b.amountHeldCents)
    return NextResponse.json({
      branchId,
      amountAllocatedCents: b.amountAllocatedCents,
      amountSpentCents: b.amountSpentCents,
      amountHeldCents: b.amountHeldCents,
      amountCreditedCents: b.amountCreditedCents,
      remainingCents,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}


