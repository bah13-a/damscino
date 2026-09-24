// Serves the web export of the mobile app (mobile/dist) for the Playwright tests, with the SPA fallback that
// expo-router needs. Test-only: the app is distributed as an Android / iOS application, never as a website.
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';

const root = process.env.MOBILE_DIST ?? new URL('../mobile/dist', import.meta.url).pathname;
const port = Number(process.env.MOBILE_PORT ?? 8095);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.ico': 'image/x-icon', '.ttf': 'font/ttf', '.json': 'application/json', '.svg': 'image/svg+xml', '.wasm': 'application/wasm' };

createServer((req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
  let file = join(root, path);
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(root, 'index.html');
  res.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(res);
}).listen(port, () => console.log(`mobile app (web export) on http://localhost:${port}`));
