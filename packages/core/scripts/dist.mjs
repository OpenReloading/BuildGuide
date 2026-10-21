// Assembles dist/buildguide-<version>/ (the folder a site copies) and a reproducible .tar.gz with SHA256SUMS.
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
const name = `buildguide-${version}`, out = `dist/${name}`;
rmSync('dist', { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync('src', out, { recursive: true });
cpSync('schema/buildguide.schema.json', `${out}/buildguide.schema.json`);
cpSync('LICENSE', `${out}/LICENSE`);
execFileSync('tar', ['-cf', `${name}.tar.gz`, '-I', 'gzip -n', '--sort=name', '--owner=0', '--group=0', '--numeric-owner', '--mode=go-w,u+rw,a+rX', '--mtime=@0', name], { cwd: 'dist' });
const sum = createHash('sha256').update(readFileSync(`dist/${name}.tar.gz`)).digest('hex');
writeFileSync('dist/SHA256SUMS', `${sum}  ${name}.tar.gz\n`);
console.log(`${sum}  ${name}.tar.gz`);
