// @ts-nocheck
import { db } from "./lib/db"
import { users } from "./db/schema"
import { eq } from "drizzle-orm"

async function test() {
  const [u1, u2] = await db.select().from(users).limit(2)
  if (!u1 || !u2) {
    console.log("Not enough users to test.")
    return
  }

  console.log(`Testing with users: ${u1.email} and ${u2.email}`)

  // Try to update u1 to have u2's email
  try {
    const res = await fetch(`http://localhost:3000/api/v1/users/${u1.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: u2.email })
    })
    const data = await res.json()
    console.log("PATCH result (duplicate email):", data.error || "Success")
  } catch (e) {
    console.error("Fetch failed:", e.message)
  }
}

test()
