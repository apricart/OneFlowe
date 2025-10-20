import {
  pgTable,
  serial,
  varchar,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
  uuid,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core"

export const organizations = pgTable(
  "organizations",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    code: varchar("code", { length: 64 }),
    status: varchar("status", { length: 32 }).default("active"),
    logoUrl: varchar("logo_url", { length: 512 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    orgNameIdx: uniqueIndex("org_name_idx").on(t.name),
    // uniqueIndex("org_code_idx").on(t.code), // uncomment when data is ready to enforce
    orgStatusIdx: index("org_status_idx").on(t.status),
  }),
)

export const branches = pgTable(
  "branches",
  {
    id: serial("id").primaryKey(),
    organizationId: integer("organization_id")
      .references(() => organizations.id)
      .notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    // Avoid circular type init between users <-> branches; store admin user id without FK
    adminUserId: uuid("admin_user_id"),
    code: varchar("code", { length: 64 }),
    status: varchar("status", { length: 32 }).default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    orgIdx: index("branches_org_idx").on(t.organizationId),
    nameIdx: index("branches_name_idx").on(t.name),
    statusIdx: index("branches_status_idx").on(t.status),
  }),
)

export const roles = pgTable(
  "roles",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 64 }).notNull(), // SUPER_ADMIN | HEAD_OFFICE | BRANCH_ADMIN
    description: text("description"),
    permissions: jsonb("permissions").$type<Record<string, boolean>>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    nameIdx: uniqueIndex("roles_name_idx").on(t.name),
  }),
)

export const rolePermissions = pgTable(
  "role_permissions",
  {
    id: serial("id").primaryKey(),
    roleId: integer("role_id").references(() => roles.id).notNull(),
    permissionKey: varchar("permission_key", { length: 128 }).notNull(),
    allowed: boolean("allowed").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    rolePermIdx: index("role_permissions_role_idx").on(t.roleId),
  }),
)

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: varchar("email", { length: 255 }).notNull(),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    roleId: integer("role_id")
      .references(() => roles.id)
      .notNull(),
    isActive: boolean("is_active").notNull().default(true),
    fullName: varchar("full_name", { length: 255 }),
    firstName: varchar("first_name", { length: 100 }),
    lastName: varchar("last_name", { length: 100 }),
    phone: varchar("phone", { length: 32 }),
    loginCode: varchar("login_code", { length: 64 }),
    mfaEnabled: boolean("mfa_enabled").notNull().default(false),
    organizationId: integer("organization_id").references(() => organizations.id),
    // Avoid circular type init; store branch id without FK
    branchId: integer("branch_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    emailIdx: uniqueIndex("users_email_idx").on(t.email),
    roleIdx: index("users_role_idx").on(t.roleId),
    activeIdx: index("users_active_idx").on(t.isActive),
    loginCodeIdx: uniqueIndex("users_login_code_idx").on(t.loginCode),
    orgIdx: index("users_org_idx").on(t.organizationId),
    branchIdx: index("users_branch_idx").on(t.branchId),
  }),
)

export const mfaCodes = pgTable(
  "mfa_codes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").references(() => users.id).notNull(),
    code: varchar("code", { length: 6 }).notNull(),
    type: varchar("type", { length: 20 }).notNull(), // 'LOGIN', 'VERIFY_EMAIL', 'RESET_PASSWORD'
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    attempts: integer("attempts").notNull().default(0),
    isUsed: boolean("is_used").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    userIdx: index("mfa_codes_user_idx").on(t.userId),
    codeIdx: index("mfa_codes_code_idx").on(t.code),
    expiresIdx: index("mfa_codes_expires_idx").on(t.expiresAt),
    typeIdx: index("mfa_codes_type_idx").on(t.type),
  }),
)

export const categories = pgTable(
  "categories",
  {
    id: serial("id").primaryKey(),
    organizationId: integer("organization_id").references(() => organizations.id),
    name: varchar("name", { length: 255 }).notNull(),
    parentId: integer("parent_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    nameIdx: index("categories_name_idx").on(t.name),
    catOrgIdx: index("categories_org_idx").on(t.organizationId),
  }),
)

