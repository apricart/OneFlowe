import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    // Correct host for your project
    host: "aws-1-ap-south-1.pooler.supabase.com", 
    port: 5432,
    // Correct username format for Supabase pooling
    user: "postgres.csxwfjwjkxqytobgzrtt", 
    password: "fv9g!Kp8?,/$tDk",
    database: "postgres",
    ssl: { rejectUnauthorized: false },
  },
});