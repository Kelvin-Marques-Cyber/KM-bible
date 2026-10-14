import { useEffect, useMemo, useRef, useState } from 'react';
import { catalog, dataBase, packUrl, type ModuleInfo } from '../lib/catalog';
import { licenseText, module, moduleDocuments, modules } from '../lib/content';
import { useAsync, Async, message } from '../components/ui';
import { openDocument, openModule, openOffline } from './open';
import { formatBytes, requestPersistence, storageInfo } from '../lib/pwa';
import { useApp } from '../lib/app';

const CACHE = 'km-bible-offline-acervo-v1';
type Files = Record<string, { hash: string; files: string[] }>;
const groupName = (path: string) => path.replace(/^search\//, 'Índice de pesquisa: ').replace('bibles/', 'Bíblia: ').replace('commentaries/', 'Comentário: ');

export default function LibraryPage() {
  useApp();
  const list = modules();
  const [filter, setFilter] = useState('');
  const visible = useMemo(() => list.filter((m) => [m.id, m.title, m.author, m.kind].join(' ').toLocaleLowerCase('pt-BR').includes(filter.toLocaleLowerCase('pt-BR'))), [list, filter]);
  return <div className="mx-auto max-w-3xl space-y-4 p-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-xl font-semibold">Biblioteca</h2>
      <button type="button" onClick={openOffline} className="rounded-lg bg-primary px-4 py-2 text-on-primary">Conteúdo offline</button>
    </div>
    <label className="block">Filtrar os módulos
      <input type="search" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Bíblia, comentários, autor…"
        className="mt-2 block w-full rounded-lg border border-outline bg-surface px-3 py-2" />
    </label>
    <p className="text-sm text-muted">{visible.length} módulos encontrados. O conteúdo público é carregado conforme você abre cada item.</p>
    <ul className="space-y-2">{visible.map((m) => <li key={m.id}>
      <button type="button" className="w-full rounded-xl border border-outline p-3 text-left hover:bg-surface-high" onClick={() => openModule(m)}>
        <span className="block font-semibold">{m.title}</span>
        <span className="block text-sm text-muted">{m.author || m.id} · {m.kind} · {m.installed ? 'Ativo' : 'Não instalado'}</span>
      </button>
    </li>)}</ul>
  </div>;
}

export function ModulePage({ moduleId }: { moduleId: string }) {
  const m = module(moduleId);
  const result = useAsync(() => moduleDocuments(moduleId), [moduleId]);
  const legal = useAsync(() => licenseText(moduleId), [moduleId]);
  if (!m) return <p className="p-5">Módulo não encontrado.</p>;
  return <section className="mx-auto max-w-3xl space-y-4 p-5">
    <h2 className="text-xl font-semibold">{m.title}</h2>
    <p className="text-sm text-muted">{m.author || m.id} · {m.language} · {m.kind}</p>
    <p>{m.installed ? 'Módulo disponível nesta instalação.' : 'Este módulo está desativado ou não instalado.'}</p>
    <Async state={result}>{(docs) => <div className="space-y-2">
      {docs.map((d) => <button key={d.id} type="button" className="block w-full rounded-lg border border-outline p-3 text-left"
        onClick={() => openDocument(d)}>{d.pt?.title || d.title}</button>)}
      {!docs.length && <p className="text-sm text-muted">Este módulo utiliza outro leitor ou ainda não tem documentos avulsos.</p>}
    </div>}</Async>
    <Async state={legal}>{(text) => text ? <details className="rounded-lg border border-outline p-3"><summary>Licença e atribuição</summary>
      <pre className="mt-2 whitespace-pre-wrap break-words text-xs">{text}</pre></details> : null}</Async>
  </section>;
}

export function OfflinePage() {
  const index = useAsync(async () => {
    const response = await fetch(new URL('files.json', dataBase()).href, { cache: 'no-store' });
    if (!response.ok) throw new Error('Não foi possível consultar o catálogo offline.');
    return (await response.json()) as Files;
  }, []);
  const [selected, setSelected] = useState<string[]>([]);
  const [progress, setProgress] = useState('');
  const [busy, setBusy] = useState(false);
  const [space, setSpace] = useState('');
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);
  const toggle = (name: string, checked: boolean) => setSelected((prior) => checked ? [...prior.filter((p) => p !== name), name] : prior.filter((p) => p !== name));
  const download = async (data: Files) => {
    if (!('caches' in window)) { message('Este navegador não permite armazenamento offline.'); return; }
    await requestPersistence();
    const controller = new AbortController();
    abort.current = controller;
    setBusy(true);
    let count = 0;
    const targets = selected.flatMap((name) => (data[name]?.files ?? []).map((file) => {
      const pack = data[name];
      return `${dataBase()}${name}/${file}?v=${pack.hash}`;
    }));
    try {
      const cache = await caches.open(CACHE);
      for (const url of targets) {
        if (controller.signal.aborted) break;
        if (!(await cache.match(url))) {
          const response = await fetch(url, { signal: controller.signal });
          if (!response.ok) throw new Error(`Falha HTTP ${response.status} em ${url}`);
          await cache.put(url, response);
        }
        count++;
        setProgress(`${count}/${targets.length} arquivos preparados`);
      }
      if (!controller.signal.aborted) message('Download concluído. Teste o acesso sem conexão.');
    } catch (error) {
      if (!controller.signal.aborted) message(`Download interrompido: ${String(error)}`);
    } finally { setBusy(false); abort.current = null; }
  };
  return <section className="mx-auto max-w-3xl space-y-4 p-5">
    <h2 className="text-xl font-semibold">Acervo offline</h2>
    <p className="text-sm text-muted">Marque os pacotes desejados. O acervo integral pode ocupar centenas de megabytes; a disponibilidade depende do espaço permitido pelo navegador, especialmente no iPhone.</p>
    <Async state={index}>{(data) => <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button type="button" className="rounded-lg border border-outline px-3 py-2" onClick={() => setSelected(Object.keys(data))}>Selecionar tudo</button>
        <button type="button" className="rounded-lg border border-outline px-3 py-2" onClick={() => setSelected([])}>Desmarcar</button>
        <button type="button" className="rounded-lg border border-outline px-3 py-2"
          onClick={() => void storageInfo().then((s) => setSpace(`Em uso: ${formatBytes(s.usage)}; capacidade estimada: ${formatBytes(s.quota)}`))}>Espaço disponível</button>
      </div>
      {space && <p className="text-sm">{space}</p>}
      <div className="max-h-80 space-y-2 overflow-y-auto rounded-lg border border-outline p-3">
        {Object.entries(data).map(([name, pack]) => <label key={name} className="flex items-start gap-3 border-b border-outline/30 py-1.5">
          <input type="checkbox" checked={selected.includes(name)} disabled={busy} onChange={(e) => toggle(name, e.target.checked)} />
          <span><strong>{groupName(name)}</strong><span className="block text-xs text-muted">{pack.files.length} arquivos</span></span>
        </label>)}
      </div>
      <p className="text-sm">{selected.length} pacotes selecionados, {selected.reduce((sum, name) => sum + (data[name]?.files.length ?? 0), 0)} arquivos.</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy || !selected.length} onClick={() => void download(data)}
          className="rounded-lg bg-primary px-4 py-2 text-on-primary disabled:opacity-50">Baixar selecionados para usar sem internet</button>
        {busy && <button type="button" className="rounded-lg border border-outline px-4 py-2" onClick={() => abort.current?.abort()}>Cancelar</button>}
      </div>
      {progress && <p role="status">{progress}</p>}
      <p className="text-xs text-muted">A limpeza de dados do site no navegador também pode apagar downloads, anotações e favoritos. Faça backup antes de limpar.</p>
    </div>}</Async>
  </section>;
}
