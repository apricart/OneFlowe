import { db, withSuperAdmin } from "@/lib/db"
import { roles, rolePermissions, auditLogs } from "@/db/schema"
import { eq } from "drizzle-orm"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    
    const user = session.user as any
    if (user.role !== "SUPER_ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const roleId = req.nextUrl.searchParams.get("roleId")

    const result = await withSuperAdmin(async (tx) => {
      if (roleId) {
        const permissions = await tx
          .select()
          .from(rolePermissions)
          .where(eq(rolePermissions.roleId, parseInt(roleId)))

        return { permissions }
      }

      const allRoles = await tx.select().from(roles)
      const allPermissions = await tx.select().from(rolePermissions)

      return {
        roles: allRoles,
        permissions: allPermissions,
      }
    })

    return NextResponse.json({ data: result })
  } catch (err: any) {
    console.error("Permissions GET error:", err)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    
    const user = session.user as any
    if (user.role !== "SUPER_ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const body = await req.json()
    const { roleId, permissionKey, allowed = true } = body

    if (!roleId || !permissionKey) {
      return NextResponse.json({ error: "roleId and permissionKey are required" }, { status: 400 })
    }

    const result = await withSuperAdmin(async (tx) => {
      const [newPermission] = await tx
        .insert(rolePermissions)
        .values({
          roleId,
          permissionKey,
          allowed,
        })
        .returning()

      await tx.insert(auditLogs).values({
        userId: user.id,
        action: "CREATE_PERMISSION",
        entity: "role_permissions",
        entityId: newPermission.id.toString(),
        metadata: { roleId, permissionKey, allowed },
      })

      return newPermission
    })

    return NextResponse.json({ data: result })
  } catch (error: any) {
    console.error("Permissions POST error:", error)
    return NextResponse.json({ error: "Failed to create permission" }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    
    const user = session.user as any
    if (user.role !== "SUPER_ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const body = await req.json()
    const { roleId, permissions } = body

    if (!roleId || !permissions || !Array.isArray(permissions)) {
      return NextResponse.json({ error: "roleId and permissions array are required" }, { status: 400 })
    }

    await withSuperAdmin(async (tx) => {
      // 1. Delete existing
      await tx.delete(rolePermissions).where(eq(rolePermissions.roleId, roleId))

      // 2. Insert new
      if (permissions.length > 0) {
        const permissionValues = permissions.map((key: string) => ({
          roleId,
          permissionKey: key,
          allowed: true,
        }))
        await tx.insert(rolePermissions).values(permissionValues)
      }

      // 3. Update roles jsonb
      const permissionsObj = permissions.reduce((acc: any, key: string) => {
        acc[key] = true
        return acc
      }, {})

      await tx
        .update(roles)
        .set({
          permissions: permissionsObj,
          updatedAt: new Date(),
        })
        .where(eq(roles.id, roleId))

      // 4. Audit
      await tx.insert(auditLogs).values({
        userId: user.id,
        action: "UPDATE_ROLE_PERMISSIONS",
        entity: "roles",
        entityId: roleId.toString(),
        metadata: { permissions },
      })
    })

    return NextResponse.json({ message: "Permissions updated successfully" })
  } catch (error: any) {
    console.error("Permissions PUT error:", error)
    return NextResponse.json({ error: "Failed to update permissions" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    
    const user = session.user as any
    if (user.role !== "SUPER_ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const { searchParams } = req.nextUrl
    const id = searchParams.get("id")

    if (!id) return NextResponse.json({ error: "Permission id is required" }, { status: 400 })

    await withSuperAdmin(async (tx) => {
      await tx.delete(rolePermissions).where(eq(rolePermissions.id, parseInt(id)))

      await tx.insert(auditLogs).values({
        userId: user.id,
        action: "DELETE_PERMISSION",
        entity: "role_permissions",
        entityId: id,
      })
    })

    return NextResponse.json({ message: "Permission deleted successfully" })
  } catch (error: any) {
    console.error("Permissions DELETE error:", error)
    return NextResponse.json({ error: "Failed to delete permission" }, { status: 500 })
  }
}


