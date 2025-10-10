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
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    emailIdx: uniqueIndex("users_email_idx").on(t.email),
    roleIdx: index("users_role_idx").on(t.roleId),
    activeIdx: index("users_active_idx").on(t.isActive),
  }),
)

export const organizations = pgTable(
  "organizations",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    orgNameIdx: uniqueIndex("org_name_idx").on(t.name),
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
    adminUserId: uuid("admin_user_id").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    orgIdx: index("branches_org_idx").on(t.organizationId),
    nameIdx: index("branches_name_idx").on(t.name),
  }),
)

export const categories = pgTable(
  "categories",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    parentId: integer("parent_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    nameIdx: index("categories_name_idx").on(t.name),
  }),
)

export const products = pgTable(
  "products",
  {
    id: serial("id").primaryKey(),
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
  }),
)

export const skus = pgTable(
  "skus",
  {
    id: serial("id").primaryKey(),
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
  }),
)

export const inventory = pgTable(
  "inventory",
  {
    id: serial("id").primaryKey(),
    branchId: integer("branch_id")
      .references(() => branches.id)
      .notNull(),
    skuId: integer("sku_id")
      .references(() => skus.id)
      .notNull(),
    quantity: integer("quantity").notNull().default(0),
    reorderThreshold: integer("reorder_threshold").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    byBranchSku: uniqueIndex("inventory_branch_sku_uq").on(t.branchId, t.skuId),
    branchIdx: index("inventory_branch_idx").on(t.branchId),
  }),
)

export const budgets = pgTable(
  "budgets",
  {
    id: serial("id").primaryKey(),
    branchId: integer("branch_id")
      .references(() => branches.id)
      .notNull(),
    period: varchar("period", { length: 16 }).notNull(), // e.g. '2025-10'
    amountAllocatedCents: integer("amount_allocated_cents").notNull().default(0),
    amountSpentCents: integer("amount_spent_cents").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    branchPeriodUq: uniqueIndex("budgets_branch_period_uq").on(t.branchId, t.period),
  }),
)

export const orders = pgTable(
  "orders",
  {
    id: serial("id").primaryKey(),
    branchId: integer("branch_id")
      .references(() => branches.id)
      .notNull(),
    status: varchar("status", { length: 32 }).notNull().default("PENDING"), // PENDING/APPROVED/REJECTED
    totalCents: integer("total_cents").notNull().default(0),
    createdByUserId: uuid("created_by_user_id")
      .references(() => users.id)
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    branchIdx: index("orders_branch_idx").on(t.branchId),
    statusIdx: index("orders_status_idx").on(t.status),
    createdIdx: index("orders_created_idx").on(t.createdAt),
  }),
)

export const orderItems = pgTable(
  "order_items",
  {
    id: serial("id").primaryKey(),
    orderId: integer("order_id")
      .references(() => orders.id)
      .notNull(),
    skuId: integer("sku_id")
      .references(() => skus.id)
      .notNull(),
    quantity: integer("quantity").notNull(),
    priceCents: integer("price_cents").notNull(),
  },
  (t) => ({
    orderIdx: index("order_items_order_idx").on(t.orderId),
  }),
)

export const notifications = pgTable(
  "notifications",
  {
    id: serial("id").primaryKey(),
    userId: uuid("user_id")
      .references(() => users.id)
      .notNull(),
    type: varchar("type", { length: 64 }).notNull(),
    message: text("message").notNull(),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    userIdx: index("notifications_user_idx").on(t.userId),
    typeIdx: index("notifications_type_idx").on(t.type),
  }),
)

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: serial("id").primaryKey(),
    userId: uuid("user_id").references(() => users.id),
    action: varchar("action", { length: 128 }).notNull(),
    entity: varchar("entity", { length: 128 }).notNull(),
    entityId: varchar("entity_id", { length: 128 }),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    userIdx: index("audit_user_idx").on(t.userId),
    entityIdx: index("audit_entity_idx").on(t.entity),
  }),
)

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .references(() => users.id)
      .notNull(),
    refreshTokenHash: varchar("refresh_token_hash", { length: 255 }).notNull(),
    lastActivityAt: timestamp("last_activity_at", { withTimezone: true }).defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    userIdx: index("sessions_user_idx").on(t.userId),
    expiresIdx: index("sessions_expires_idx").on(t.expiresAt),
  }),
)