export const products = pgTable(
  "products",
  {
    id: serial("id").primaryKey(),
    organizationId: integer("organization_id").references(() => organizations.id),
    name: varchar("name", { length: 255 }).notNull(),
    categoryId: integer("category_id")
      .references(() => categories.id)
      .notNull(),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    catIdx: index("products_category_idx").on(t.categoryId),
    nameIdx: index("products_name_idx").on(t.name),
    prodOrgIdx: index("products_org_idx").on(t.organizationId),
  }),
)

export const skus = pgTable(
  "skus",
  {
    id: serial("id").primaryKey(),
    organizationId: integer("organization_id").references(() => organizations.id),
    productId: integer("product_id")
      .references(() => products.id)
      .notNull(),
    sku: varchar("sku", { length: 128 }).notNull(),
    unit: varchar("unit", { length: 64 }).notNull(), // e.g. 'box', 'kg'
    priceCents: integer("price_cents").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    productIdx: index("skus_product_idx").on(t.productId),
    skuIdx: uniqueIndex("skus_sku_idx").on(t.sku),
    skusOrgIdx: index("skus_org_idx").on(t.organizationId),
  }),
)

export const inventory = pgTable(
  "inventory",
  {
    id: serial("id").primaryKey(),
    organizationId: integer("organization_id").references(() => organizations.id),
    branchId: integer("branch_id")
      .references(() => branches.id)
      .notNull(),
    skuId: integer("sku_id")
      .references(() => skus.id)
      .notNull(),
    quantity: integer("quantity").notNull().default(0),
    reservedQuantity: integer("reserved_quantity").notNull().default(0),
    reorderThreshold: integer("reorder_threshold").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    byBranchSku: uniqueIndex("inventory_branch_sku_uq").on(t.branchId, t.skuId),
    branchIdx: index("inventory_branch_idx").on(t.branchId),
    inventoryOrgIdx: index("inventory_org_idx").on(t.organizationId),
    inventoryOrgBranchSkuIdx: index("inventory_org_branch_sku_idx").on(t.organizationId, t.branchId, t.skuId),
  }),
)

export const warehouses = pgTable(
  "warehouses",
  {
    id: serial("id").primaryKey(),
    organizationId: integer("organization_id")
      .references(() => organizations.id)
      .notNull(),
    branchId: integer("branch_id")
      .references(() => branches.id)
      .notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    code: varchar("code", { length: 64 }),
    contact: varchar("contact", { length: 255 }),
    email: varchar("email", { length: 255 }),
    description: text("description"),
    isMain: boolean("is_main").default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    orgIdx: index("warehouses_org_idx").on(t.organizationId),
    branchIdx: index("warehouses_branch_idx").on(t.branchId),
    nameIdx: index("warehouses_name_idx").on(t.name),
    codeIdx: index("warehouses_code_idx").on(t.code),
    mainIdx: index("warehouses_main_idx").on(t.isMain),
  }),
)

export const headOffices = pgTable(
  "head_offices",
  {
    id: serial("id").primaryKey(),
    organizationId: integer("organization_id").references(() => organizations.id).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    contactEmail: varchar("contact_email", { length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    headOrgIdx: index("head_offices_org_idx").on(t.organizationId),
  }),
)

export const suppliers = pgTable(
  "suppliers",
  {
    id: serial("id").primaryKey(),
    organizationId: integer("organization_id")
      .references(() => organizations.id)
      .notNull(),
    branchId: integer("branch_id")
      .references(() => branches.id)
      .notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    address: text("address"),
    contact: varchar("contact", { length: 255 }),
    email: varchar("email", { length: 255 }),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    orgIdx: index("suppliers_org_idx").on(t.organizationId),
    branchIdx: index("suppliers_branch_idx").on(t.branchId),
    nameIdx: index("suppliers_name_idx").on(t.name),
  }),
)

