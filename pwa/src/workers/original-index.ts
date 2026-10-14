// Web Worker da pesquisa linguística: baixa e normaliza surfaces.json (~137 mil
// formas) e list.json (lemas) fora da thread principal, respondendo consultas.
import { createIndexService, IndexLoadError, type WorkerMessage, type WorkerRequest } from '../lib/original-logic';

const scope = self as unknown as DedicatedWorkerGlobalScope;
const post = (message: WorkerMessage) => scope.postMessage(message);

async function load(url: string): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url);
  } catch {
    throw new IndexLoadError('offline', 'offline', url);
  }
  if (response.status === 404) throw new IndexLoadError('missing', 'missing', url);
  if (response.status === 503 || response.status === 504) throw new IndexLoadError('offline', 'offline', url);
  if (!response.ok) throw new IndexLoadError(`HTTP ${response.status}`, 'http', url);
  return response.json();
}

const service = createIndexService(load);

scope.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const { id, ...request } = event.data;
  try {
    const result = await service.query(request, (progress) => post({ id, type: 'progress', ...progress }));
    post({ id, type: 'result', ...result });
  } catch (error) {
    post({
      id,
      type: 'error',
      message: error instanceof Error ? error.message : String(error),
      kind: error instanceof IndexLoadError ? error.kind : undefined,
      url: error instanceof IndexLoadError ? error.url : undefined,
    });
  }
};
