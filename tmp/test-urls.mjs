import { fetch } from 'node-fetch';

async function testAllTime() {
    const params = new URLSearchParams({
        startDate: "2000-01-01T00:00:00.000Z",
        endDate: new Date().toISOString(),
        status: "all"
    });
    
    console.log("Testing summary API...");
    // This will likely fail due to lack of session, but we can see the URL it generates
    const urlSummary = `http://localhost:3000/api/v1/analytics/summary?${params.toString()}`;
    console.log("URL:", urlSummary);

    console.log("\nTesting sales-performance API...");
    const urlPerf = `http://localhost:3000/api/v1/analytics/sales-performance?${params.toString()}`;
    console.log("URL:", urlPerf);
}

testAllTime();
