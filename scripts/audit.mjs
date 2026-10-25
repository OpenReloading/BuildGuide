// npm audit that fails on high and critical advisories, except the advisories in ALLOWED.
// An entry also goes into allow-ghsas of the dependency-review job (.github/workflows/ci.yml).
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';

const ALLOWED = [];
// npm runs from the folder of this node binary, not from PATH (shortcut: the Unix layout of a Node install, add Windows when CI needs it)
const npm = join(dirname(process.execPath), '..', 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js');
const { stdout } = spawnSync(process.execPath, [npm, 'audit', '--json'], { encoding: 'utf8' });
const report = JSON.parse(stdout);
// a failed audit (network, registry) has no vulnerabilities key: fail instead of passing unchecked
if (!report.vulnerabilities) { console.error(stdout); process.exit(1); }
const advisories = Object.values(report.vulnerabilities).flatMap((v) => v.via.filter((via) => typeof via === 'object'));
const blocking = advisories.filter((a) => ['high', 'critical'].includes(a.severity) && !ALLOWED.some((id) => a.url.endsWith(`/${id}`)));
for (const a of new Map(blocking.map((a) => [a.url, a])).values()) console.error(`${a.severity} ${a.name} ${a.range}: ${a.title} ${a.url}`);
process.exit(blocking.length ? 1 : 0);
