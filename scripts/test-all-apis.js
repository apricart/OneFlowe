/**
 * Complete API & RLS Validation System
 * Run: node scripts/test-all-apis.js
 */

const http = require('http');
const https = require('https');

const BASE_URL = 'http://localhost:3000';

// Color codes for output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

const results = {
  passed: [],
  failed: [],
  warnings: []
};

function log(message, color = colors.reset) {
  console.log(color + message + colors.reset);
}

function makeRequest(path, method = 'GET') {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + path);
    const client = url.protocol === 'https:' ? https : http;
    
    const options = {
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Accept': 'application/json',
      },
      timeout: 15000
    };

    const req = client.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = data ? JSON.parse(data) : null;
          resolve({ status: res.statusCode, data: json, raw: data });
        } catch {
          resolve({ status: res.statusCode, data: null, raw: data });
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => reject(new Error('Timeout')));
    req.end();
  });
}

async function testEndpoint(name, path, expectedStatus = 200) {
  process.stdout.write(`Testing ${name}... `);
  
  try {
    const start = Date.now();
    const res = await makeRequest(path);
    const duration = Date.now() - start;
    
    if (res.status === expectedStatus) {
      log(`✅ ${res.status} (${duration}ms)`, colors.green);
      results.passed.push({ name, status: res.status, duration });
      return true;
    } else if (res.status === 401 || res.status === 403) {
      log(`⚠️  ${res.status} - Auth/RLS issue (${duration}ms)`, colors.yellow);
      results.warnings.push({ name, status: res.status, duration, error: 'Auth/RLS' });
      return false;
    } else {
      log(`❌ ${res.status} (${duration}ms)`, colors.red);
      if (res.data?.error) log(`   Error: ${res.data.error}`, colors.red);
      results.failed.push({ name, status: res.status, duration, error: res.data?.error });
      return false;
    }
  } catch (err) {
    log(`❌ ${err.message}`, colors.red);
    results.failed.push({ name, status: 'ERROR', error: err.message });
    return false;
  }
}

async function runTests() {
  log('\n╔══════════════════════════════════════════════════════════╗', colors.cyan);
  log('║        API & RLS COMPREHENSIVE VALIDATION                ║', colors.cyan);
  log('╚══════════════════════════════════════════════════════════╝', colors.cyan);
  log(`\nBase URL: ${BASE_URL}`);
  log('Make sure your server is running: npm run dev\n');
  
  // Wait a moment for user to see
  await new Promise(r => setTimeout(r, 1000));
  
  // === ANALYTICS APIs ===
  log('\n📊 ANALYTICS APIs', colors.blue);
  log('─────────────────────────────────────────────────────────');
  
  await testEndpoint('Summary', '/api/v1/analytics/summary');
  await testEndpoint('Sales Performance (2026)', '/api/v1/analytics/sales-performance?startDate=2026-01-01&endDate=2026-12-31&granularity=yearly&status=all');
  await testEndpoint('Organization Stats', '/api/v1/analytics/organization-stats');
  await testEndpoint('Dashboard', '/api/v1/analytics/dashboard');
  await testEndpoint('Groups', '/api/v1/analytics/groups');
  
  // === CORE DATA APIs ===
  log('\n📦 CORE DATA APIs', colors.blue);
  log('─────────────────────────────────────────────────────────');
  
  await testEndpoint('Orders', '/api/v1/orders?page=1&limit=10');
  await testEndpoint('Branches', '/api/v1/branches');
  await testEndpoint('Organizations', '/api/v1/organizations');
  await testEndpoint('Users', '/api/v1/users');
  await testEndpoint('Products', '/api/v1/products?page=1&limit=10');
  await testEndpoint('Suppliers', '/api/v1/suppliers');
  await testEndpoint('Inventory', '/api/v1/inventory?page=1&limit=10');
  
  // === FINANCIAL APIs ===
  log('\n💰 FINANCIAL APIs', colors.blue);
  log('─────────────────────────────────────────────────────────');
  
  await testEndpoint('Refunds', '/api/v1/refunds?page=1&limit=10');
  await testEndpoint('Budgets', '/api/v1/budgets');
  await testEndpoint('Transactions', '/api/v1/transactions?page=1&limit=10');
  
  // === REPORTS & SETTINGS ===
  log('\n📑 REPORTS & SETTINGS', colors.blue);
  log('─────────────────────────────────────────────────────────');
  
  await testEndpoint('Reports', '/api/v1/reports');
  await testEndpoint('Settings', '/api/v1/settings');
  
  // === SUMMARY ===
  log('\n╔══════════════════════════════════════════════════════════╗', colors.cyan);
  log('║                      TEST SUMMARY                        ║', colors.cyan);
  log('╚══════════════════════════════════════════════════════════╝', colors.cyan);
  
  log(`\n✅ Passed: ${results.passed.length}`, colors.green);
  log(`⚠️  Warnings: ${results.warnings.length}`, colors.yellow);
  log(`❌ Failed: ${results.failed.length}`, colors.red);
  
  if (results.warnings.length > 0) {
    log('\n⚠️  WARNINGS (Auth/RLS Issues):', colors.yellow);
    results.warnings.forEach(r => log(`   - ${r.name}: ${r.status}`, colors.yellow));
  }
  
  if (results.failed.length > 0) {
    log('\n❌ FAILURES (Need Fix):', colors.red);
    results.failed.forEach(r => {
      log(`   - ${r.name}: ${r.status}`, colors.red);
      if (r.error) log(`     Error: ${r.error}`, colors.red);
    });
  }
  
  // Recommendations
  log('\n📋 RECOMMENDATIONS:', colors.blue);
  if (results.failed.length === 0 && results.warnings.length === 0) {
    log('   ✅ All APIs are working correctly!', colors.green);
  } else {
    if (results.failed.length > 0) {
      log('   1. Check the failed API routes for errors', colors.yellow);
      log('   2. Verify database connection and schema', colors.yellow);
      log('   3. Check server logs for detailed error messages', colors.yellow);
    }
    if (results.warnings.length > 0) {
      log(`   ${results.failed.length > 0 ? '2' : '1'}. Auth/RLS warnings may indicate:`, colors.yellow);
      log('      - Session not authenticated (login required)', colors.yellow);
      log('      - RLS policies blocking access', colors.yellow);
      log('      - Role permissions not set correctly', colors.yellow);
    }
  }
  
  log('\n' + '═'.repeat(60), colors.cyan);
}

runTests().catch(err => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
