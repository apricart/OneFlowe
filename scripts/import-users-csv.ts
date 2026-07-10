#!/usr/bin/env tsx
/**
 * Import users from CSV for K-Electric.
 *
 * Usage:
 *   npx tsx scripts/import-users-csv.ts
 *     Dry run for BRANCH_ADMIN users. No DB writes.
 *
 *   npx tsx scripts/import-users-csv.ts --role ORDER_PORTAL
 *     Dry run for ORDER_PORTAL users. Usernames get the default "_op" suffix.
 *
 *   npx tsx scripts/import-users-csv.ts --role ORDER_PORTAL --insert
 *     Live insert for ORDER_PORTAL users.
 *
 * Notes:
 *   - K-Electric is intentionally fixed to database ID 10 / display code 0001.
 *   - ORDER_PORTAL and BRANCH_ADMIN users are branch-scoped, so CSV Location is
 *     resolved to a K-Electric branch and stored as branchId.
 *   - Usernames are stored lowercase because login normalizes input to lowercase.
 *     For ORDER_PORTAL, "1703154_OP" entered at login becomes "1703154_op",
 *     so the importer stores "1703154_op".
 *
 * Decisions applied:
 *   - Row 83 (Imran Khan Muhammad): skipped, no email.
 *   - Row 115 (Hafiz M. Irfan): Location "1. GSO" maps to "GSO" branch.
 *   - Last Name "-" is stored as null.
 *   - Last Name with job titles is stored as-is.
 *   - Shared emails are allowed because email is not unique in users schema.
 *   - Department column is ignored because there is no DB column for it.
 */

import { readFileSync } from "fs"
import { resolve } from "path"
import * as dotenv from "dotenv"

dotenv.config({ path: ".env.local" })
dotenv.config()

type ImportRole = "BRANCH_ADMIN" | "ORDER_PORTAL"

const CSV_PATH = resolve("userlist.csv")
const ORG_ID = 10 // K-Electric database primary key
const ORG_CODE = "0001" // K-Electric display/business code shown in the app
const DEFAULT_ROLE: ImportRole = "BRANCH_ADMIN"
const DEFAULT_ORDER_PORTAL_SUFFIX = "_op"
const DRY_RUN = !process.argv.includes("--insert")
const BCRYPT_SALT_ROUNDS = 12 // same as app default in lib/password.ts

// CSV Location value (lowercase) -> branch name to look up.
const LOCATION_OVERRIDES: Record<string, string> = {
  "1. gso": "gso",
}

// File line numbers to skip (1-indexed header = line 1, first data = line 2).
const SKIP_LINE_NOS = new Set([83]) // Line 83: Imran Khan Muhammad, missing email

interface UserRow {
  lineNo: number
  firstName: string
  lastName: string | null
  location: string
  password: string
  loginCode: string
  email: string
  fullName: string
}

interface Options {
  roleName: ImportRole
  usernameSuffix: string
}

function getArgValue(name: string): string | undefined {
  const prefix = `${name}=`
  const inline = process.argv.find((arg) => arg.startsWith(prefix))
  if (inline) return inline.slice(prefix.length)

  const index = process.argv.indexOf(name)
  if (index >= 0) return process.argv[index + 1]

  return undefined
}

function parseOptions(): Options {
  const rawRole = (getArgValue("--role") || DEFAULT_ROLE).trim().toUpperCase()
  if (rawRole !== "BRANCH_ADMIN" && rawRole !== "ORDER_PORTAL") {
    console.error(`Invalid --role "${rawRole}". Supported roles: BRANCH_ADMIN, ORDER_PORTAL.`)
    process.exit(1)
  }

  const rawSuffix = getArgValue("--username-suffix")
  const usernameSuffix =
    rawSuffix !== undefined
      ? rawSuffix.trim().toLowerCase()
      : rawRole === "ORDER_PORTAL"
        ? DEFAULT_ORDER_PORTAL_SUFFIX
        : ""

  if (rawRole === "ORDER_PORTAL" && !usernameSuffix) {
    console.error("ORDER_PORTAL import requires a username suffix. Default is _op.")
    process.exit(1)
  }

  return {
    roleName: rawRole,
    usernameSuffix,
  }
}

