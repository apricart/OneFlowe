import "next-auth"
import { DefaultSession } from "next-auth"
import { Role } from "@/lib/rbac"

declare module "next-auth" {
    interface User {
        id: string
        role: Role
        organizationId: number | null
        branchId: number | null
        fullName: string | null
        isEmployee: boolean
        employeeId?: number | null
    }

    interface Session {
        user: {
            id: string
            role: Role
            organizationId: number | null
            branchId: number | null
            fullName: string | null
            isEmployee: boolean
            employeeId?: number | null
        } & DefaultSession["user"]
    }
}

declare module "next-auth/jwt" {
    interface JWT {
        role: Role
        organizationId: number | null
        branchId: number | null
        fullName: string | null
        isEmployee: boolean
        employeeId?: number | null
    }
}
