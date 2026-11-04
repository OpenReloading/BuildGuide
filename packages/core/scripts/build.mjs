// Builds lib/, the folder that ships, from scratch: the old lib/ and the build info go first, so no output of a renamed or
// deleted source ships. tsc -b emits the scripts and the check CLI with their declarations; the stylesheet and the unmodified
// third-party files go next to them, since buildguide.js loads its siblings from its own URL.
import { execFileSync } from 'node:child_process';
import { cpSync, readdirSync, rmSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

for (const dir of ['lib', '.tsbuild']) rmSync(dir, { recursive: true, force: true });
const tsc = join(dirname(createRequire(import.meta.url).resolve('typescript/package.json')), 'bin', 'tsc');
execFileSync(process.execPath, [tsc, '-b'], { stdio: 'inherit' });
cpSync('src/buildguide.css', 'lib/buildguide.css');
cpSync('src/vendor', 'lib/vendor', { recursive: true });
// the on-demand scripts add nothing to the global declarations: tsc writes them an empty declaration file
for (const file of readdirSync('lib')) if (file.endsWith('.d.ts') && statSync(`lib/${file}`).size === 0) rmSync(`lib/${file}`);
