import { relations } from "drizzle-orm/relations";
import { users, branchInventory, branches, organizations, organizationInventory, branchProducts, globalProducts, organizationProducts, categories, inventory, skus, headOffices, employeeCredentials, mfaCodes, inventorySyncLogs, modifiers, orgMetrics, organizationSettings, productAssignments, orders, refunds, sessions, suppliers, products, productImportBatches, productModifiers, groups, groupAuditLogs, roles, orderItems, rolePermissions, notifications, auditLogs, systemLogs, refundItems, scheduledReports, budgets, budgetAddons, restockRequests } from "./schema";

export const branchInventoryRelations = relations(branchInventory, ({one}) => ({
	user: one(users, {
		fields: [branchInventory.assignedByUserId],
		references: [users.id]
	}),
	branch: one(branches, {
		fields: [branchInventory.branchId],
		references: [branches.id]
	}),
	organization: one(organizations, {
		fields: [branchInventory.organizationId],
		references: [organizations.id]
	}),
	organizationInventory: one(organizationInventory, {
		fields: [branchInventory.organizationInventoryId],
		references: [organizationInventory.id]
	}),
}));

export const usersRelations = relations(users, ({one, many}) => ({
	branchInventories: many(branchInventory),
	branchProducts: many(branchProducts),
	employeeCredentials: many(employeeCredentials),
	mfaCodes: many(mfaCodes),
	inventorySyncLogs: many(inventorySyncLogs),
	modifiers: many(modifiers),
	productAssignments: many(productAssignments),
	organizationInventories: many(organizationInventory),
	organizationProducts: many(organizationProducts),
	refunds_processedByUserId: many(refunds, {
		relationName: "refunds_processedByUserId_users_id"
	}),
	refunds_requestedByUserId: many(refunds, {
		relationName: "refunds_requestedByUserId_users_id"
	}),
	sessions: many(sessions),
	productImportBatches: many(productImportBatches),
	groupAuditLogs: many(groupAuditLogs),
	organization: one(organizations, {
		fields: [users.organizationId],
		references: [organizations.id]
	}),
	role: one(roles, {
		fields: [users.roleId],
		references: [roles.id]
	}),
	globalProducts: many(globalProducts),
	notifications: many(notifications),
	auditLogs: many(auditLogs),
	orders_approvedByUserId: many(orders, {
		relationName: "orders_approvedByUserId_users_id"
	}),
	orders_createdByUserId: many(orders, {
		relationName: "orders_createdByUserId_users_id"
	}),
	orders_fulfilledByUserId: many(orders, {
		relationName: "orders_fulfilledByUserId_users_id"
	}),
	orders_refundedByUserId: many(orders, {
		relationName: "orders_refundedByUserId_users_id"
	}),
	orders_rejectedByUserId: many(orders, {
		relationName: "orders_rejectedByUserId_users_id"
	}),
	groups: many(groups),
	scheduledReports: many(scheduledReports),
	budgetAddons: many(budgetAddons),
	restockRequests_requestedByUserId: many(restockRequests, {
		relationName: "restockRequests_requestedByUserId_users_id"
	}),
	restockRequests_reviewedByUserId: many(restockRequests, {
		relationName: "restockRequests_reviewedByUserId_users_id"
	}),
}));

export const branchesRelations = relations(branches, ({one, many}) => ({
	branchInventories: many(branchInventory),
	branchProducts: many(branchProducts),
	inventories: many(inventory),
	employeeCredentials: many(employeeCredentials),
	suppliers: many(suppliers),
	organization: one(organizations, {
		fields: [branches.organizationId],
		references: [organizations.id]
	}),
	notifications: many(notifications),
	auditLogs: many(auditLogs),
	orders: many(orders),
	systemLogs: many(systemLogs),
	budgets: many(budgets),
	restockRequests: many(restockRequests),
}));

