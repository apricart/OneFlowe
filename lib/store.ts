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

export type OrderStatus = "PENDING" | "APPROVED" | "REJECTED" | "FULFILLED"

export type OrderItem = {
  sku: string
  name: string
  quantity: number
  unit: string
}

export type Order = {
  id: string
  organizationId: string
  branchId: string
  requestedByUserId: string
  status: OrderStatus
  items: OrderItem[]
  note?: string
  createdAt: string
  updatedAt: string
}

type Store = {
  organizations: Organization[]
  branches: Branch[]
  users: User[]
  orders: Order[]
  warehouses: Warehouse[]
  suppliers: Supplier[]
  inventoryTx: InventoryTransaction[]
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
      orders: [],
      warehouses: [],
      suppliers: [],
      inventoryTx: [],
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

  // Orders
  listOrders(filters?: { organizationId?: string; branchId?: string; status?: OrderStatus }): Order[] {
    const s = getStore().orders
    return s.filter((o) => {
      if (filters?.organizationId && o.organizationId !== filters.organizationId) return false
      if (filters?.branchId && o.branchId !== filters.branchId) return false
      if (filters?.status && o.status !== filters.status) return false
      return true
    })
  },
  getOrder(id: string): Order | undefined {
    return getStore().orders.find((o) => o.id === id)
  },
  createOrder(input: Omit<Order, "id" | "createdAt" | "updatedAt" | "status"> & { status?: OrderStatus }): Order {
    const now = new Date().toISOString()
    const order: Order = {
      id: uid("ord"),
      createdAt: now,
      updatedAt: now,
      status: input.status || "PENDING",
      organizationId: input.organizationId,
      branchId: input.branchId,
      requestedByUserId: input.requestedByUserId,
      items: input.items,
      note: input.note,
    }
    getStore().orders.push(order)
    return order
  },
  updateOrder(id: string, patch: Partial<Omit<Order, "id" | "createdAt">>): Order {
    const o = this.getOrder(id)
    if (!o) throw new Error("Order not found")
    Object.assign(o, patch)
    o.updatedAt = new Date().toISOString()
    return o
  },
  deleteOrder(id: string): void {
    const s = getStore()
    s.orders = s.orders.filter((o) => o.id !== id)
  },

  // Warehouses
  listWarehouses(filters?: { organizationId?: string; branchId?: string; isMain?: boolean }): Warehouse[] {
    const s = getStore().warehouses
    return s.filter((w) => {
      if (filters?.organizationId && w.organizationId !== filters.organizationId) return false
      if (filters?.branchId && w.branchId !== filters.branchId) return false
      if (typeof filters?.isMain === 'boolean' && !!w.isMain !== filters.isMain) return false
      return true
    })
  },
  getWarehouse(id: string): Warehouse | undefined {
    return getStore().warehouses.find((w) => w.id === id)
  },
  createWarehouse(input: Omit<Warehouse, "id" | "createdAt" | "updatedAt">): Warehouse {
    const now = new Date().toISOString()
    const w: Warehouse = { id: uid("wh"), createdAt: now, updatedAt: now, ...input }
    getStore().warehouses.push(w)
    return w
  },
  updateWarehouse(id: string, patch: Partial<Omit<Warehouse, "id" | "createdAt">>): Warehouse {
    const w = this.getWarehouse(id)
    if (!w) throw new Error("Warehouse not found")
    Object.assign(w, patch)
    w.updatedAt = new Date().toISOString()
    return w
  },
  deleteWarehouse(id: string): void {
    const s = getStore()
    s.warehouses = s.warehouses.filter((w) => w.id !== id)
  },

  // Suppliers
  listSuppliers(filters?: { organizationId?: string; branchId?: string }): Supplier[] {
    const s = getStore().suppliers
    return s.filter((sup) => {
      if (filters?.organizationId && sup.organizationId !== filters.organizationId) return false
      if (filters?.branchId && sup.branchId !== filters.branchId) return false
      return true
    })
  },
  getSupplier(id: string): Supplier | undefined {
    return getStore().suppliers.find((s) => s.id === id)
  },
  createSupplier(input: Omit<Supplier, "id" | "createdAt" | "updatedAt">): Supplier {
    const now = new Date().toISOString()
    const sup: Supplier = { id: uid("sup"), createdAt: now, updatedAt: now, ...input }
    getStore().suppliers.push(sup)
    return sup
  },
  updateSupplier(id: string, patch: Partial<Omit<Supplier, "id" | "createdAt">>): Supplier {
    const s = this.getSupplier(id)
    if (!s) throw new Error("Supplier not found")
    Object.assign(s, patch)
    s.updatedAt = new Date().toISOString()
    return s
  },
  deleteSupplier(id: string): void {
    const s = getStore()
    s.suppliers = s.suppliers.filter((x) => x.id !== id)
  },

  // Inventory Transactions (add/adjust)
  listInventoryTransactions(filters?: { organizationId?: string; branchId?: string; type?: InventoryTransaction["type"] }): InventoryTransaction[] {
    const s = getStore().inventoryTx
    return s.filter((t) => {
      if (filters?.organizationId && t.organizationId !== filters.organizationId) return false
      if (filters?.branchId && t.branchId !== filters.branchId) return false
      if (filters?.type && t.type !== filters.type) return false
      return true
    })
  },
  createInventoryTransaction(input: Omit<InventoryTransaction, "id" | "createdAt">): InventoryTransaction {
    const now = new Date().toISOString()
    const tx: InventoryTransaction = { id: uid("itx"), createdAt: now, ...input }
    getStore().inventoryTx.push(tx)
    return tx
  },
}

export type Warehouse = {
  id: string
  organizationId: string
  branchId: string
  name: string
  code: string
  contact?: string
  email?: string
  description?: string
  isMain?: boolean
  createdAt: string
  updatedAt: string
}

export type Supplier = {
  id: string
  organizationId: string
  branchId: string
  name: string
  address?: string
  contact?: string
  email?: string
  description?: string
  createdAt: string
  updatedAt: string
}

export type InventoryTransaction = {
  id: string
  organizationId: string
  branchId: string
  warehouseId?: string
  type: "ADD" | "ADJUST"
  note?: string
  items: Array<{ sku: string; name: string; quantity: number; unit: string }>
  createdAt: string
}