export const budgets = pgTable(
  "budgets",
  {
    id: serial("id").primaryKey(),
    organizationId: integer("organization_id")
      .references(() => organizations.id)
      .notNull(),
    branchId: integer("branch_id")
      .references(() => branches.id)
      .notNull(),
    period: varchar("period", { length: 16 }).notNull(), // e.g. '2025-10'
    amountAllocatedCents: integer("amount_allocated_cents").notNull().default(0),
    amountSpentCents: integer("amount_spent_cents").notNull().default(0),
    amountHeldCents: integer("amount_held_cents").notNull().default(0),
    amountCreditedCents: integer("amount_credited_cents").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    branchPeriodUq: uniqueIndex("budgets_branch_period_uq").on(t.branchId, t.period),
    orgIdx: index("budgets_org_idx").on(t.organizationId),
    branchIdx: index("budgets_branch_idx").on(t.branchId),
  }),
)

export const organizationSettings = pgTable(
  "organization_settings",
  {
    id: serial("id").primaryKey(),
    organizationId: integer("organization_id").references(() => organizations.id).notNull(),
    key: varchar("key", { length: 128 }).notNull(),
    value: jsonb("value"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    orgSettingsOrgIdx: index("org_settings_org_idx").on(t.organizationId),
  }),
)

export const orgMetrics = pgTable(
  "org_metrics",
  {
    id: serial("id").primaryKey(),
    organizationId: integer("organization_id").references(() => organizations.id),
    month: varchar("month", { length: 16 }),
    totalOrders: integer("total_orders"),
    totalSpendCents: integer("total_spend_cents"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    orgMetricsOrgIdx: index("org_metrics_org_idx").on(t.organizationId),
  }),
)

export const orders = pgTable(
  "orders",
  {
    id: serial("id").primaryKey(),
    tid: varchar("tid", { length: 26 }).notNull().unique(), // Transaction ID
    organizationId: integer("organization_id").references(() => organizations.id),
    branchId: integer("branch_id")
      .references(() => branches.id)
      .notNull(),
    status: varchar("status", { length: 32 }).notNull().default("PENDING"), // PENDING/APPROVED/REJECTED/FULFILLED/REFUNDED
    subtotalCents: integer("subtotal_cents").notNull().default(0),
    taxCents: integer("tax_cents").notNull().default(0),
    totalCents: integer("total_cents").notNull().default(0),
    notes: text("notes"),
    createdByUserId: uuid("created_by_user_id")
      .references(() => users.id)
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    tidIdx: uniqueIndex("orders_tid_idx").on(t.tid),
    branchIdx: index("orders_branch_idx").on(t.branchId),
    statusIdx: index("orders_status_idx").on(t.status),
    createdIdx: index("orders_created_idx").on(t.createdAt),
    ordersOrgIdx: index("orders_org_idx").on(t.organizationId),
    ordersOrgBranchStatusIdx: index("orders_org_branch_status_idx").on(t.organizationId, t.branchId, t.status),
  }),
)

export const orderItems = pgTable(
  "order_items",
  {
    id: serial("id").primaryKey(),
    organizationId: integer("organization_id").references(() => organizations.id),
    orderId: integer("order_id")
      .references(() => orders.id)
      .notNull(),
    globalProductId: integer("global_product_id")
      .references(() => globalProducts.id)
      .notNull(),
    // Product snapshot - store at time of order for historical accuracy
    productName: varchar("product_name", { length: 255 }).notNull(),
    productCode: varchar("product_code", { length: 128 }),
    unit: varchar("unit", { length: 64 }).notNull(),
    quantity: integer("quantity").notNull(),
    priceCents: integer("price_cents").notNull(), // Price at time of order
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    orderIdx: index("order_items_order_idx").on(t.orderId),
    orderItemsOrgIdx: index("order_items_org_idx").on(t.organizationId),
    globalProductIdx: index("order_items_product_idx").on(t.globalProductId),
  }),
)

export const refunds = pgTable(
  "refunds",
  {
    id: serial("id").primaryKey(),
    organizationId: integer("organization_id").references(() => organizations.id),
    orderId: integer("order_id")
      .references(() => orders.id)
      .notNull(),
    amountCents: integer("amount_cents").notNull(),
    reason: varchar("reason", { length: 255 }),
    processedByUserId: uuid("processed_by_user_id")
      .references(() => users.id)
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    orderIdx: index("refunds_order_idx").on(t.orderId),
    refundsOrgIdx: index("refunds_org_idx").on(t.organizationId),
    processedByIdx: index("refunds_processed_by_idx").on(t.processedByUserId),
  }),
)

