import { testConnection } from "./lib/db";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

async function test() {
    console.log("Testing database connection...");
    const result = await testConnection();
    if (result) {
        console.log("✅ Connection successful!");
        process.exit(0);
    } else {
        console.log("❌ Connection failed!");
        process.exit(1);
    }
}

test();