export const organizationsRelations = relations(organizations, ({many}) => ({
	branchInventories: many(branchInventory),
	branchProducts: many(branchProducts),
	categories: many(categories),
	inventories: many(inventory),
	headOffices: many(headOffices),
	employeeCredentials: many(employeeCredentials),
	orgMetrics: many(orgMetrics),
	organizationSettings: many(organizationSettings),
	organizationInventories: many(organizationInventory),
	organizationProducts: many(organizationProducts),
	refunds: many(refunds),
	sessions: many(sessions),
	suppliers: many(suppliers),
	skuses: many(skus),
	products: many(products),
	groupAuditLogs: many(groupAuditLogs),
	users: many(users),
	orderItems: many(orderItems),
	branches: many(branches),
	notifications: many(notifications),
	auditLogs: many(auditLogs),
	orders: many(orders),
	systemLogs: many(systemLogs),
	groups: many(groups),
	scheduledReports: many(scheduledReports),
	budgets: many(budgets),
	restockRequests: many(restockRequests),
}));

export const organizationInventoryRelations = relations(organizationInventory, ({one, many}) => ({
	branchInventories: many(branchInventory),
	user: one(users, {
		fields: [organizationInventory.assignedByUserId],
		references: [users.id]
	}),
	globalProduct: one(globalProducts, {
		fields: [organizationInventory.globalProductId],
		references: [globalProducts.id]
	}),
	organization: one(organizations, {
		fields: [organizationInventory.organizationId],
		references: [organizations.id]
	}),
}));

export const branchProductsRelations = relations(branchProducts, ({one}) => ({
	branch: one(branches, {
		fields: [branchProducts.branchId],
		references: [branches.id]
	}),
	globalProduct: one(globalProducts, {
		fields: [branchProducts.globalProductId],
		references: [globalProducts.id]
	}),
	organization: one(organizations, {
		fields: [branchProducts.organizationId],
		references: [organizations.id]
	}),
	organizationProduct: one(organizationProducts, {
		fields: [branchProducts.organizationProductId],
		references: [organizationProducts.id]
	}),
	user: one(users, {
		fields: [branchProducts.updatedByUserId],
		references: [users.id]
	}),
}));

export const globalProductsRelations = relations(globalProducts, ({one, many}) => ({
	branchProducts: many(branchProducts),
	productAssignments: many(productAssignments),
	organizationInventories: many(organizationInventory),
	organizationProducts: many(organizationProducts),
	productModifiers: many(productModifiers),
	orderItems: many(orderItems),
	category: one(categories, {
		fields: [globalProducts.categoryId],
		references: [categories.id]
	}),
	user: one(users, {
		fields: [globalProducts.createdByUserId],
		references: [users.id]
	}),
	restockRequests: many(restockRequests),
}));

export const organizationProductsRelations = relations(organizationProducts, ({one, many}) => ({
	branchProducts: many(branchProducts),
	globalProduct: one(globalProducts, {
		fields: [organizationProducts.globalProductId],
		references: [globalProducts.id]
	}),
	organization: one(organizations, {
		fields: [organizationProducts.organizationId],
		references: [organizations.id]
	}),
	user: one(users, {
		fields: [organizationProducts.updatedByUserId],
		references: [users.id]
	}),
}));

export const categoriesRelations = relations(categories, ({one, many}) => ({
	organization: one(organizations, {
		fields: [categories.organizationId],
		references: [organizations.id]
	}),
	products: many(products),
	globalProducts: many(globalProducts),
}));

export const inventoryRelations = relations(inventory, ({one}) => ({
	branch: one(branches, {
		fields: [inventory.branchId],
		references: [branches.id]
	}),
	organization: one(organizations, {
		fields: [inventory.organizationId],
		references: [organizations.id]
	}),
	skus: one(skus, {
		fields: [inventory.skuId],
		references: [skus.id]
	}),
}));

export const skusRelations = relations(skus, ({one, many}) => ({
	inventories: many(inventory),
	organization: one(organizations, {
		fields: [skus.organizationId],
		references: [organizations.id]
	}),
	product: one(products, {
		fields: [skus.productId],
		references: [products.id]
	}),
}));

