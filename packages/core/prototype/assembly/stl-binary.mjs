// Writes an ASCII STL as a binary STL: node stl-binary.mjs in.stl out.stl
import { readFileSync, writeFileSync } from 'node:fs';

const [from, to] = process.argv.slice(2);
const text = readFileSync(from, 'utf8');
const facets = [...text.matchAll(/facet normal (\S+) (\S+) (\S+)\s+outer loop\s+vertex (\S+) (\S+) (\S+)\s+vertex (\S+) (\S+) (\S+)\s+vertex (\S+) (\S+) (\S+)/g)];
const out = Buffer.alloc(84 + 50 * facets.length);
out.writeUInt32LE(facets.length, 80);
for (const [i, f] of facets.entries()) for (const [k, v] of f.slice(1).entries()) out.writeFloatLE(Number(v), 84 + 50 * i + 4 * k);
writeFileSync(to, out);
console.log(`${to}: ${facets.length} triangles, ${out.length} bytes`);