export const notifications = pgTable(
  "notifications",
  {
    id: serial("id").primaryKey(),
    userId: uuid("user_id")
      .references(() => users.id)
      .notNull(),
    organizationId: integer("organization_id").references(() => organizations.id),
    branchId: integer("branch_id").references(() => branches.id),
    type: varchar("type", { length: 64 }).notNull(),
    targetRole: varchar("target_role", { length: 64 }),
    message: text("message").notNull(),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    userIdx: index("notifications_user_idx").on(t.userId),
    typeIdx: index("notifications_type_idx").on(t.type),
    notiOrgIdx: index("notifications_org_idx").on(t.organizationId),
    notiBranchIdx: index("notifications_branch_idx").on(t.branchId),
  }),
)

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: serial("id").primaryKey(),
    userId: uuid("user_id").references(() => users.id),
    organizationId: integer("organization_id").references(() => organizations.id),
    branchId: integer("branch_id").references(() => branches.id),
    action: varchar("action", { length: 128 }).notNull(),
    entity: varchar("entity", { length: 128 }).notNull(),
    entityId: varchar("entity_id", { length: 128 }),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    userIdx: index("audit_user_idx").on(t.userId),
    entityIdx: index("audit_entity_idx").on(t.entity),
    auditOrgIdx: index("audit_org_idx").on(t.organizationId),
    auditBranchIdx: index("audit_branch_idx").on(t.branchId),
  }),
)

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .references(() => users.id)
      .notNull(),
    organizationId: integer("organization_id").references(() => organizations.id),
    refreshTokenHash: varchar("refresh_token_hash", { length: 255 }).notNull(),
    ipAddress: varchar("ip_address", { length: 64 }),
    userAgent: varchar("user_agent", { length: 255 }),
    lastActivityAt: timestamp("last_activity_at", { withTimezone: true }).defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    userIdx: index("sessions_user_idx").on(t.userId),
    expiresIdx: index("sessions_expires_idx").on(t.expiresAt),
    sessionOrgIdx: index("sessions_org_idx").on(t.organizationId),
  }),
)

// ========================================
// ENHANCED INVENTORY MANAGEMENT SYSTEM
// ========================================

