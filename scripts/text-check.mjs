// Fails on an em dash or an emoji in tracked text files. Vendored code and agent skills are left out.
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';

const SKIP = /^(\.agents|\.claude)\/|\/vendor\/|\.(png|jpg|wasm|ico|woff2?)$|package-lock\.json$/;
const BAD = /\u2014|\p{Emoji_Presentation}|\uFE0F/u;
// Paths git ignores (.gitignore), left out when there is no git to ask (a worktree opened in the dev container).
const IGNORED = /(^|\/)(\.git|node_modules|dist|test-results|playwright-report|\.playwright-mcp|\.venv|__pycache__|\.docusaurus)\/|(^|\/)(\.coverage|coverage\.xml|lcov\.info)$|^site\/|^packages\/mkdocs\/src\/mkdocs_buildguide\/core\/|^packages\/docusaurus\/(example\/build|core)\//;

function listFiles() {
  try {
    return execFileSync('/usr/bin/git', ['ls-files'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).split('\n');
  } catch {
    return readdirSync('.', { recursive: true, withFileTypes: true })
      .filter((e) => e.isFile())
      .map((e) => `${e.parentPath}/${e.name}`.replace(/^\.\//, ''))
      .filter((f) => !IGNORED.test(f));
  }
}

const files = listFiles().filter((f) => f && !SKIP.test(f));
let failed = false;
for (const file of files) {
  readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
    if (BAD.test(line)) { console.error(`${file}:${i + 1}: em dash or emoji`); failed = true; }
  });
}
process.exit(failed ? 1 : 0);
