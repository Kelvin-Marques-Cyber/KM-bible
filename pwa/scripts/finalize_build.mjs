#!/usr/bin/env node
// Depois do `vite build`: gera sw.js (precache + versões dos dados), app-version.json
// (manifesto leve de versão consultado pelo aplicativo) e a cópia flutter_service_worker.js
// que substitui o service worker da versão Flutter antiga em aparelhos já instalados.
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = join(root, 'dist');
const info = JSON.parse(readFileSync(join(dist, 'build-info.json'), 'utf8'));
rmSync(join(dist, 'build-info.json'));
const catalog = JSON.parse(readFileSync(join(dist, 'data/v1/catalog.json'), 'utf8'));
const files = JSON.parse(readFileSync(join(dist, 'data/v1/files.json'), 'utf8'));

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

// App shell: tudo que não é dado, exceto o WebAssembly da migração (só usado uma vez).
const shell = walk(dist)
  .map((path) => relative(dist, path).split('\\').join('/'))
  .filter((path) => !path.startsWith('data/') && !path.startsWith('fonts/') && !path.endsWith('.wasm'))
  .filter((path) => !['sw.js', 'flutter_service_worker.js', 'app-version.json', 'files.json'].includes(path))
  .filter((path) => !path.endsWith('.map'));
const defaultFont = existsSync(join(dist, 'fonts/EBGaramond.woff2')) ? ['fonts/EBGaramond.woff2'] : [];
const precache = ['index.html', ...shell.filter((p) => p !== 'index.html'), ...defaultFont];

const packs = Object.fromEntries(Object.entries(files).map(([path, value]) => [path, value.hash]));
packs[''] = catalog.filesIndex.hash; // catalog.json/files.json na raiz de data/v1

const force = (process.env.KM_FORCE_UPDATE ?? '1') !== '0';
const template = readFileSync(join(root, 'scripts/sw-template.js'), 'utf8');
const sw = template
  .replace('__BUILD_ID__', info.build)
  .replace('__FORCE__', JSON.stringify(force))
  .replace('__PRECACHE__', JSON.stringify(precache))
  .replace('__PACKS__', JSON.stringify(packs));
writeFileSync(join(dist, 'sw.js'), sw);
writeFileSync(join(dist, 'flutter_service_worker.js'), sw);

const notesFile = join(root, 'RELEASE_NOTES.md');
let notes = [];
if (existsSync(notesFile)) {
  const text = readFileSync(notesFile, 'utf8');
  const section = text.split(/^## /m)[1] ?? '';
  notes = section
    .split('\n')
    .slice(1)
    .filter((line) => line.trim().startsWith('-'))
    .map((line) => line.replace(/^\s*-\s*/, '').trim())
    .slice(0, 6);
}
const version = { version: info.version, build: info.build, date: info.date, commit: info.commit, force, notes };
writeFileSync(join(dist, 'app-version.json'), JSON.stringify(version, null, 1));

const shellBytes = precache.reduce((sum, p) => sum + statSync(join(dist, p)).size, 0);
const digest = createHash('sha256').update(sw).digest('hex').slice(0, 12);
console.log(`Build ${info.build} · precache ${precache.length} arquivos (${(shellBytes / 1024).toFixed(0)} KB) · sw ${digest} · force=${force}`);
