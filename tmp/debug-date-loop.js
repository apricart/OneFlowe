const startDate = new Date("2020-01-01");
const endDate = new Date("2026-03-22T23:59:59.999Z"); // Mock current server time
startDate.setHours(0, 0, 0, 0);

const periods = new Set();
let curr = new Date(startDate);
while (curr <= endDate) {
    const p = curr.toISOString().slice(0, 7);
    periods.add(p);
    console.log(`Adding period: ${p} (Current Date: ${curr.toISOString()})`);
    curr.setMonth(curr.getMonth() + 1);
    if (curr.getDate() > 28) curr.setDate(1); 
}
const periodList = Array.from(periods);
console.log("March 2026 check:", periodList.includes("2026-03"));
console.log("Total periods:", periodList.length);
