import { db } from "./lib/db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("Fixing indexes — only username should be unique...");
  try {
    const res: any = await db.execute(sql`
      SELECT indexname, indexdef, tablename
      FROM pg_indexes 
      WHERE tablename IN ('users', 'employee_credentials')
      AND indexdef LIKE '%UNIQUE%';
    `);
    const rows = res.rows || res;
    console.log("Current UNIQUE indexes:");
    for (const r of rows) {
      console.log(`  ${r.tablename}.${r.indexname}: ${r.indexdef}`);
    }

    for (const r of rows) {
      const name = r.indexname as string;
      // Keep username unique index — that's the only one we want
      if (name === "users_username_idx") {
        console.log(`  KEEPING unique: ${name}`);
        continue;
      }
      // Keep primary keys
      if (name.includes("pkey")) {
        console.log(`  KEEPING pkey: ${name}`);
        continue;
      }

      // Drop and recreate as non-unique
      console.log(`  DROPPING unique: ${name}`);
      try {
        await db.execute(sql.raw(`DROP INDEX IF EXISTS "${name}"`));
        const newDef = (r.indexdef as string).replace("CREATE UNIQUE INDEX", "CREATE INDEX");
        console.log(`  RECREATING as non-unique: ${newDef}`);
        await db.execute(sql.raw(newDef));
        console.log(`  ✅ Fixed: ${name}`);
      } catch (err: any) {
        console.error(`  ❌ Error fixing ${name}:`, err.message);
      }
    }

    console.log("\nDone! Verifying remaining unique indexes on users:");
    const verify: any = await db.execute(sql`
      SELECT indexname, indexdef
      FROM pg_indexes 
      WHERE tablename = 'users' AND indexdef LIKE '%UNIQUE%';
    `);
    const vrows = verify.rows || verify;
    for (const r of vrows) {
      console.log(`  ${r.indexname}: ${r.indexdef}`);
    }

  } catch (err) {
    console.error(err);
  }
  process.exit(0);
}

main();
