import { db } from "../lib/db";
import { organizations, branches, budgets } from "../db/schema";
import { and, eq, gte, lte, inArray, sql, desc } from "drizzle-orm";

async function mock() {
  try {
    const userRole = "SUPER_ADMIN";
    const userOrgId = 1;
    const organizationIdParam = null; // matching the screenshot URL

    let allowedOrgId = userOrgId;
    if (userRole === "SUPER_ADMIN" && organizationIdParam) {
        allowedOrgId = Number(organizationIdParam);
    }
    
    // Reproducing lines 33-48 of route.ts
    let branchIds: number[] = [];
    if (allowedOrgId) {
        const b = await db.select({ id: branches.id }).from(branches).where(eq(branches.organizationId, allowedOrgId));
        branchIds = b.map(br => br.id);
    } else if (userRole === "SUPER_ADMIN") {
        const b = await db.select({ id: branches.id }).from(branches);
        branchIds = b.map(br => br.id);
    }

    console.log("Branch IDs resolved:", branchIds);

    const startDate = new Date("2020-01-01");
    const endDate = new Date(); // Today: March 22, 2026
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);

    const periods = new Set<string>();
    let curr = new Date(startDate);
    while (curr <= endDate) {
        periods.add(curr.toISOString().slice(0, 7));
        curr.setMonth(curr.getMonth() + 1);
        if (curr.getDate() > 28) curr.setDate(1); 
    }
    const periodList = Array.from(periods);
    console.log("Period List length:", periodList.length);
    console.log("Last 5 periods:", periodList.slice(-5));

    const budgetRecords = await db
        .select()
        .from(budgets)
        .where(
            and(
                inArray(budgets.branchId, branchIds),
                inArray(budgets.period, periodList)
            )
        );

    console.log("Budget Records found:", budgetRecords.length);
    
    let totalAllocated = 0;
    budgetRecords.forEach(r => {
        totalAllocated += r.amountAllocatedCents;
    });

    console.log("Total Allocated (cents):", totalAllocated);
    console.log("Total Allocated (Rupees):", totalAllocated / 100);

  } catch (error) {
    console.error("Mock Error:", error);
  } finally {
    process.exit(0);
  }
}

mock();
