/**
 * Supply Chain Security - Dependency Vulnerability Scanner
 * 
 * This script runs as part of CI/CD to detect vulnerable dependencies.
 * Fails the build if HIGH or CRITICAL vulnerabilities are found.
 * 
 * Usage:
 *   npm run security:deps
 *   tsx scripts/security/dependency-scan.ts
 * 
 * Exit Codes:
 *   0 = No issues or only LOW/MODERATE
 *   1 = HIGH or CRITICAL vulnerabilities found
 */

import { execSync } from 'child_process';
import { writeFileSync } from 'fs';
import { resolve } from 'path';

interface AuditResult {
    vulnerabilities: {
        info: number;
        low: number;
        moderate: number;
        high: number;
        critical: number;
        total: number;
    };
    metadata: {
        dependencies: number;
        devDependencies: number;
        vulnerabilities: {
            [key: string]: {
                name: string;
                severity: string;
                via: string[];
                range: string;
            };
        };
    };
}

function runNpmAudit(): AuditResult | null {
    try {
        const output = execSync('npm audit --json --production', {
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe'],
        });

        return JSON.parse(output) as AuditResult;
    } catch (error: any) {
        // npm audit exits with 1 if vulnerabilities found
        if (error.stdout) {
            return JSON.parse(error.stdout) as AuditResult;
        }
        throw error;
    }
}

function formatVulnerabilities(result: AuditResult): string {
    const { vulnerabilities } = result;

    let report = '\n=== Dependency Vulnerability Report ===\n\n';

    report += `Total Vulnerabilities: ${vulnerabilities.total}\n`;
    report += `  - Critical: ${vulnerabilities.critical}\n`;
    report += `  - High:     ${vulnerabilities.high}\n`;
    report += `  - Moderate: ${vulnerabilities.moderate}\n`;
    report += `  - Low:      ${vulnerabilities.low}\n`;
    report += `  - Info:     ${vulnerabilities.info}\n\n`;

    if (vulnerabilities.critical > 0 || vulnerabilities.high > 0) {
        report += '⚠️  HIGH/CRITICAL VULNERABILITIES DETECTED\n\n';

        // Extract details
        const vulnDetails = result.metadata?.vulnerabilities || {};
        for (const [name, details] of Object.entries(vulnDetails)) {
            if (details.severity === 'high' || details.severity === 'critical') {
                report += `📦 ${details.name}\n`;
                report += `   Severity: ${details.severity.toUpperCase()}\n`;
                report += `   Range: ${details.range}\n`;
                report += `   Via: ${details.via.join(', ')}\n\n`;
            }
        }
    }

    return report;
}

function saveReport(report: string, result: AuditResult): void {
    const outputDir = resolve(process.cwd(), 'security-reports');
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const filename = `dependency-audit-${timestamp}.txt`;
    const filepath = resolve(outputDir, filename);

    try {
        const { mkdirSync } = require('fs');
        mkdirSync(outputDir, { recursive: true });
        writeFileSync(filepath, report);
        console.log(`\n📄 Full report saved: ${filepath}`);
    } catch (error) {
        console.error('Failed to save report:', error);
    }

    // Also save JSON for programmatic access
    const jsonPath = resolve(outputDir, `dependency-audit-${timestamp}.json`);
    writeFileSync(jsonPath, JSON.stringify(result, null, 2));
}

function checkSnykIfAvailable(): void {
    try {
        console.log('\n🔍 Checking for Snyk CLI...');
        execSync('snyk --version', { stdio: 'ignore' });

        console.log('Running Snyk test...');
        execSync('snyk test --json > security-reports/snyk-results.json', {
            stdio: 'inherit',
        });
        console.log('✅ Snyk scan complete');
    } catch (error) {
        console.log('ℹ️  Snyk CLI not available (optional)');
    }
}

function main(): void {
    console.log('🔒 Starting Dependency Security Scan...\n');

    // Run npm audit
    console.log('Running npm audit --production...');
    const result = runNpmAudit();

    if (!result) {
        console.error('❌ Failed to run npm audit');
        process.exit(1);
    }

    const report = formatVulnerabilities(result);
    console.log(report);

    saveReport(report, result);

    // Optional: Run Snyk if available
    checkSnykIfAvailable();

    // Determine exit code
    const { critical, high } = result.vulnerabilities;

    if (critical > 0 || high > 0) {
        console.error('\n❌ BUILD FAILED: HIGH or CRITICAL vulnerabilities detected');
        console.error('   Run "npm audit fix" to resolve\n');
        process.exit(1);
    }

    if (result.vulnerabilities.moderate > 0) {
        console.warn('\n⚠️  MODERATE vulnerabilities detected');
        console.warn('   Consider running "npm audit fix"\n');
    }

    console.log('\n✅ No HIGH or CRITICAL vulnerabilities found\n');
    process.exit(0);
}

// Execute
main();
