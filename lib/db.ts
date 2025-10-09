import { neon } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-http"

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL env var is required")
}

const neonClient = neon(process.env.DATABASE_URL)
export const db = drizzle(neonClient)
