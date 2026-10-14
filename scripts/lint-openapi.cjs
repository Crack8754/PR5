const { spawnSync } = require('node:child_process');
const { writeFileSync, mkdirSync } = require('node:fs');
const path = require('node:path');

const result = spawnSync(process.execPath, [
  path.join(__dirname, '../node_modules/@redocly/cli/bin/cli.js'),
  'lint', 'openapi.json', '--format=json',
], { cwd: path.join(__dirname, '..'), encoding: 'utf8', env: { ...process.env, REDOCLY_TELEMETRY: 'off' } });
if (result.error) throw result.error;
if (result.stderr) process.stderr.write(result.stderr);
let report;
try { report = JSON.parse(result.stdout); }
catch { process.stderr.write(result.stdout); throw new Error('Redocly did not return JSON'); }
mkdirSync(path.join(__dirname, '../reports'), { recursive: true });
writeFileSync(path.join(__dirname, '../reports/openapi-lint.json'), JSON.stringify(report, null, 2) + '\n');
const problems = report.problems ?? [];
const errors = report.totals?.errors ?? problems.filter((item) => item.severity === 'error').length;
const warnings = report.totals?.warnings ?? problems.filter((item) => item.severity === 'warn').length;
console.log(`OpenAPI lint: ${errors} errors, ${warnings} warnings.`);
if (result.status !== 0 || errors > 0 || warnings > 0) {
  console.error(JSON.stringify(problems, null, 2));
  process.exitCode = 1;
}
