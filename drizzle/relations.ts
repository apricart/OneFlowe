import { relations } from "drizzle-orm/relations";
import { branches, budgets, users, auditLogs, organizations, categories, suppliers, warehouses, roles, notifications, orders, orderItems, skus, sessions, products, headOffices, orgMetrics, organizationSettings, rolePermissions, inventory, organizationProducts, globalProducts, branchProducts, restockRequests, inventorySyncLogs, productAssignments, productImportBatches, mfaCodes, branchInventory, organizationInventory, modifiers, productModifiers } from "./schema";

export const budgetsRelations = relations(budgets, ({one}) => ({
	branch: one(branches, {
		fields: [budgets.branchId],
		references: [branches.id]
	}),
}));

export const branchesRelations = relations(branches, ({one, many}) => ({
	budgets: many(budgets),
	auditLogs: many(auditLogs),
	suppliers: many(suppliers),
	warehouses: many(warehouses),
	organization: one(organizations, {
		fields: [branches.organizationId],
		references: [organizations.id]
	}),
	notifications: many(notifications),
	orders: many(orders),
	inventories: many(inventory),
	branchProducts: many(branchProducts),
	restockRequests: many(restockRequests),
	branchInventories: many(branchInventory),
}));

export const auditLogsRelations = relations(auditLogs, ({one}) => ({
	user: one(users, {
		fields: [auditLogs.userId],
		references: [users.id]
	}),
	organization: one(organizations, {
		fields: [auditLogs.organizationId],
		references: [organizations.id]
	}),
	branch: one(branches, {
		fields: [auditLogs.branchId],
		references: [branches.id]
	}),
}));

export const usersRelations = relations(users, ({one, many}) => ({
	auditLogs: many(auditLogs),
	role: one(roles, {
		fields: [users.roleId],
		references: [roles.id]
	}),
	organization: one(organizations, {
		fields: [users.organizationId],
		references: [organizations.id]
	}),
	notifications: many(notifications),
	orders: many(orders),
	sessions: many(sessions),
	organizationProducts: many(organizationProducts),
	branchProducts: many(branchProducts),
	restockRequests_requestedByUserId: many(restockRequests, {
		relationName: "restockRequests_requestedByUserId_users_id"
	}),
	restockRequests_reviewedByUserId: many(restockRequests, {
		relationName: "restockRequests_reviewedByUserId_users_id"
	}),
	globalProducts: many(globalProducts),
	inventorySyncLogs: many(inventorySyncLogs),
	productAssignments: many(productAssignments),
	productImportBatches: many(productImportBatches),
	mfaCodes: many(mfaCodes),
	branchInventories: many(branchInventory),
	modifiers: many(modifiers),
	organizationInventories: many(organizationInventory),
}));

export const organizationsRelations = relations(organizations, ({many}) => ({
	auditLogs: many(auditLogs),
	categories: many(categories),
	suppliers: many(suppliers),
	warehouses: many(warehouses),
	branches: many(branches),
	users: many(users),
	notifications: many(notifications),
	orderItems: many(orderItems),
	orders: many(orders),
	sessions: many(sessions),
	skuses: many(skus),
	headOffices: many(headOffices),
	orgMetrics: many(orgMetrics),
	organizationSettings: many(organizationSettings),
	inventories: many(inventory),
	products: many(products),
	organizationProducts: many(organizationProducts),
	branchProducts: many(branchProducts),
	restockRequests: many(restockRequests),
	branchInventories: many(branchInventory),
	organizationInventories: many(organizationInventory),
}));

export const categoriesRelations = relations(categories, ({one, many}) => ({
	organization: one(organizations, {
		fields: [categories.organizationId],
		references: [organizations.id]
	}),
	products: many(products),
	globalProducts: many(globalProducts),
}));

export const suppliersRelations = relations(suppliers, ({one}) => ({
	organization: one(organizations, {
		fields: [suppliers.organizationId],
		references: [organizations.id]
	}),
	branch: one(branches, {
		fields: [suppliers.branchId],
		references: [branches.id]
	}),
}));

export const warehousesRelations = relations(warehouses, ({one}) => ({
	organization: one(organizations, {
		fields: [warehouses.organizationId],
		references: [organizations.id]
	}),
	branch: one(branches, {
		fields: [warehouses.branchId],
		references: [branches.id]
	}),
}));