// Global Products - Master inventory managed by Super Admin
export const globalProducts = pgTable(
  "global_products",
  {
    id: serial("id").primaryKey(),
    productCode: varchar("product_code", { length: 128 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    categoryId: integer("category_id").references(() => categories.id),
    imageUrl: varchar("image_url", { length: 512 }),
    basePrice: integer("base_price_cents").notNull().default(0),
    unit: varchar("unit", { length: 64 }).notNull().default("unit"), // kg, box, piece, etc.
    status: varchar("status", { length: 32 }).notNull().default("active"), // active, inactive, discontinued
    metadata: jsonb("metadata").$type<Record<string, any>>().default({}),
    createdByUserId: uuid("created_by_user_id").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  },
  (t) => ({
    codeIdx: uniqueIndex("global_products_code_idx").on(t.productCode),
    nameIdx: index("global_products_name_idx").on(t.name),
    categoryIdx: index("global_products_category_idx").on(t.categoryId),
    statusIdx: index("global_products_status_idx").on(t.status),
  }),
)

// Organization Products - Head Office shortlisting and customization
export const organizationProducts = pgTable(
  "organization_products",
  {
    id: serial("id").primaryKey(),
    organizationId: integer("organization_id").references(() => organizations.id).notNull(),
    globalProductId: integer("global_product_id").references(() => globalProducts.id).notNull(),
    isEnabled: boolean("is_enabled").notNull().default(true), // Head Office can disable products
    customName: varchar("custom_name", { length: 255 }), // Override product name
    customDescription: text("custom_description"), // Override description
    customPrice: integer("custom_price_cents"), // Override pricing
    customImageUrl: varchar("custom_image_url", { length: 512 }),
    tags: jsonb("tags").$type<string[]>().default([]),
    priority: integer("priority").default(0), // For sorting/featuring
    overrideLevel: varchar("override_level", { length: 32 }).default("super_admin"), // super_admin/head_office/branch
    metadata: jsonb("metadata").$type<Record<string, any>>().default({}),
    updatedByUserId: uuid("updated_by_user_id").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    orgProductUq: uniqueIndex("org_products_org_product_uq").on(t.organizationId, t.globalProductId),
    orgIdx: index("org_products_org_idx").on(t.organizationId),
    globalProductIdx: index("org_products_global_idx").on(t.globalProductId),
    enabledIdx: index("org_products_enabled_idx").on(t.isEnabled),
  }),
)

// Branch Products - Branch-level stock, availability, and settings
export const branchProducts = pgTable(
  "branch_products",
  {
    id: serial("id").primaryKey(),
    branchId: integer("branch_id").references(() => branches.id).notNull(),
    organizationId: integer("organization_id").references(() => organizations.id).notNull(),
    globalProductId: integer("global_product_id").references(() => globalProducts.id).notNull(),
    organizationProductId: integer("organization_product_id").references(() => organizationProducts.id, { onDelete: "cascade" }),
    isVisible: boolean("is_visible").notNull().default(true), // Branch can toggle visibility
    isAvailable: boolean("is_available").notNull().default(true), // Branch can mark unavailable
    stockQuantity: integer("stock_quantity").notNull().default(0),
    reservedQuantity: integer("reserved_quantity").notNull().default(0),
    reorderThreshold: integer("reorder_threshold").notNull().default(10),
    reorderQuantity: integer("reorder_quantity").notNull().default(50),
    lastRestockDate: timestamp("last_restock_date", { withTimezone: true }),
    customNotes: text("custom_notes"), // Branch-specific notes
    metadata: jsonb("metadata").$type<Record<string, any>>().default({}),
    updatedByUserId: uuid("updated_by_user_id").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    branchProductUq: uniqueIndex("branch_products_branch_product_uq").on(t.branchId, t.globalProductId),
    branchIdx: index("branch_products_branch_idx").on(t.branchId),
    orgIdx: index("branch_products_org_idx").on(t.organizationId),
    globalProductIdx: index("branch_products_global_idx").on(t.globalProductId),
    orgProductIdx: index("branch_products_org_product_idx").on(t.organizationProductId),
    visibleIdx: index("branch_products_visible_idx").on(t.isVisible),
    availableIdx: index("branch_products_available_idx").on(t.isAvailable),
    lowStockIdx: index("branch_products_low_stock_idx").on(t.stockQuantity),
  }),
)

// Product Assignment History - Track cascading changes
export const productAssignments = pgTable(
  "product_assignments",
  {
    id: serial("id").primaryKey(),
    globalProductId: integer("global_product_id").references(() => globalProducts.id).notNull(),
    assignedToType: varchar("assigned_to_type", { length: 32 }).notNull(), // organization or branch
    assignedToId: integer("assigned_to_id").notNull(), // organizationId or branchId
    action: varchar("action", { length: 32 }).notNull(), // assigned, unassigned, forced
    performedByUserId: uuid("performed_by_user_id").references(() => users.id).notNull(),
    performedByRole: varchar("performed_by_role", { length: 64 }).notNull(),
    metadata: jsonb("metadata").$type<Record<string, any>>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    productIdx: index("product_assignments_product_idx").on(t.globalProductId),
    assignedToIdx: index("product_assignments_assigned_to_idx").on(t.assignedToType, t.assignedToId),
    userIdx: index("product_assignments_user_idx").on(t.performedByUserId),
  }),
)

// Restock Requests - Branch can request restocking
export const restockRequests = pgTable(
  "restock_requests",
  {
    id: serial("id").primaryKey(),
    branchId: integer("branch_id").references(() => branches.id).notNull(),
    organizationId: integer("organization_id").references(() => organizations.id).notNull(),
    globalProductId: integer("global_product_id").references(() => globalProducts.id).notNull(),
    requestedQuantity: integer("requested_quantity").notNull(),
    currentStock: integer("current_stock").notNull(),
    reason: text("reason"),
    status: varchar("status", { length: 32 }).notNull().default("pending"), // pending, approved, rejected, fulfilled
    requestedByUserId: uuid("requested_by_user_id").references(() => users.id).notNull(),
    reviewedByUserId: uuid("reviewed_by_user_id").references(() => users.id),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewNotes: text("review_notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    branchIdx: index("restock_requests_branch_idx").on(t.branchId),
    orgIdx: index("restock_requests_org_idx").on(t.organizationId),
    productIdx: index("restock_requests_product_idx").on(t.globalProductId),
    statusIdx: index("restock_requests_status_idx").on(t.status),
    requestedByIdx: index("restock_requests_requested_by_idx").on(t.requestedByUserId),
  }),
)