export const headOfficesRelations = relations(headOffices, ({one}) => ({
	organization: one(organizations, {
		fields: [headOffices.organizationId],
		references: [organizations.id]
	}),
}));

export const employeeCredentialsRelations = relations(employeeCredentials, ({one}) => ({
	branch: one(branches, {
		fields: [employeeCredentials.branchId],
		references: [branches.id]
	}),
	user: one(users, {
		fields: [employeeCredentials.createdByUserId],
		references: [users.id]
	}),
	organization: one(organizations, {
		fields: [employeeCredentials.organizationId],
		references: [organizations.id]
	}),
}));

export const mfaCodesRelations = relations(mfaCodes, ({one}) => ({
	user: one(users, {
		fields: [mfaCodes.userId],
		references: [users.id]
	}),
}));

export const inventorySyncLogsRelations = relations(inventorySyncLogs, ({one}) => ({
	user: one(users, {
		fields: [inventorySyncLogs.performedByUserId],
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

export const refundsRelations = relations(refunds, ({one, many}) => ({
	order: one(orders, {
		fields: [refunds.orderId],
		references: [orders.id]
	}),
	organization: one(organizations, {
		fields: [refunds.organizationId],
		references: [organizations.id]
	}),
	user_processedByUserId: one(users, {
		fields: [refunds.processedByUserId],
		references: [users.id],
		relationName: "refunds_processedByUserId_users_id"
	}),
	user_requestedByUserId: one(users, {
		fields: [refunds.requestedByUserId],
		references: [users.id],
		relationName: "refunds_requestedByUserId_users_id"
	}),
	refundItems: many(refundItems),
}));

export const ordersRelations = relations(orders, ({one, many}) => ({
	refunds: many(refunds),
	orderItems: many(orderItems),
	user_approvedByUserId: one(users, {
		fields: [orders.approvedByUserId],
		references: [users.id],
		relationName: "orders_approvedByUserId_users_id"
	}),
	branch: one(branches, {
		fields: [orders.branchId],
		references: [branches.id]
	}),
	user_createdByUserId: one(users, {
		fields: [orders.createdByUserId],
		references: [users.id],
		relationName: "orders_createdByUserId_users_id"
	}),
	user_fulfilledByUserId: one(users, {
		fields: [orders.fulfilledByUserId],
		references: [users.id],
		relationName: "orders_fulfilledByUserId_users_id"
	}),
	organization: one(organizations, {
		fields: [orders.organizationId],
		references: [organizations.id]
	}),
	user_refundedByUserId: one(users, {
		fields: [orders.refundedByUserId],
		references: [users.id],
		relationName: "orders_refundedByUserId_users_id"
	}),
	user_rejectedByUserId: one(users, {
		fields: [orders.rejectedByUserId],
		references: [users.id],
		relationName: "orders_rejectedByUserId_users_id"
	}),
}));

export const sessionsRelations = relations(sessions, ({one}) => ({
	organization: one(organizations, {
		fields: [sessions.organizationId],
		references: [organizations.id]
	}),
	user: one(users, {
		fields: [sessions.userId],
		references: [users.id]
	}),
}));

export const suppliersRelations = relations(suppliers, ({one}) => ({
	branch: one(branches, {
		fields: [suppliers.branchId],
		references: [branches.id]
	}),
	organization: one(organizations, {
		fields: [suppliers.organizationId],
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

export const productImportBatchesRelations = relations(productImportBatches, ({one}) => ({
	user: one(users, {
		fields: [productImportBatches.uploadedByUserId],
		references: [users.id]
	}),
}));

export const productModifiersRelations = relations(productModifiers, ({one}) => ({
	modifier: one(modifiers, {
		fields: [productModifiers.modifierId],
		references: [modifiers.id]
	}),
	globalProduct: one(globalProducts, {
		fields: [productModifiers.productId],
		references: [globalProducts.id]
	}),
}));

export const groupAuditLogsRelations = relations(groupAuditLogs, ({one}) => ({
	group: one(groups, {
		fields: [groupAuditLogs.groupId],
		references: [groups.id]
	}),
	organization: one(organizations, {
		fields: [groupAuditLogs.organizationId],
		references: [organizations.id]
	}),
	user: one(users, {
		fields: [groupAuditLogs.performedByUserId],
		references: [users.id]
	}),
}));

export const groupsRelations = relations(groups, ({one, many}) => ({
	groupAuditLogs: many(groupAuditLogs),
	user: one(users, {
		fields: [groups.createdByUserId],
		references: [users.id]
	}),
	organization: one(organizations, {
		fields: [groups.organizationId],
		references: [organizations.id]
	}),
}));

export const rolesRelations = relations(roles, ({many}) => ({
	users: many(users),
	rolePermissions: many(rolePermissions),
}));

export const orderItemsRelations = relations(orderItems, ({one, many}) => ({
	globalProduct: one(globalProducts, {
		fields: [orderItems.globalProductId],
		references: [globalProducts.id]
	}),
	order: one(orders, {
		fields: [orderItems.orderId],
		references: [orders.id]
	}),
	organization: one(organizations, {
		fields: [orderItems.organizationId],
		references: [organizations.id]
	}),
	refundItems: many(refundItems),
}));

export const rolePermissionsRelations = relations(rolePermissions, ({one}) => ({
	role: one(roles, {
		fields: [rolePermissions.roleId],
		references: [roles.id]
	}),
}));

export const notificationsRelations = relations(notifications, ({one}) => ({
	branch: one(branches, {
		fields: [notifications.branchId],
		references: [branches.id]
	}),
	organization: one(organizations, {
		fields: [notifications.organizationId],
		references: [organizations.id]
	}),
	user: one(users, {
		fields: [notifications.userId],
		references: [users.id]
	}),
}));

export const auditLogsRelations = relations(auditLogs, ({one}) => ({
	branch: one(branches, {
		fields: [auditLogs.branchId],
		references: [branches.id]
	}),
	organization: one(organizations, {
		fields: [auditLogs.organizationId],
		references: [organizations.id]
	}),
	user: one(users, {
		fields: [auditLogs.userId],
		references: [users.id]
	}),
}));

export const systemLogsRelations = relations(systemLogs, ({one}) => ({
	branch: one(branches, {
		fields: [systemLogs.branchId],
		references: [branches.id]
	}),
	organization: one(organizations, {
		fields: [systemLogs.organizationId],
		references: [organizations.id]
	}),
}));

export const refundItemsRelations = relations(refundItems, ({one}) => ({
	orderItem: one(orderItems, {
		fields: [refundItems.orderItemId],
		references: [orderItems.id]
	}),
	refund: one(refunds, {
		fields: [refundItems.refundId],
		references: [refunds.id]
	}),
}));

export const scheduledReportsRelations = relations(scheduledReports, ({one}) => ({
	organization: one(organizations, {
		fields: [scheduledReports.organizationId],
		references: [organizations.id]
	}),
	user: one(users, {
		fields: [scheduledReports.userId],
		references: [users.id]
	}),
}));

export const budgetAddonsRelations = relations(budgetAddons, ({one}) => ({
	budget: one(budgets, {
		fields: [budgetAddons.budgetId],
		references: [budgets.id]
	}),
	user: one(users, {
		fields: [budgetAddons.createdByUserId],
		references: [users.id]
	}),
}));

export const budgetsRelations = relations(budgets, ({one, many}) => ({
	budgetAddons: many(budgetAddons),
	branch: one(branches, {
		fields: [budgets.branchId],
		references: [branches.id]
	}),
	organization: one(organizations, {
		fields: [budgets.organizationId],
		references: [organizations.id]
	}),
}));

export const restockRequestsRelations = relations(restockRequests, ({one}) => ({
	branch: one(branches, {
		fields: [restockRequests.branchId],
		references: [branches.id]
	}),
	globalProduct: one(globalProducts, {
		fields: [restockRequests.globalProductId],
		references: [globalProducts.id]
	}),
	organization: one(organizations, {
		fields: [restockRequests.organizationId],
		references: [organizations.id]
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