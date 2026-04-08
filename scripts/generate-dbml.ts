import * as schema from "../db/schema";
import { pgGenerate } from "drizzle-dbml-generator";
import { join } from "path";

const out = join(process.cwd(), "drizzle.dbml");
const relational = false;

console.log("🚀 Generating DBML from Drizzle schema (Standard API mode)...");

try {
  pgGenerate({ schema, out, relational });
  console.log(`✅ DBML generated successfully at ${out}`);
} catch (error) {
  console.error("❌ Error generating DBML:");
  console.error(error);
  process.exit(1);
}