function normalizeUsername(loginCode: string, usernameSuffix: string): string {
  return `${loginCode.trim()}${usernameSuffix}`.toLowerCase()
}

function branchLookupKey(location: string): string {
  const key = location.toLowerCase().trim()
  return LOCATION_OVERRIDES[key] ?? key
}

function parseCSV(): { parsed: UserRow[]; skipped: { lineNo: number; reason: string }[] } {
  const raw = readFileSync(CSV_PATH, "utf-8")
  const lines = raw.split(/\r?\n/)

  const parsed: UserRow[] = []
  const skipped: { lineNo: number; reason: string }[] = []

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    const lineNo = i + 1
    const cols = line.split(",")

    const firstName = (cols[0] || "").trim()
    const rawLast = (cols[1] || "").trim()
    const location = (cols[2] || "").trim()
    const password = (cols[3] || "").trim()
    const loginCode = (cols[4] || "").trim()
    const email = (cols[5] || "").trim().toLowerCase()

    if (SKIP_LINE_NOS.has(lineNo)) {
      skipped.push({ lineNo, reason: `missing email - ${firstName} ${rawLast}` })
      continue
    }

    if (!firstName) continue
    if (!email) {
      skipped.push({ lineNo, reason: `missing email - ${firstName} ${rawLast}` })
      continue
    }
    if (!loginCode) {
      skipped.push({ lineNo, reason: `missing login code - ${firstName} ${rawLast}` })
      continue
    }
    if (!password) {
      skipped.push({ lineNo, reason: `missing password - ${firstName} ${rawLast}` })
      continue
    }

    const lastName = rawLast === "-" || rawLast === "" ? null : rawLast
    const fullName = lastName ? `${firstName} ${lastName}` : firstName

    parsed.push({ lineNo, firstName, lastName, location, password, loginCode, email, fullName })
  }

  return { parsed, skipped }
}

