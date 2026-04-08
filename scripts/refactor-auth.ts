const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '../lib/auth-options.ts');
let code = fs.readFileSync(file, 'utf8');

// Add import
if (!code.includes('withSuperAdmin')) {
  code = code.replace(/import { db } from "@\/lib\/db"/, 'import { db, withSuperAdmin } from "@/lib/db"');
}

// Replace multi-line db queries
// Pattern: await db.select(...).from(...).where(...).limit(1)
const replacementMatches = [
  // users
  {
    find: /const \[u\] = await db\s+\.select\(\{([\s\S]*?)\}\)\s+\.from\(users\)\s+\.where\(and\(eq\(users\.username, username\), isNull\(users\.deletedAt\)\)\)/g,
    replace: "const [u] = await withSuperAdmin(async (tx) => tx\n          .select({$1})\n          .from(users)\n          .where(and(eq(users.username, username), isNull(users.deletedAt)))\n        )"
  },
  // orgs
  {
    find: /const \[org\] = await db\s+\.select\(\{ status: organizations\.status \}\)\s+\.from\(organizations\)\s+\.where\(eq\(organizations\.id, ([^\)]+)\)\)\s+\.limit\(1\)/g,
    replace: "const [org] = await withSuperAdmin(async (tx) => tx\n            .select({ status: organizations.status })\n            .from(organizations)\n            .where(eq(organizations.id, $1))\n            .limit(1)\n          )"
  },
  // branches
  {
    find: /const \[branch\] = await db\s+\.select\(\{ status: branches\.status \}\)\s+\.from\(branches\)\s+\.where\(eq\(branches\.id, ([^\)]+)\)\)\s+\.limit\(1\)/g,
    replace: "const [branch] = await withSuperAdmin(async (tx) => tx\n            .select({ status: branches.status })\n            .from(branches)\n            .where(eq(branches.id, $1))\n            .limit(1)\n          )"
  },
  // basic db.select single liners
  {
    find: /const \[r\] = await db\.select\(\)\.from\(roles\)\.where\(eq\(roles\.id, u\.roleId\)\)/g,
    replace: "const [r] = await withSuperAdmin(async (tx) => tx.select().from(roles).where(eq(roles.id, u.roleId)))"
  },
  // session employee lookup
  {
    find: /const \[emp\] = await db\s+\.select\(\{([\s\S]*?)\}\)\s+\.from\(employeeCredentials\)\s+\.where\(eq\(employeeCredentials\.id, numericId\)\)\s+\.limit\(1\)/g,
    replace: "const [emp] = await withSuperAdmin(async (tx) => tx\n              .select({$1})\n              .from(employeeCredentials)\n              .where(eq(employeeCredentials.id, numericId))\n              .limit(1)\n            )"
  },
  // session user lookup
  {
    find: /const \[u\] = await db\s+\.select\(\{([\s\S]*?)\}\)\s+\.from\(users\)\s+\.where\(eq\(users\.id, userId\)\)\s+\.limit\(1\)/g,
    replace: "const [u] = await withSuperAdmin(async (tx) => tx\n              .select({$1})\n              .from(users)\n              .where(eq(users.id, userId))\n              .limit(1)\n            )"
  },
  // Basic employee lookup
  {
    find: /const \[emp\] = await db\s+\.select\(\)\s+\.from\(employeeCredentials\)\s+\.where\(and\(eq\(employeeCredentials\.username, username\), eq\(employeeCredentials\.isActive, true\)\)\)/g,
    replace: "const [emp] = await withSuperAdmin(async (tx) => tx\n          .select()\n          .from(employeeCredentials)\n          .where(and(eq(employeeCredentials.username, username), eq(employeeCredentials.isActive, true)))\n        )"
  }
];

replacementMatches.forEach(rule => {
  code = code.replace(rule.find, rule.replace);
});

fs.writeFileSync(file, code);
console.log("auth-options.ts refactored successfully.");