export const rolesRelations = relations(roles, ({many}) => ({
	users: many(users),
	rolePermissions: many(rolePermissions),
}));

export const notificationsRelations = relations(notifications, ({one}) => ({
	user: one(users, {
		fields: [notifications.userId],
		references: [users.id]
	}),
	organization: one(organizations, {
		fields: [notifications.organizationId],
		references: [organizations.id]
	}),
	branch: one(branches, {
		fields: [notifications.branchId],
		references: [branches.id]
	}),
}));

export const orderItemsRelations = relations(orderItems, ({one}) => ({
	order: one(orders, {
		fields: [orderItems.orderId],
		references: [orders.id]
	}),
	skus: one(skus, {
		fields: [orderItems.skuId],
		references: [skus.id]
	}),
	organization: one(organizations, {
		fields: [orderItems.organizationId],
		references: [organizations.id]
	}),
}));

export const ordersRelations = relations(orders, ({one, many}) => ({
	orderItems: many(orderItems),
	branch: one(branches, {
		fields: [orders.branchId],
		references: [branches.id]
	}),
	user: one(users, {
		fields: [orders.createdByUserId],
		references: [users.id]
	}),
	organization: one(organizations, {
		fields: [orders.organizationId],
		references: [organizations.id]
	}),
}));

export const skusRelations = relations(skus, ({one, many}) => ({
	orderItems: many(orderItems),
	product: one(products, {
		fields: [skus.productId],
		references: [products.id]
	}),
	organization: one(organizations, {
		fields: [skus.organizationId],
		references: [organizations.id]
	}),
	inventories: many(inventory),
}));

export const sessionsRelations = relations(sessions, ({one}) => ({
	user: one(users, {
		fields: [sessions.userId],
		references: [users.id]
	}),
	organization: one(organizations, {
		fields: [sessions.organizationId],
		references: [organizations.id]
	}),
}));

export const productsRelations = relations(products, ({one, many}) => ({
	skuses: many(skus),
	category: one(categories, {
		fields: [products.categoryId],
		references: [categories.id]
	}),
	organization: one(organizations, {
		fields: [products.organizationId],
		references: [organizations.id]
	}),
}));

export const headOfficesRelations = relations(headOffices, ({one}) => ({
	organization: one(organizations, {
		fields: [headOffices.organizationId],
		references: [organizations.id]
	}),
}));

export const orgMetricsRelations = relations(orgMetrics, ({one}) => ({
	organization: one(organizations, {
		fields: [orgMetrics.organizationId],
		references: [organizations.id]
	}),
}));

export const organizationSettingsRelations = relations(organizationSettings, ({one}) => ({
	organization: one(organizations, {
		fields: [organizationSettings.organizationId],
		references: [organizations.id]
	}),
}));

export const rolePermissionsRelations = relations(rolePermissions, ({one}) => ({
	role: one(roles, {
		fields: [rolePermissions.roleId],
		references: [roles.id]
	}),
}));

export const inventoryRelations = relations(inventory, ({one}) => ({
	branch: one(branches, {
		fields: [inventory.branchId],
		references: [branches.id]
	}),
	skus: one(skus, {
		fields: [inventory.skuId],
		references: [skus.id]
	}),
	organization: one(organizations, {
		fields: [inventory.organizationId],
		references: [organizations.id]
	}),
}));

export const organizationProductsRelations = relations(organizationProducts, ({one, many}) => ({
	organization: one(organizations, {
		fields: [organizationProducts.organizationId],
		references: [organizations.id]
	}),
	globalProduct: one(globalProducts, {
		fields: [organizationProducts.globalProductId],
		references: [globalProducts.id]
	}),
	user: one(users, {
		fields: [organizationProducts.updatedByUserId],
		references: [users.id]
	}),
	branchProducts: many(branchProducts),
}));

export const globalProductsRelations = relations(globalProducts, ({one, many}) => ({
	organizationProducts: many(organizationProducts),
	branchProducts: many(branchProducts),
	restockRequests: many(restockRequests),
	category: one(categories, {
		fields: [globalProducts.categoryId],
		references: [categories.id]
	}),
	user: one(users, {
		fields: [globalProducts.createdByUserId],
		references: [users.id]
	}),
	productAssignments: many(productAssignments),
	productModifiers: many(productModifiers),
	organizationInventories: many(organizationInventory),
}));

