#!/usr/bin/env tsx
/**
 * Export database to SQL file
 * Usage: tsx scripts/export-db.ts [output-file.sql]
 */

import { execSync } from "child_process"
import { writeFileSync } from "fs"
import { join } from "path"
import * as dotenv from "dotenv"

// Load environment variables (try .env.local first, then .env)
dotenv.config({ path: ".env.local" })
dotenv.config() // This will not override existing variables

const DATABASE_URL = process.env.DATABASE_URL

if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL environment variable is not set")
  console.error("Please set DATABASE_URL in your .env file")
  process.exit(1)
}

// Parse DATABASE_URL
function parseDatabaseUrl(url: string) {
  try {
    const urlObj = new URL(url)
    return {
      host: urlObj.hostname,
      port: parseInt(urlObj.port) || 5432,
      database: urlObj.pathname.slice(1), // Remove leading slash
      user: urlObj.username,
      password: urlObj.password,
    }
  } catch (error) {
    console.error("Failed to parse DATABASE_URL:", error)
    process.exit(1)
  }
}

const dbConfig = parseDatabaseUrl(DATABASE_URL)

// Get output filename from command line or use default
const outputFile = process.argv[2] || `database-export-${new Date().toISOString().split('T')[0]}.sql`
const outputPath = join(process.cwd(), outputFile)

console.log("📦 Exporting database...")
console.log(`   Database: ${dbConfig.database}`)
console.log(`   Host: ${dbConfig.host}:${dbConfig.port}`)
console.log(`   Output: ${outputPath}`)

try {
  // Build pg_dump command
  // Using PGPASSWORD environment variable to avoid password prompt
  const env = {
    ...process.env,
    PGPASSWORD: dbConfig.password,
  }

  const pgDumpCommand = [
    "pg_dump",
    `--host=${dbConfig.host}`,
    `--port=${dbConfig.port}`,
    `--username=${dbConfig.user}`,
    `--dbname=${dbConfig.database}`,
    "--no-owner", // Don't output commands to set ownership of objects
    "--no-acl", // Don't output access privileges (grant/revoke commands)
    "--clean", // Include commands to clean (drop) database objects before creating
    "--if-exists", // Use IF EXISTS when dropping objects
    "--verbose", // Verbose mode
  ].join(" ")

  console.log("\n⏳ Running pg_dump...")
  const dump = execSync(pgDumpCommand, {
    env,
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "pipe"], // stdin: ignore, stdout: pipe, stderr: pipe
  })

  // Write to file
  writeFileSync(outputPath, dump, "utf-8")

  const fileSize = (dump.length / 1024).toFixed(2)
  console.log(`\n✅ Database exported successfully!`)
  console.log(`   File: ${outputPath}`)
  console.log(`   Size: ${fileSize} KB`)
  console.log(`\n💡 To import this database, use:`)
  console.log(`   psql -d <database_name> -f ${outputFile}`)
} catch (error: any) {
  console.error("\n❌ Error exporting database:")
  if (error.message) {
    console.error(error.message)
  }
  if (error.stderr) {
    console.error(error.stderr.toString())
  }
  console.error("\n💡 Make sure:")
  console.error("   1. PostgreSQL client tools (pg_dump) are installed")
  console.error("   2. DATABASE_URL is correctly set in .env file")
  console.error("   3. You have access to the database")
  process.exit(1)
}