async function main() {
  const options = parseOptions()
  const { parsed, skipped } = parseCSV()

  console.log("\n============================================================")
  console.log(`  User CSV Import - ${DRY_RUN ? "DRY RUN (no DB writes)" : "LIVE INSERT"}`)
  console.log("============================================================")
  console.log(`  File            : ${CSV_PATH}`)
  console.log(`  Org             : K-Electric (db id=${ORG_ID}, code=${ORG_CODE})`)
  console.log(`  Role            : ${options.roleName}`)
  console.log(`  Username suffix : ${options.usernameSuffix || "(none)"}`)
  console.log(`  Parsed rows     : ${parsed.length}`)
  console.log(`  Pre-skipped     : ${skipped.length}`)
  console.log("------------------------------------------------------------\n")

  const { db } = await import("../lib/db")
  const { branches, users, organizations, roles, employeeCredentials } = await import("../db/schema")
  const { eq } = await import("drizzle-orm")

  const [org] = await db
    .select({ id: organizations.id, name: organizations.name, code: organizations.code })
    .from(organizations)
    .where(eq(organizations.id, ORG_ID))
    .limit(1)

  if (!org) {
    console.error(`\nOrganization id=${ORG_ID} not found. Aborting.`)
    process.exit(1)
  }

  const [role] = await db
    .select({ id: roles.id, name: roles.name })
    .from(roles)
    .where(eq(roles.name, options.roleName))
    .limit(1)

  if (!role) {
    console.error(`\nRole ${options.roleName} not found. Aborting.`)
    process.exit(1)
  }

  if (org.id !== ORG_ID || org.code !== ORG_CODE || org.name.toLowerCase() !== "k-electric") {
    console.error(
      `\nSafety check failed. Expected K-Electric db id=${ORG_ID}, code=${ORG_CODE}; got ${org.name} db id=${org.id}, code=${org.code}.`,
    )
    process.exit(1)
  }

  const allBranches = await db
    .select({ id: branches.id, name: branches.name, code: branches.code })
    .from(branches)
    .where(eq(branches.organizationId, ORG_ID))

  const branchMap = new Map<string, { id: number; name: string; code: string | null }>()
  for (const branch of allBranches) {
    branchMap.set(branch.name.toLowerCase().trim(), branch)
  }

  console.log(`Verified org  : ${org.name} (db id=${org.id}, code=${org.code})`)
  console.log(`Verified role : ${role.name} (id=${role.id})`)
  console.log(`Branches read : ${allBranches.length}\n`)

  if (DRY_RUN) {
    console.log("DRY RUN PREVIEW (would be inserted):\n")
  } else {
    console.log(`Inserting ${parsed.length} users...\n`)
  }

  const bcrypt = DRY_RUN ? null : await import("bcryptjs")

  let inserted = 0
  let wouldInsert = 0
  let skippedNoBranch = 0
  let skippedDuplicateCsv = 0
  let skippedDuplicateUser = 0
  let skippedDuplicateEmployee = 0
  const seenUsernames = new Set<string>()

  for (const row of parsed) {
    const username = normalizeUsername(row.loginCode, options.usernameSuffix)
    const branch = branchMap.get(branchLookupKey(row.location))

    if (seenUsernames.has(username)) {
      console.log(`  SKIP [L${row.lineNo}] Username "${username}" is duplicated in CSV - ${row.fullName}`)
      skippedDuplicateCsv++
      continue
    }
    seenUsernames.add(username)

    if (!branch) {
      console.log(`  SKIP [L${row.lineNo}] Branch not found: "${row.location}" - ${row.fullName}`)
      skippedNoBranch++
      continue
    }

    const [existingUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, username))
      .limit(1)

    if (existingUser) {
      console.log(`  SKIP [L${row.lineNo}] Username "${username}" already exists in users - ${row.fullName}`)
      skippedDuplicateUser++
      continue
    }

    const [existingEmployee] = await db
      .select({ id: employeeCredentials.id })
      .from(employeeCredentials)
      .where(eq(employeeCredentials.username, username))
      .limit(1)

    if (existingEmployee) {
      console.log(`  SKIP [L${row.lineNo}] Username "${username}" already exists in employee credentials - ${row.fullName}`)
      skippedDuplicateEmployee++
      continue
    }

    if (DRY_RUN) {
      console.log(`  OK [L${row.lineNo}] ${row.fullName}`)
      console.log(`       username : ${username}`)
      console.log(`       email    : ${row.email}`)
      console.log(`       branch   : ${branch.name} (id=${branch.id}, code=${branch.code})`)
      wouldInsert++
      continue
    }

    const passwordHash = await bcrypt!.default.hash(row.password, BCRYPT_SALT_ROUNDS)

    await db.insert(users).values({
      email: row.email,
      username,
      passwordHash,
      roleId: role.id,
      organizationId: ORG_ID,
      branchId: branch.id,
      firstName: row.firstName,
      lastName: row.lastName,
      fullName: row.fullName,
      isActive: true,
      mfaEnabled: false,
      mustChangePassword: false,
      sessionVersion: 1,
    })

    console.log(`  INSERTED [L${row.lineNo}] ${row.fullName} | @${username} | ${branch.name}`)
    inserted++
  }

  console.log("\nPre-skipped rows:")
  if (skipped.length === 0) {
    console.log("  None")
  } else {
    skipped.forEach((item) => console.log(`  Line ${item.lineNo}: ${item.reason}`))
  }

  console.log("\n------------------------------------------------------------")
  console.log("  Summary")
  console.log(`    ${DRY_RUN ? "Would insert" : "Inserted"}              : ${DRY_RUN ? wouldInsert : inserted}`)
  console.log(`    Skipped (pre-check)        : ${skipped.length}`)
  console.log(`    Skipped (no branch)        : ${skippedNoBranch}`)
  console.log(`    Skipped (duplicate CSV)    : ${skippedDuplicateCsv}`)
  console.log(`    Skipped (duplicate users)  : ${skippedDuplicateUser}`)
  console.log(`    Skipped (duplicate emp)    : ${skippedDuplicateEmployee}`)
  console.log("------------------------------------------------------------")

  if (DRY_RUN) {
    console.log("\nNothing written to DB.")
    console.log("When ready, run:")
    console.log(`  npx tsx scripts/import-users-csv.ts --role ${options.roleName} --insert`)
    if (options.roleName === "ORDER_PORTAL") {
      console.log("\nFor Order Portal, users can log in with the suffixed username, e.g. 1703154_op.")
    }
  }

  console.log("")
  process.exit(0)
}

main().catch((err) => {
  console.error("\nError:", err.message)
  process.exit(1)
})
