// Fails on an em dash or an emoji in tracked text files. Vendored code and agent skills are left out.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const SKIP = /^(\.agents|\.claude)\/|\/vendor\/|\.(png|jpg|wasm|ico|woff2?)$|package-lock\.json$/;
const BAD = /\u2014|\p{Emoji_Presentation}|\uFE0F/u;
const files = execFileSync('git', ['ls-files'], { encoding: 'utf8' }).split('\n').filter((f) => f && !SKIP.test(f));
let failed = false;
for (const file of files) {
  readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
    if (BAD.test(line)) { console.error(`${file}:${i + 1}: em dash or emoji`); failed = true; }
  });
}
process.exit(failed ? 1 : 0);
