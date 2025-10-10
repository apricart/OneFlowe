import dotenv from "dotenv"
import { existsSync } from "node:fs"
import { resolve } from "node:path"

const envPath = existsSync(resolve(process.cwd(), ".env.local"))
  ? resolve(process.cwd(), ".env.local")
  : resolve(process.cwd(), ".env")
dotenv.config({ path: envPath })
import type { Config } from "drizzle-kit"

export default {
  schema: "./db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL || "",
  },
  strict: true,
  verbose: true,
} satisfies Config


