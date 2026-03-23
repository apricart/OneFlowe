import { db } from "../lib/db";
import { organizations, branches, budgets } from "../db/schema";
import { and, eq, gte, lte, inArray, sql, desc } from "drizzle-orm";

async function debugRaw() {
  try {
    const userRole = "SUPER_ADMIN";
    const allowedOrgId = 1;
    const granularity = "yearly";
    const periodList = ["2019-12"]; // Just a snippet
    // ... I'll just copy the core logic
    
    const b = await db.select().from(branches).where(eq(branches.organizationId, allowedOrgId));
    const branchIds = b.map(br => br.id);
    const activeBranches = b;
    const actualBranchIds = branchIds;

    const startDate = new Date("2020-01-01");
    const endDate = new Date();
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);

    const periods = new Set<string>();
    let startYear = startDate.getFullYear();
    let startMonth = startDate.getMonth();
    let endYear = endDate.getFullYear();
    let endMonth = endDate.getMonth();
    for (let y = startYear; y <= endYear; y++) {
        let mStart = (y === startYear) ? startMonth : 0;
        let mEnd = (y === endYear) ? endMonth : 11;
        for (let m = mStart; m <= mEnd; m++) {
            periods.add(`${y}-${String(m + 1).padStart(2, '0')}`);
        }
    }
    const fullPeriodList = Array.from(periods);

    const budgetRecords = await db.select().from(budgets).where(
        and(inArray(budgets.branchId, actualBranchIds), inArray(budgets.period, fullPeriodList))
    );

    const budgetLookup: any = {};
    budgetRecords.forEach(r => {
        if (!budgetLookup[r.branchId]) budgetLookup[r.branchId] = {};
        budgetLookup[r.branchId][r.period] = r;
    });

    const chartDataMap: any = {};
    periods.forEach(p => { chartDataMap[p] = { period: p, branches: {} }; });

    activeBranches.forEach(branch => {
        fullPeriodList.forEach(period => {
            if (!chartDataMap[period]) return;
            const record = budgetLookup[branch.id]?.[period];
            const baselineSetting = branch.baselineBudgetCents || 0;
            const allocated = record ? (record.amountAllocatedCents || 0) : 0;
            const credited = record ? (record.amountCreditedCents || 0) : 0;
            const baseline = Math.min(allocated, baselineSetting);
            const addon = (allocated - baseline) + credited;
            const spent = record ? (record.amountSpentCents || 0) : 0;
            if (!chartDataMap[period].branches[branch.id]) {
                chartDataMap[period].branches[branch.id] = { branchName: branch.name, baseline: 0, addon: 0, spent: 0 };
            }
            chartDataMap[period].branches[branch.id].baseline += baseline;
            chartDataMap[period].branches[branch.id].addon += addon;
            chartDataMap[period].branches[branch.id].spent += spent;
        });
    });

    const yearlyMap: any = {};
    Object.values(chartDataMap).forEach((d: any) => {
        const year = d.period.slice(0, 4);
        if (!yearlyMap[year]) yearlyMap[year] = { date: year, branches: {} };
        Object.entries(d.branches).forEach(([bid, bdata]: [string, any]) => {
            if (!yearlyMap[year].branches[bid]) {
                yearlyMap[year].branches[bid] = { ...bdata };
            } else {
                yearlyMap[year].branches[bid].baseline += bdata.baseline;
                yearlyMap[year].branches[bid].addon += bdata.addon;
                yearlyMap[year].branches[bid].spent += bdata.spent;
            }
        });
    });

    const finalChartData = Object.values(yearlyMap).map((d: any) => ({
        date: d.date,
        branches: Object.entries(d.branches).map(([id, data]: [string, any]) => ({ branchId: id, ...data }))
    }));

    console.log("FINAL CHART DATA (LAST YEAR):", JSON.stringify(finalChartData.filter(d => d.date === "2026"), null, 2));

  } catch (error) {
    console.error("Debug Error:", error);
  } finally {
    process.exit(0);
  }
}

debugRaw();
