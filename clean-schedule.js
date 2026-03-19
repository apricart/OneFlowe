const fs = require('fs');
const path = require('path');
const dir = path.join(process.cwd(), 'app/(portal)/reports');
const files = [
  'purchase-report/page.tsx',
  'sales-summary/page.tsx',
  'order-report/page.tsx',
  'product-performance/page.tsx',
  'groups/page.tsx',
  'budget-summary/page.tsx',
  'branch-reports/page.tsx'
];
files.forEach(f => {
  const file = path.join(dir, f);
  if (!fs.existsSync(file)) return;
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/import \{ ScheduleReportModal \} from \"@\/components\/reports\/schedule-report-modal\"/g, '');
  content = content.replace(/<ScheduleReportModal [^>]+>/g, '');
  fs.writeFileSync(file, content);
  console.log('Processed', f);
});
