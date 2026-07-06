#!/usr/bin/env tsx
/**
 * Import BRANCH_ADMIN users from CSV for K-Electric (org ID 10).
 *
 * Usage:
 *   npx tsx scripts/import-users-csv.ts           → dry run (no DB writes)
 *   npx tsx scripts/import-users-csv.ts --insert  → live insert
 *
 * Decisions applied:
 *  - Row 83  (Imran Khan Muhammad): SKIPPED — no email
 *  - Row 115 (Hafiz M. Irfan):      Location "1. GSO" → mapped to "GSO" branch
 *  - Last Name "-"                 → stored as null
 *  - Last Name with job titles     → stored as-is (user can edit in portal)
 *  - Shared emails                 → intentional, allowed (email is not unique in schema)
 *  - Department column             → ignored (no DB column)
 */

import { readFileSync } from "fs"
import { resolve } from "path"
import * as dotenv from "dotenv"
dotenv.config({ path: ".env.local" })
dotenv.config()

// ─── Config ────────────────────────────────────────────────────────────────

const CSV_PATH           = resolve("userlist.csv")
const ORG_ID             = 10  // K-Electric
const ROLE_ID            = 3   // BRANCH_ADMIN
const DRY_RUN            = !process.argv.includes("--insert")
const BCRYPT_SALT_ROUNDS = 12  // same as app default in lib/password.ts

// Location overrides: CSV value (lowercase) → branch name to look up
const LOCATION_OVERRIDES: Record<string, string> = {
  "1. gso": "gso",
}

// File line numbers to skip (1-indexed header = line 1, first data = line 2)
const SKIP_LINE_NOS = new Set([83]) // Line 83: Imran Khan Muhammad — missing email

// ─── Types ─────────────────────────────────────────────────────────────────

interface UserRow {
  lineNo:    number
  firstName: string
  lastName:  string | null   // null if "-" or empty
  location:  string          // raw CSV value
  password:  string
  loginCode: string          // → username
  email:     string
  fullName:  string
}

// ─── Parse CSV ─────────────────────────────────────────────────────────────

