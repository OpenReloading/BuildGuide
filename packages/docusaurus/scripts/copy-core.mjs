// Before tsc -b (npm run compile, after core's build): the old core/, lib/ and build info go, so nothing stale ships. Then the files
// tsc does not emit: core's lib/ (scripts, stylesheet, third-party files, declarations) and the schema into core/ (git-ignored),
// the folder the plugin serves and packs (#7), and the plugin's stylesheet into lib/.
import { cpSync, rmSync } from 'node:fs';

for (const dir of ['core', 'lib', '.tsbuild']) rmSync(dir, { recursive: true, force: true });
cpSync('../core/lib', 'core', { recursive: true });
cpSync('../core/schema/buildguide.schema.json', 'core/buildguide.schema.json');
cpSync('src/buildguide-docusaurus.css', 'lib/buildguide-docusaurus.css');
