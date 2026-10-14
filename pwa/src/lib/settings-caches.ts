// Limpeza de caches do aplicativo (Recuperação e Configurações). Nunca toca no
// IndexedDB/localStorage: anotações, destaques e preferências ficam intactos.

/** Caches da versão Flutter (mesma regra de scripts/sw-template.js). */
export const isLegacyCache = (name: string) =>
  name.startsWith('biblia-flutter-web-') ||
  name.startsWith('biblia-reformada-offline-') ||
  name === 'flutter-app-cache' ||
  name === 'flutter-temp-cache' ||
  name === 'flutter-app-manifest';

/** Shell do aplicativo (HTML/JS/CSS de cada versão). */
export const isAppShellCache = (name: string) => name.startsWith('km-app-');

const hasCaches = () => typeof caches !== 'undefined' && typeof caches.keys === 'function';

/** Apaga os caches cujo nome satisfaz o filtro; devolve os nomes apagados. */
export async function deleteCaches(filter: (name: string) => boolean): Promise<string[]> {
  if (!hasCaches()) return [];
  const deleted: string[] = [];
  for (const name of await caches.keys()) {
    if (!filter(name)) continue;
    try {
      if (await caches.delete(name)) deleted.push(name);
    } catch {
      /* continua com os demais */
    }
  }
  return deleted;
}

/** Remove os service workers deste escopo (o app e a versão clássica Flutter). */
export async function unregisterServiceWorkers(): Promise<number> {
  if (typeof navigator === 'undefined' || !navigator.serviceWorker?.getRegistrations) return 0;
  const scope = new URL('./', location.href).href;
  let count = 0;
  for (const registration of await navigator.serviceWorker.getRegistrations()) {
    if (!registration.scope.startsWith(scope)) continue;
    try {
      if (await registration.unregister()) count++;
    } catch {
      /* ignora */
    }
  }
  return count;
}

/**
 * "Limpar cache do aplicativo": apaga a shell de todas as versões e os caches do
 * Flutter, remove os service workers e deixa o próximo carregamento vir da rede.
 * O conteúdo baixado para uso offline (km-data-v1) é preservado.
 */
export async function clearAppCache(): Promise<{ caches: string[]; workers: number }> {
  const deleted = await deleteCaches((name) => isAppShellCache(name) || isLegacyCache(name));
  const workers = await unregisterServiceWorkers();
  return { caches: deleted, workers };
}