function parseCSV(): { parsed: UserRow[]; skipped: { lineNo: number; reason: string }[] } {
  const raw   = readFileSync(CSV_PATH, "utf-8")
  const lines = raw.split(/\r?\n/)

  const parsed:  UserRow[]                             = []
  const skipped: { lineNo: number; reason: string }[] = []

  // i=0 is header, data starts at i=1 → lineNo = i+1 (so header=line1, first data=line2)
  for (let i = 1; i < lines.length; i++) {
    const line   = lines[i].trim()
    if (!line) continue

    const lineNo = i + 1
    const cols   = line.split(",")

    const firstName = (cols[0] || "").trim()
    const rawLast   = (cols[1] || "").trim()
    const location  = (cols[2] || "").trim()
    const password  = (cols[3] || "").trim()
    const loginCode = (cols[4] || "").trim()
    const email     = (cols[5] || "").trim()

    if (SKIP_LINE_NOS.has(lineNo)) {
      skipped.push({ lineNo, reason: `missing email — ${firstName} ${rawLast}` })
      continue
    }

    if (!firstName) continue

    const lastName = (rawLast === "-" || rawLast === "") ? null : rawLast
    const fullName = lastName ? `${firstName} ${lastName}` : firstName

    parsed.push({ lineNo, firstName, lastName, location, password, loginCode, email, fullName })
  }

  return { parsed, skipped }
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
  const { parsed, skipped } = parseCSV()

  console.log("\n════════════════════════════════════════════════════════════")
  console.log(`  User CSV Import  —  ${DRY_RUN ? "DRY RUN (no DB writes)" : "⚠  LIVE INSERT"}`)
  console.log("════════════════════════════════════════════════════════════")
  console.log(`  File        : ${CSV_PATH}`)
  console.log(`  Org         : K-Electric (id=${ORG_ID})`)
  console.log(`  Role        : BRANCH_ADMIN (id=${ROLE_ID})`)
  console.log(`  Parsed rows : ${parsed.length}`)
  console.log(`  Pre-skipped : ${skipped.length}`)
  console.log("────────────────────────────────────────────────────────────\n")

  // Always load DB (needed even in dry run for branch name resolution)
  const { db }                             = await import("../lib/db")
  const { branches, users, organizations, roles } = await import("../db/schema")
  const { eq }                             = await import("drizzle-orm")

  // Build branch map for K-Electric
  const allBranches = await db
    .select({ id: branches.id, name: branches.name, code: branches.code })
    .from(branches)
    .where(eq(branches.organizationId, ORG_ID))

  const branchMap = new Map<string, { id: number; name: string; code: string }>()
  for (const b of allBranches) branchMap.set(b.name.toLowerCase().trim(), b)

  // ── DRY RUN ────────────────────────────────────────────────────────────

  if (DRY_RUN) {
    console.log("DRY RUN PREVIEW (would be inserted):\n")
    let wouldInsert = 0
    let wouldSkip   = 0

    for (const u of parsed) {
      const locationKey = LOCATION_OVERRIDES[u.location.toLowerCase()] ?? u.location.toLowerCase()
      const branch      = branchMap.get(locationKey)

      if (!branch) {
        console.log(`  ⚠  [L${u.lineNo}] BRANCH NOT FOUND: "${u.location}" — ${u.fullName}`)
        wouldSkip++
      } else {
        console.log(`  ✓  [L${u.lineNo}] ${u.fullName}`)
        console.log(`       username : ${u.loginCode}`)
        console.log(`       email    : ${u.email}`)
        console.log(`       branch   : ${branch.name} (id=${branch.id}, code=${branch.code})`)
        wouldInsert++
      }
    }

    console.log(`\n  Pre-skipped rows:`)
    skipped.forEach(s => console.log(`    Line ${s.lineNo}: ${s.reason}`))

    console.log("\n────────────────────────────────────────────────────────────")
    console.log(`  Would insert : ${wouldInsert}`)
    console.log(`  Would skip   : ${wouldSkip + skipped.length}  (${skipped.length} pre-skipped + ${wouldSkip} no branch match)`)
    console.log("\n  Nothing written to DB.")
    console.log("  When ready, run with --insert flag:")
    console.log("    npx tsx scripts/import-users-csv.ts --insert")
    console.log("────────────────────────────────────────────────────────────\n")
    process.exit(0)
  }

  // ── LIVE INSERT ────────────────────────────────────────────────────────

  const bcrypt = await import("bcryptjs")

  // Safety: verify org and role exist
  const [org] = await db
    .select({ id: organizations.id, name: organizations.name })
    .from(organizations)
    .where(eq(organizations.id, ORG_ID))
    .limit(1)
  if (!org) { console.error(`\n❌  Organization id=${ORG_ID} not found`); process.exit(1) }

  const [role] = await db
    .select({ id: roles.id, name: roles.name })
    .from(roles)
    .where(eq(roles.id, ROLE_ID))
    .limit(1)
  if (!role) { console.error(`\n❌  Role id=${ROLE_ID} not found`); process.exit(1) }

  console.log(`✓  Org  : ${org.name} (id=${org.id})`)
  console.log(`✓  Role : ${role.name} (id=${role.id})`)
  console.log(`\n  Inserting ${parsed.length} users...\n`)

  let inserted         = 0
  let skippedNoBranch  = 0
  let skippedDuplicate = 0

  for (const u of parsed) {
    const locationKey = LOCATION_OVERRIDES[u.location.toLowerCase()] ?? u.location.toLowerCase()
    const branch      = branchMap.get(locationKey)

    if (!branch) {
      console.log(`  SKIP [L${u.lineNo}] Branch not found: "${u.location}" — ${u.fullName}`)
      skippedNoBranch++
      continue
    }

    // Unique index covers ALL rows (including soft-deleted) — check without deletedAt filter
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, u.loginCode))
      .limit(1)

    if (existing) {
      console.log(`  SKIP [L${u.lineNo}] Username "${u.loginCode}" already exists — ${u.fullName}`)
      skippedDuplicate++
      continue
    }

    // Hash with bcrypt directly — bypasses UI-only validatePassword() which
    // enforces complexity rules not appropriate for bulk admin imports
    const passwordHash = await bcrypt.default.hash(u.password, BCRYPT_SALT_ROUNDS)

    await db.insert(users).values({
      email:              u.email,
      username:           u.loginCode,
      passwordHash,
      roleId:             ROLE_ID,
      organizationId:     ORG_ID,
      branchId:           branch.id,
      firstName:          u.firstName,
      lastName:           u.lastName,
      fullName:           u.fullName,
      isActive:           true,
      mfaEnabled:         false,
      mustChangePassword: false,
      sessionVersion:     1,
    })

    console.log(`  ✓  [L${u.lineNo}] ${u.fullName}  |  @${u.loginCode}  |  ${branch.name}`)
    inserted++
  }

  console.log("\n════════════════════════════════════════════════════════════")
  console.log(`  Done.`)
  console.log(`    Inserted            : ${inserted}`)
  console.log(`    Skipped (no branch) : ${skippedNoBranch}`)
  console.log(`    Skipped (dup login) : ${skippedDuplicate}`)
  console.log(`    Skipped (no email)  : ${skipped.length}`)
  console.log("════════════════════════════════════════════════════════════\n")
}

main().catch(err => {
  console.error("\n❌  Error:", err.message)
  process.exit(1)
})
