import './styles.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { initApp, installBackHandler } from './lib/app';
import { loadUserModules } from './lib/content';
import { openDb, useFallbackFactory } from './lib/db';
import { bootFinished, bootStarted, startPwa } from './lib/pwa';
import { loadPrefs, loadProgress } from './lib/store';
import { App } from './App';
import { Recovery } from './screens/Recovery';

async function boot() {
  const previousFailed = bootStarted();
  let storageWarning: string | null = null;
  try {
    await openDb();
  } catch (error) {
    // Navegação privada antiga ou IndexedDB bloqueado: continua em memória.
    storageWarning = String((error as Error)?.message ?? error);
    const { indexedDB: memory } = await import('fake-indexeddb');
    useFallbackFactory(memory);
    await openDb();
  }
  await Promise.all([loadPrefs(), loadProgress(), loadUserModules()]);
  initApp();
  installBackHandler();
  const root = createRoot(document.getElementById('root')!);
  root.render(
    <StrictMode>
      {previousFailed ? <Recovery onContinue={() => root.render(<App storageWarning={storageWarning} />)} /> : <App storageWarning={storageWarning} />}
    </StrictMode>,
  );
  requestAnimationFrame(() => {
    document.getElementById('boot')?.remove();
    bootFinished();
  });
  startPwa();
}

boot().catch((error) => {
  const target = document.getElementById('boot');
  if (target) {
    target.innerHTML = '';
    const p = document.createElement('p');
    p.style.maxWidth = '32rem';
    p.style.padding = '0 20px';
    p.style.textAlign = 'center';
    p.textContent = `Não foi possível abrir a Bíblia Reformada: ${error?.message ?? error}. Recarregue a página. Seus dados não foram apagados.`;
    const button = document.createElement('button');
    button.textContent = 'Recarregar';
    button.style.cssText = 'padding:10px 18px;border-radius:999px;border:0;background:#795839;color:#fff;font-size:15px';
    button.onclick = () => location.reload();
    target.append(p, button);
  }
  console.error(error);
});
