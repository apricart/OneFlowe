export type Role = "SUPER_ADMIN" | "HEAD_OFFICE" | "BRANCH_ADMIN"

export type Organization = {
  id: string
  name: string
  code: string
  status: "active" | "inactive"
  createdAt: string
}

export type Branch = {
  id: string
  organizationId: string
  name: string
  code: string
  status: "active" | "inactive"
  createdAt: string
}

export type User = {
  id: string
  name: string
  email: string
  role: Role
  organizationId?: string | null
  branchId?: string | null
  createdAt: string
}

type Store = {
  organizations: Organization[]
  branches: Branch[]
  users: User[]
}

declare global {
  // eslint-disable-next-line no-var
  var __ONEFLOWE_STORE__: Store | undefined
}

function getStore(): Store {
  if (!globalThis.__ONEFLOWE_STORE__) {
    globalThis.__ONEFLOWE_STORE__ = {
      organizations: [],
      branches: [],
      users: [],
    }
  }
  return globalThis.__ONEFLOWE_STORE__!
}

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`
}

export const store = {
  // Orgs
  listOrganizations(): Organization[] {
    return getStore().organizations
  },
  getOrganization(id: string): Organization | undefined {
    return getStore().organizations.find((o) => o.id === id)
  },
  createOrganization(input: Pick<Organization, "name" | "code" | "status">): Organization {
    const now = new Date().toISOString()
    const org: Organization = { id: uid("org"), createdAt: now, ...input }
    getStore().organizations.push(org)
    return org
  },
  updateOrganization(id: string, patch: Partial<Omit<Organization, "id" | "createdAt">>): Organization {
    const org = this.getOrganization(id)
    if (!org) throw new Error("Organization not found")
    Object.assign(org, patch)
    return org
  },
  deleteOrganization(id: string): void {
    const s = getStore()
    s.organizations = s.organizations.filter((o) => o.id !== id)
    // cascade delete branches and unlink users
    s.branches = s.branches.filter((b) => b.organizationId !== id)
    s.users = s.users.map((u) => (u.organizationId === id ? { ...u, organizationId: null, branchId: null } : u))
  },

  // Branches
  listBranches(organizationId?: string): Branch[] {
    const s = getStore().branches
    return organizationId ? s.filter((b) => b.organizationId === organizationId) : s
  },
  getBranch(id: string): Branch | undefined {
    return getStore().branches.find((b) => b.id === id)
  },
  createBranch(input: Pick<Branch, "organizationId" | "name" | "code" | "status">): Branch {
    const now = new Date().toISOString()
    const b: Branch = { id: uid("br"), createdAt: now, ...input }
    getStore().branches.push(b)
    return b
  },
  updateBranch(id: string, patch: Partial<Omit<Branch, "id" | "createdAt">>): Branch {
    const b = this.getBranch(id)
    if (!b) throw new Error("Branch not found")
    Object.assign(b, patch)
    return b
  },
  deleteBranch(id: string): void {
    const s = getStore()
    const orgId = s.branches.find((b) => b.id === id)?.organizationId
    s.branches = s.branches.filter((b) => b.id !== id)
    // unlink users assigned to this branch
    s.users = s.users.map((u) => (u.branchId === id ? { ...u, branchId: null } : u))
    // if needed, also handle if org had no branches left
    if (orgId && !s.branches.some((b) => b.organizationId === orgId)) {
      // no-op
    }
  },

  // Users (skeleton – useful as we wire HO/Branch Admin later)
  listUsers(organizationId?: string): User[] {
    const s = getStore().users
    return organizationId ? s.filter((u) => u.organizationId === organizationId) : s
  },
  createUser(input: Omit<User, "id" | "createdAt">): User {
    const now = new Date().toISOString()
    const u: User = { id: uid("usr"), createdAt: now, ...input }
    getStore().users.push(u)
    return u
  },
  getUser(id: string): User | undefined {
    return getStore().users.find((u) => u.id === id)
  },
  deleteUser(id: string): void {
    const s = getStore()
    s.users = s.users.filter((u) => u.id !== id)
  },
}
