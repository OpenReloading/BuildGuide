// npm audit that fails on high and critical advisories, except the advisories in ALLOWED.
// The same list is in allow-ghsas of the dependency-review job (.github/workflows/ci.yml).
import { spawnSync } from 'node:child_process';

const ALLOWED = [
  // braces <=3.0.3, no patched release (Docusaurus build and dev server globs). Remove once braces ships a fix.
  'GHSA-vfj7-8cjw-p6xm',
];
const { stdout } = spawnSync('npm', ['audit', '--json'], { encoding: 'utf8' });
const report = JSON.parse(stdout);
// a failed audit (network, registry) has no vulnerabilities key: fail instead of passing unchecked
if (!report.vulnerabilities) { console.error(stdout); process.exit(1); }
const advisories = Object.values(report.vulnerabilities).flatMap((v) => v.via.filter((via) => typeof via === 'object'));
const blocking = advisories.filter((a) => ['high', 'critical'].includes(a.severity) && !ALLOWED.some((id) => a.url.endsWith(`/${id}`)));
for (const a of new Map(blocking.map((a) => [a.url, a])).values()) console.error(`${a.severity} ${a.name} ${a.range}: ${a.title} ${a.url}`);
process.exit(blocking.length ? 1 : 0);