// Inventory Sync Log - Track synchronization between levels
export const inventorySyncLogs = pgTable(
  "inventory_sync_logs",
  {
    id: serial("id").primaryKey(),
    syncType: varchar("sync_type", { length: 64 }).notNull(), // full_sync, partial_sync, cascade_update
    triggerLevel: varchar("trigger_level", { length: 32 }).notNull(), // super_admin, head_office, branch
    targetType: varchar("target_type", { length: 32 }).notNull(), // organization, branch, all
    targetId: integer("target_id"), // organizationId or branchId (null for all)
    affectedProducts: jsonb("affected_products").$type<number[]>().default([]),
    changesCount: integer("changes_count").notNull().default(0),
    status: varchar("status", { length: 32 }).notNull().default("pending"), // pending, in_progress, completed, failed
    errorMessage: text("error_message"),
    performedByUserId: uuid("performed_by_user_id").references(() => users.id).notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    metadata: jsonb("metadata").$type<Record<string, any>>().default({}),
  },
  (t) => ({
    syncTypeIdx: index("inventory_sync_logs_type_idx").on(t.syncType),
    targetIdx: index("inventory_sync_logs_target_idx").on(t.targetType, t.targetId),
    statusIdx: index("inventory_sync_logs_status_idx").on(t.status),
    userIdx: index("inventory_sync_logs_user_idx").on(t.performedByUserId),
    startedAtIdx: index("inventory_sync_logs_started_at_idx").on(t.startedAt),
  }),
)

// Product Import Batches - Track CSV uploads and bulk imports
export const productImportBatches = pgTable(
  "product_import_batches",
  {
    id: serial("id").primaryKey(),
    fileName: varchar("file_name", { length: 255 }).notNull(),
    uploadedByUserId: uuid("uploaded_by_user_id").references(() => users.id).notNull(),
    totalRows: integer("total_rows").notNull().default(0),
    successfulRows: integer("successful_rows").notNull().default(0),
    failedRows: integer("failed_rows").notNull().default(0),
    status: varchar("status", { length: 32 }).notNull().default("processing"), // processing, completed, failed, partial
    validationErrors: jsonb("validation_errors").$type<Array<{row: number, errors: string[]}>>().default([]),
    importedProductIds: jsonb("imported_product_ids").$type<number[]>().default([]),
    metadata: jsonb("metadata").$type<Record<string, any>>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => ({
    userIdx: index("product_import_batches_user_idx").on(t.uploadedByUserId),
    statusIdx: index("product_import_batches_status_idx").on(t.status),
    createdAtIdx: index("product_import_batches_created_at_idx").on(t.createdAt),
  }),
)

// ========================================
// PRODUCT MANAGEMENT SYSTEM
// ========================================

// Modifiers - Product variants like sizes, units, packaging
export const modifiers = pgTable(
  "modifiers",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    type: varchar("type", { length: 64 }).notNull().default("unit"), // unit, size, packaging, etc.
    status: varchar("status", { length: 32 }).notNull().default("active"), // active, inactive
    createdByUserId: uuid("created_by_user_id").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    nameIdx: index("modifiers_name_idx").on(t.name),
    typeIdx: index("modifiers_type_idx").on(t.type),
    statusIdx: index("modifiers_status_idx").on(t.status),
    userIdx: index("modifiers_user_idx").on(t.createdByUserId),
  }),
)

// Product Modifiers - Junction table linking products to their modifiers
export const productModifiers = pgTable(
  "product_modifiers",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id").references(() => globalProducts.id).notNull(),
    modifierId: integer("modifier_id").references(() => modifiers.id).notNull(),
    isDefault: boolean("is_default").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    productIdx: index("product_modifiers_product_idx").on(t.productId),
    modifierIdx: index("product_modifiers_modifier_idx").on(t.modifierId),
    productModifierIdx: uniqueIndex("product_modifiers_product_modifier_idx").on(t.productId, t.modifierId),
  }),
)

