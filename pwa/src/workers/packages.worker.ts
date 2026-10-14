// Web Worker da importação de módulos (.biblepkg): descompacta com fflate,
// confere SHA-256, valida (ContentPackage.parse) e prepara os registros; depois
// da aceitação da licença grava tudo no IndexedDB numa única transação. Assim a
// interface continua responsiva e os dados não atravessam para a thread principal.
import { buildInstallPlan, parsePackage, writeInstallPlan, type InstallPlan, type PackageError } from '../lib/library-packages-core';
import type { PackageWorkerMessage, PackageWorkerRequest } from '../lib/packages';

const scope = self as unknown as DedicatedWorkerGlobalScope;
const post = (message: PackageWorkerMessage) => scope.postMessage(message);

let plan: InstallPlan | null = null;

scope.onmessage = async (event: MessageEvent<PackageWorkerRequest>) => {
  const request = event.data;
  try {
    if (request.type === 'parse') {
      plan = null;
      const pkg = await parsePackage(request.bytes, (stage) => post({ type: 'stage', stage }));
      post({ type: 'stage', stage: 'prepare' });
      plan = await buildInstallPlan(pkg);
      post({ type: 'parsed', manifest: plan.record.manifest, records: pkg.records.length, bytes: pkg.bytes, expanded: pkg.expanded });
    } else if (request.type === 'install') {
      if (!plan) throw new Error('Nenhum pacote preparado para instalar.');
      post({ type: 'stage', stage: 'write' });
      const current = plan;
      plan = null;
      await writeInstallPlan(current);
      post({ type: 'installed' });
    } else if (request.type === 'discard') {
      plan = null;
    }
  } catch (error) {
    const e = error as Partial<PackageError> & { message?: string };
    post({
      type: 'error',
      code: typeof e?.code === 'string' ? e.code : undefined,
      detail: typeof e?.detail === 'string' ? e.detail : undefined,
      message: error instanceof Error ? error.message : String(error),
    });
  }
};
