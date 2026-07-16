#!/usr/bin/env tsx
/**
 * Export the runtime database to a SQL file.
 * Usage: tsx scripts/export-db.ts [output-file.sql]
 */

import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { databaseToolEnv } from '../lib/server/database-tool-env'

const parsedUrl = new URL(databaseToolEnv.DATABASE_URL)
const databaseConfig = {
  host: parsedUrl.hostname,
  port: parsedUrl.port || '5432',
  database: parsedUrl.pathname.slice(1),
  user: parsedUrl.username,
  password: parsedUrl.password,
}

const outputFile =
  process.argv[2] || `database-export-${new Date().toISOString().split('T')[0]}.sql`
const outputPath = join(process.cwd(), outputFile)

console.log('Exporting database...')
console.log(`Output: ${outputPath}`)

try {
  const dump = execFileSync(
    'pg_dump',
    [
      `--host=${databaseConfig.host}`,
      `--port=${databaseConfig.port}`,
      `--username=${databaseConfig.user}`,
      `--dbname=${databaseConfig.database}`,
      '--no-owner',
      '--no-acl',
      '--clean',
      '--if-exists',
      '--verbose',
    ],
    {
      env: {
        ...process.env,
        PGPASSWORD: databaseConfig.password,
      },
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )

  writeFileSync(outputPath, dump, 'utf-8')
  console.log(`Database exported successfully (${(dump.length / 1024).toFixed(2)} KB).`)
} catch {
  console.error('Database export failed. Verify pg_dump is installed and DATABASE_URL is valid.')
  process.exit(1)
}