// Organization Inventory - Products assigned to organizations
export const organizationInventory = pgTable(
  "organization_inventory",
  {
    id: serial("id").primaryKey(),
    organizationId: integer("organization_id").references(() => organizations.id).notNull(),
    globalProductId: integer("global_product_id").references(() => globalProducts.id).notNull(),
    assignedByUserId: uuid("assigned_by_user_id").references(() => users.id).notNull(),
    isActive: boolean("is_active").notNull().default(true),
    customName: varchar("custom_name", { length: 255 }),
    customPrice: integer("custom_price_cents"),
    customDescription: text("custom_description"),
    customImageUrl: varchar("custom_image_url", { length: 512 }),
    assignedAt: timestamp("assigned_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => ({
    orgProductUq: uniqueIndex("org_inventory_org_product_uq").on(t.organizationId, t.globalProductId),
    orgIdx: index("org_inventory_org_idx").on(t.organizationId),
    globalProductIdx: index("org_inventory_global_product_idx").on(t.globalProductId),
    assignedByIdx: index("org_inventory_assigned_by_idx").on(t.assignedByUserId),
    activeIdx: index("org_inventory_active_idx").on(t.isActive),
    deletedAtIdx: index("org_inventory_deleted_at_idx").on(t.deletedAt),
  }),
)

// Branch Inventory - Products assigned to branches
export const branchInventory = pgTable(
  "branch_inventory",
  {
    id: serial("id").primaryKey(),
    branchId: integer("branch_id").references(() => branches.id).notNull(),
    organizationId: integer("organization_id").references(() => organizations.id).notNull(),
    organizationInventoryId: integer("organization_inventory_id").references(() => organizationInventory.id, { onDelete: "cascade" }).notNull(),
    assignedByUserId: uuid("assigned_by_user_id").references(() => users.id).notNull(),
    isVisible: boolean("is_visible").notNull().default(true),
    isActive: boolean("is_active").notNull().default(true),
    stockQuantity: integer("stock_quantity").notNull().default(0),
    reorderThreshold: integer("reorder_threshold").notNull().default(10),
    assignedAt: timestamp("assigned_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => ({
    branchOrgInventoryUq: uniqueIndex("branch_inventory_branch_org_inventory_uq").on(t.branchId, t.organizationInventoryId),
    branchIdx: index("branch_inventory_branch_idx").on(t.branchId),
    orgIdx: index("branch_inventory_org_idx").on(t.organizationId),
    orgInventoryIdx: index("branch_inventory_org_inventory_idx").on(t.organizationInventoryId),
    assignedByIdx: index("branch_inventory_assigned_by_idx").on(t.assignedByUserId),
    visibleIdx: index("branch_inventory_visible_idx").on(t.isVisible),
    activeIdx: index("branch_inventory_active_idx").on(t.isActive),
    deletedAtIdx: index("branch_inventory_deleted_at_idx").on(t.deletedAt),
  }),
)

// Employee Credentials - For Order Portal access
export const employeeCredentials = pgTable(
  "employee_credentials",
  {
    id: serial("id").primaryKey(),
    branchId: integer("branch_id").references(() => branches.id).notNull(),
    organizationId: integer("organization_id").references(() => organizations.id).notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    firstName: varchar("first_name", { length: 128 }),
    lastName: varchar("last_name", { length: 128 }),
    mfaEnabled: boolean("mfa_enabled").default(false).notNull(),
    mfaSecret: varchar("mfa_secret", { length: 255 }),
    isActive: boolean("is_active").default(true).notNull(),
    createdByUserId: uuid("created_by_user_id").references(() => users.id).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
    deactivatedAt: timestamp("deactivated_at", { withTimezone: true }),
  },
  (t) => ({
    emailUq: uniqueIndex("employee_creds_email_uq").on(t.email),
    branchIdx: index("employee_creds_branch_idx").on(t.branchId),
    orgIdx: index("employee_creds_org_idx").on(t.organizationId),
    activeIdx: index("employee_creds_active_idx").on(t.isActive),
    createdByIdx: index("employee_creds_created_by_idx").on(t.createdByUserId),
  }),
)