export const branchProductsRelations = relations(branchProducts, ({one}) => ({
	branch: one(branches, {
		fields: [branchProducts.branchId],
		references: [branches.id]
	}),
	organization: one(organizations, {
		fields: [branchProducts.organizationId],
		references: [organizations.id]
	}),
	globalProduct: one(globalProducts, {
		fields: [branchProducts.globalProductId],
		references: [globalProducts.id]
	}),
	user: one(users, {
		fields: [branchProducts.updatedByUserId],
		references: [users.id]
	}),
	organizationProduct: one(organizationProducts, {
		fields: [branchProducts.organizationProductId],
		references: [organizationProducts.id]
	}),
}));

export const restockRequestsRelations = relations(restockRequests, ({one}) => ({
	branch: one(branches, {
		fields: [restockRequests.branchId],
		references: [branches.id]
	}),
	organization: one(organizations, {
		fields: [restockRequests.organizationId],
		references: [organizations.id]
	}),
	globalProduct: one(globalProducts, {
		fields: [restockRequests.globalProductId],
		references: [globalProducts.id]
	}),
	user_requestedByUserId: one(users, {
		fields: [restockRequests.requestedByUserId],
		references: [users.id],
		relationName: "restockRequests_requestedByUserId_users_id"
	}),
	user_reviewedByUserId: one(users, {
		fields: [restockRequests.reviewedByUserId],
		references: [users.id],
		relationName: "restockRequests_reviewedByUserId_users_id"
	}),
}));

export const inventorySyncLogsRelations = relations(inventorySyncLogs, ({one}) => ({
	user: one(users, {
		fields: [inventorySyncLogs.performedByUserId],
		references: [users.id]
	}),
}));

export const productAssignmentsRelations = relations(productAssignments, ({one}) => ({
	globalProduct: one(globalProducts, {
		fields: [productAssignments.globalProductId],
		references: [globalProducts.id]
	}),
	user: one(users, {
		fields: [productAssignments.performedByUserId],
		references: [users.id]
	}),
}));

export const productImportBatchesRelations = relations(productImportBatches, ({one}) => ({
	user: one(users, {
		fields: [productImportBatches.uploadedByUserId],
		references: [users.id]
	}),
}));

export const mfaCodesRelations = relations(mfaCodes, ({one}) => ({
	user: one(users, {
		fields: [mfaCodes.userId],
		references: [users.id]
	}),
}));

export const branchInventoryRelations = relations(branchInventory, ({one}) => ({
	branch: one(branches, {
		fields: [branchInventory.branchId],
		references: [branches.id]
	}),
	organization: one(organizations, {
		fields: [branchInventory.organizationId],
		references: [organizations.id]
	}),
	user: one(users, {
		fields: [branchInventory.assignedByUserId],
		references: [users.id]
	}),
	organizationInventory: one(organizationInventory, {
		fields: [branchInventory.organizationInventoryId],
		references: [organizationInventory.id]
	}),
}));

export const organizationInventoryRelations = relations(organizationInventory, ({one, many}) => ({
	branchInventories: many(branchInventory),
	organization: one(organizations, {
		fields: [organizationInventory.organizationId],
		references: [organizations.id]
	}),
	globalProduct: one(globalProducts, {
		fields: [organizationInventory.globalProductId],
		references: [globalProducts.id]
	}),
	user: one(users, {
		fields: [organizationInventory.assignedByUserId],
		references: [users.id]
	}),
}));

export const modifiersRelations = relations(modifiers, ({one, many}) => ({
	user: one(users, {
		fields: [modifiers.createdByUserId],
		references: [users.id]
	}),
	productModifiers: many(productModifiers),
}));

export const productModifiersRelations = relations(productModifiers, ({one}) => ({
	globalProduct: one(globalProducts, {
		fields: [productModifiers.productId],
		references: [globalProducts.id]
	}),
	modifier: one(modifiers, {
		fields: [productModifiers.modifierId],
		references: [modifiers.id]
	}),
}));