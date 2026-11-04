// The files tsc does not emit: core's built lib/ (scripts, stylesheet, third-party files, declarations) and the schema into core/
// (git-ignored), the folder the plugin serves and packs (#7), and the plugin's stylesheet into lib/. Core is built first (npm run compile).
import { cpSync, rmSync } from 'node:fs';

rmSync('core', { recursive: true, force: true });
cpSync('../core/lib', 'core', { recursive: true });
cpSync('../core/schema/buildguide.schema.json', 'core/buildguide.schema.json');
cpSync('src/buildguide-docusaurus.css', 'lib/buildguide-docusaurus.css');
