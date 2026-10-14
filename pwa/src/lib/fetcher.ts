// Busca de dados estáticos com cache em memória, deduplicação de pedidos e
// mensagens claras quando o conteúdo não está disponível sem conexão.

export class OfflineError extends Error {
  constructor(public url: string) {
    super('Conteúdo indisponível sem conexão. Conecte-se uma vez ou baixe o pacote em Biblioteca → Offline.');
    this.name = 'OfflineError';
  }
}
export class NotFoundError extends Error {
  constructor(public url: string) {
    super('Arquivo não encontrado no acervo publicado.');
    this.name = 'NotFoundError';
  }
}

const LIMIT = 90;
const memory = new Map<string, Promise<unknown>>();

function remember(url: string, value: Promise<unknown>) {
  memory.delete(url);
  memory.set(url, value);
  while (memory.size > LIMIT) memory.delete(memory.keys().next().value as string);
}

export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const cached = memory.get(url);
  if (cached) {
    remember(url, cached);
    return cached as Promise<T>;
  }
  const promise = (async () => {
    let response: Response;
    try {
      response = await fetch(url, init);
    } catch {
      throw new OfflineError(url);
    }
    if (response.status === 404) throw new NotFoundError(url);
    if (!response.ok) {
      if (response.status === 503 || response.status === 504) throw new OfflineError(url);
      throw new Error(`HTTP ${response.status} ao carregar ${url}`);
    }
    return (await response.json()) as T;
  })();
  remember(url, promise);
  promise.catch(() => memory.delete(url));
  return promise;
}

/** Como fetchJson, mas devolve null quando o arquivo não existe. */
export async function fetchOptional<T>(url: string): Promise<T | null> {
  try {
    return await fetchJson<T>(url);
  } catch (error) {
    if (error instanceof NotFoundError) return null;
    throw error;
  }
}

export function clearMemoryCache(): void {
  memory.clear();
}
