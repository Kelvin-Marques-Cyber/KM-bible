// Servidor estático que imita o GitHub Pages (/KM-bible/, Cache-Control max-age=600)
// e permite trocar a pasta publicada durante o teste (simula uma nova publicação).
import { createServer, type Server } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm',
  '.glb': 'model/gltf-binary',
  '.txt': 'text/plain; charset=utf-8',
};

export const PREFIX = '/KM-bible/';

export interface SwitchServer {
  url: string;
  setRoot(dir: string): void;
  requests: string[];
  close(): Promise<void>;
}

export async function startSwitchServer(port: number, root: string): Promise<SwitchServer> {
  let current = root;
  const requests: string[] = [];
  const server: Server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    requests.push(url.pathname + url.search);
    if (!url.pathname.startsWith(PREFIX)) {
      res.writeHead(302, { Location: PREFIX });
      res.end();
      return;
    }
    let rel = decodeURIComponent(url.pathname.slice(PREFIX.length));
    if (rel === '' || rel.endsWith('/')) rel += 'index.html';
    const file = normalize(join(current, rel));
    if (!file.startsWith(normalize(current))) {
      res.writeHead(403);
      res.end();
      return;
    }
    try {
      const info = await stat(file);
      if (!info.isFile()) throw new Error('not a file');
      const body = await readFile(file);
      res.writeHead(200, {
        'Content-Type': TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream',
        'Content-Length': body.length,
        'Cache-Control': 'max-age=600',
      });
      res.end(req.method === 'HEAD' ? undefined : body);
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<h1>404</h1>');
    }
  });
  await new Promise<void>((resolve) => server.listen(port, '127.0.0.1', resolve));
  return {
    url: `http://127.0.0.1:${port}${PREFIX}`,
    setRoot(dir: string) {
      current = dir;
    },
    requests,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
