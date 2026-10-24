// Static server for the example and the browser tests: serves this package, or the given folder, nothing else.
// Use: node tests/serve.mjs [port] [folder]
import { createServer } from 'node:http';
import { readFile, realpath, stat } from 'node:fs/promises';
import { extname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = await realpath(resolve(process.cwd(), process.argv[3] || fileURLToPath(new URL('..', import.meta.url))));
if (!(await stat(ROOT)).isDirectory()) throw new Error(`not a directory: ${ROOT}`);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.wasm': 'application/wasm', '.png': 'image/png', '.jpg': 'image/jpeg' };

createServer(async (req, res) => {
  let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (path.endsWith('/')) path += 'index.html';
  // resolve against the root, follow links, then refuse anything that lands outside it
  let file;
  try {
    file = await realpath(resolve(ROOT, `.${path}`));
  } catch {
    res.writeHead(404).end('not found');
    return;
  }
  const rel = relative(ROOT, file);
  if (rel.startsWith('..') || isAbsolute(rel)) { res.writeHead(400).end(); return; }
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' }).end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
}).listen(Number(process.argv[2] || 8080), '127.0.0.1');
