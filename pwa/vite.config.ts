import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
let commit = 'dev';
try {
  commit = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
} catch {
  /* fora de um repositório git */
}
const date = new Date().toISOString();
// Identificador único de cada publicação: versão + commit + horário.
const build = process.env.KM_BUILD_ID ?? `${pkg.version}-${commit}-${date.replace(/[-:TZ.]/g, '').slice(0, 14)}`;

// base relativo: o mesmo build funciona em /KM-bible/ (GitHub Pages) e em
// qualquer subpasta. assetsDir "app" evita colisão com assets/ do Flutter clássico.
export default defineConfig({
  base: './',
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_ID__: JSON.stringify(build),
    __BUILD_DATE__: JSON.stringify(date),
  },
  build: {
    target: ['es2020', 'chrome87', 'safari14', 'firefox90'],
    assetsDir: 'app',
    sourcemap: false,
    cssCodeSplit: true,
    chunkSizeWarningLimit: 400,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
          markdown: ['marked', 'dompurify'],
        },
      },
    },
  },
  worker: { format: 'es' },
  server: { port: 5173 },
  test: {
    environment: 'jsdom',
    include: ['tests/unit/**/*.test.ts'],
    setupFiles: ['tests/unit/setup.ts'],
  },
} as never);
