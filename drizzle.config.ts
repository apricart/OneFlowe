import { defineConfig } from "drizzle-kit";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

// Debug line: This will print in your terminal so we can see if it's actually loading
console.log("Connecting to:", process.env.DATABASE_URL ? "URL found" : "URL NOT FOUND");

export default defineConfig({
  schema: "./db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql", // or driver: "pg" if this fails
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
});