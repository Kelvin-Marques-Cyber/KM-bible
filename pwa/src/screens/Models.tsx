// ModelsPage e ModelPage (lib/explore.dart + lib/model3d_browser_web.dart):
// catálogo de reconstruções 3D (contextual por trecho ou completo) e o
// visualizador em iframe controlado por postMessage no canal "biblia3d".
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  ArrowUpToLine,
  BookOpen,
  Box,
  ChevronRight,
  Download,
  LoaderCircle,
  RectangleVertical,
  RotateCcw,
  RotateCw,
  Search,
  TriangleAlert,
  Undo2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../lib/app';
import { catalog, packUrl } from '../lib/catalog';
import { loadModels, modelBlockAt, modelScenes, userModelBuffer, viewerUrl, type Model3D, type SceneBlock } from '../lib/content';
import { bookNames, fromId, refLabel, type Ref } from '../lib/domain';
import { lang, t, tr } from '../lib/i18n';
import {
  PREVIEW_IDS,
  STATUS_BRIDGE,
  associationFor,
  cleanPartName,
  filterModels,
  formatModelSize,
  isViewerError,
  modelCategories,
  modelCategory,
  needsConfirmation,
  parseViewerMessage,
  saveDataEnabled,
  uniqueParts,
  validModelFile,
  viewerCommand,
} from '../lib/models-logic';
import { pref } from '../lib/store';
import { Action, Button, Card, Chip, ErrorBox, Progress, Select, Small, Spinner, Wrap, cx, useAsync, useDebounced, type Icon as IconType } from '../components/ui';
import { openModel, showPassage } from './open';

// ======================================================================
// Catálogo
// ======================================================================

interface Loaded {
  models: Model3D[];
  scenes: SceneBlock[];
}

async function loadCatalog(): Promise<Loaded> {
  const [models, scenes] = await Promise.all([loadModels(), modelScenes()]);
  return { models, scenes };
}

export function ModelsPage({ reference }: { reference?: Ref }) {
  useApp();
  const state = useAsync(loadCatalog, []);
  if (state.error) return <ErrorBox error={state.error} onRetry={state.reload} />;
  if (!state.data) return <Spinner />;
  return <ModelsBrowser data={state.data} reference={reference} />;
}

function ModelsBrowser({ data, reference }: { data: Loaded; reference?: Ref }) {
  const language = lang();
  const { models, scenes } = data;
  const block = useMemo(() => (reference ? modelBlockAt(scenes, reference) : null), [scenes, reference]);
  const [all, setAll] = useState(false);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const query = useDebounced(search, 250);
  const contextual = block !== null && !all;
  const categories = useMemo(() => modelCategories(models), [models]);
  const visible = useMemo(
    () => filterModels(models, { block, contextual, category, query }),
    [models, block, contextual, category, query],
  );

  const parent = useRef<HTMLDivElement>(null);
  const header = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const [margin, setMargin] = useState(0);
  // O cabeçalho rola junto com a lista (melhor em telas pequenas): a lista
  // virtual começa depois dele (scrollMargin).
  useLayoutEffect(() => {
    const update = () => setMargin(list.current?.offsetTop ?? 0);
    update();
    if (typeof ResizeObserver === 'undefined' || !header.current) return;
    const observer = new ResizeObserver(update);
    observer.observe(header.current);
    return () => observer.disconnect();
  }, []);

  const virtual = useVirtualizer({
    count: visible.length,
    getScrollElement: () => parent.current,
    estimateSize: (i) => (PREVIEW_IDS.has(visible[i]?.id) ? 330 : 160),
    overscan: 4,
    scrollMargin: margin,
    initialRect: { width: 360, height: 640 },
    getItemKey: (i) => visible[i]?.id ?? i,
  });
  const items = virtual.getVirtualItems();

  // Novo filtro: volta ao topo (cabeçalho e campo de busca visíveis).
  useEffect(() => {
    if (parent.current && parent.current.scrollTop > margin) parent.current.scrollTop = 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, category, all]);

  const chooseContext = () => {
    setAll(false);
    setCategory('');
    setSearch('');
  };

  return (
    <div ref={parent} className="scroll-area relative h-full">
      <div ref={header} className="mx-auto w-full max-w-3xl px-4 pb-2 pt-4">
        <h3 className="text-[17px] font-semibold">
          {tr(
            `${models.length} modelos · ${scenes.length} blocos · 66 livros`,
            `${models.length} models · ${scenes.length} blocks · 66 books`,
            `${models.length} modelos · ${scenes.length} bloques · 66 libros`,
          )}
        </h3>
        {block && (
          <>
            <p className="mt-1 text-[15px]">
              {bookNames(language)[block.book - 1]} {block.start_chapter}–{block.end_chapter}
            </p>
            <Wrap className="mt-2">
              <Chip selected={!all} onClick={chooseContext}>
                {tr('Neste trecho', 'This passage', 'Este pasaje')}
              </Chip>
              <Chip selected={all} onClick={() => setAll(true)}>
                {t('all')}
              </Chip>
            </Wrap>
          </>
        )}
        {!contextual && (
          <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_16rem]">
            <label className="block">
              <span className="mb-1 block text-sm text-muted">{t('search')}</span>
              <span className="relative block">
                <Search size={19} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={tr('Arca, templo, harpa…', 'Ark, temple, harp…', 'Arca, templo, arpa…')}
                  enterKeyHint="search"
                  autoComplete="off"
                  className="w-full rounded-xl border border-outline bg-surface py-2.5 pl-10 pr-3 text-[16px] outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                />
              </span>
            </label>
            <Select
              label={tr('Categoria', 'Category', 'Categoría')}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              options={[{ value: '', label: t('all') }, ...categories.map((c) => ({ value: c, label: c }))]}
            />
          </div>
        )}
        <Small className="mt-3">
          {tr(
            'Reconstruções com materiais e iluminação PBR. O nível de detalhe varia por modelo. Objetos do relato, contexto cultural, metáforas e visões são identificados separadamente.',
            'Reconstructions with PBR materials and lighting. The level of detail varies by model. Objects in the account, cultural context, metaphors and visions are identified separately.',
            'Reconstrucciones con materiales e iluminación PBR. El nivel de detalle varía por modelo. Objetos del relato, contexto cultural, metáforas y visiones se identifican por separado.',
          )}
        </Small>
        <p className="sr-only" aria-live="polite">
          {tr(`${visible.length} modelos`, `${visible.length} models`, `${visible.length} modelos`)}
        </p>
        {visible.length === 0 && (
          <p className="py-6 text-center text-[15px] text-muted">{tr('Nenhum modelo encontrado.', 'No model found.', 'No se encontró ningún modelo.')}</p>
        )}
      </div>
      <ul ref={list} className="relative mx-auto w-full max-w-3xl px-4" style={{ height: virtual.getTotalSize() + 20 }}>
        {items.map((item) => {
          const m = visible[item.index];
          return (
            <li
              key={item.key}
              data-index={item.index}
              ref={virtual.measureElement}
              className="absolute left-4 right-4 top-0 pb-3"
              style={{ transform: `translateY(${item.start - virtual.options.scrollMargin}px)` }}
            >
              <ModelCard model={m} association={contextual ? associationFor(block, m.id) : null} language={language} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const ModelCard = memo(function ModelCard({
  model: m,
  association,
  language,
}: {
  model: Model3D;
  association: ReturnType<typeof associationFor>;
  language: string;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const target = association ? fromId(association.reference) : null;
  return (
    <Card className="p-2">
      {PREVIEW_IDS.has(m.id) && !imageFailed && (
        <button type="button" onClick={() => openModel(m)} className="block w-full overflow-hidden rounded-xl">
          <img
            src={packUrl(catalog.models3d, `previews/${m.id}.jpg`)}
            alt={tr(`Abrir modelo 3D: ${m.title}`, `Open 3D model: ${m.title}`, `Abrir modelo 3D: ${m.title}`)}
            loading="lazy"
            decoding="async"
            width={720}
            height={480}
            onError={() => setImageFailed(true)}
            className="block h-[170px] w-full bg-surface-high object-cover"
          />
        </button>
      )}
      <button
        type="button"
        onClick={() => openModel(m)}
        className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-on-surface/5"
      >
        <Box size={22} aria-hidden className="shrink-0 text-primary" />
        <span className="min-w-0 flex-1">
          <span className="block text-[15.5px] leading-snug">{m.title}</span>
          <span className="block text-sm text-muted">{modelCategory(m)}</span>
        </span>
        <ChevronRight size={20} aria-hidden className="shrink-0 text-muted" />
      </button>
      {association ? (
        <>
          <Wrap className="px-2">
            <span className="inline-flex min-h-[34px] items-center rounded-lg border border-outline px-3 py-1 text-sm">{association.genre}</span>
            {target && (
              <Action label={refLabel(target, language)} icon={BookOpen} onClick={() => showPassage(target, { sourceEdition: 'BLN4' })} />
            )}
          </Wrap>
          <p className="p-2 text-[15px] leading-relaxed">{association.explanation}</p>
        </>
      ) : (
        <p className="p-2 text-[15px] leading-relaxed">{m.description}</p>
      )}
    </Card>
  );
});

// ======================================================================
// Visualizador
// ======================================================================

/** Botão da barra 3D: só ícone em telas estreitas, ícone + texto a partir de sm. */
function Tool({ label, icon: Icon, onClick, disabled }: { label: string; icon: IconType; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="inline-flex h-11 min-w-[44px] shrink-0 items-center justify-center gap-1.5 rounded-full px-2.5 text-[15px] font-medium text-primary transition hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-40 sm:px-3"
    >
      <Icon size={20} aria-hidden />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

/** FilterChip: alternância com estado e opção de ficar desativada. */
function FilterChip({ label, selected, onChange, disabled, hint }: { label: string; selected: boolean; onChange: (v: boolean) => void; disabled?: boolean; hint?: string }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      title={hint}
      onClick={() => onChange(!selected)}
      className={cx(
        'inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border px-3 py-1 text-sm transition disabled:cursor-not-allowed disabled:opacity-45',
        selected ? 'border-transparent bg-secondary-container font-medium' : 'border-outline hover:bg-on-surface/5',
      )}
    >
      {label}
    </button>
  );
}

type Phase = 'confirm' | 'loading' | 'ready' | 'failed';

export function ModelPage({ model: m }: { model: Model3D }) {
  useApp();
  const language = lang();
  const reduced = pref('reduced_motion', false);
  const local = m.local;
  const file = validModelFile(m.file) ? m.file : null;
  const bytes = file ? catalog.models3d.sizes[file] : undefined;
  const saveData = useMemo(saveDataEnabled, []);
  const [phase, setPhase] = useState<Phase>(() => (!local && file && needsConfirmation(bytes, saveData) ? 'confirm' : 'loading'));
  const [text, setText] = useState(false);
  const [spin, setSpin] = useState(false);
  const [cool, setCool] = useState(false);
  const [status, setStatus] = useState('');
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const frame = useRef<HTMLIFrameElement>(null);
  // O src é fixado na montagem: mudar a preferência não recarrega o modelo.
  const [src] = useState(() => (local ? viewerUrl(null, reduced) : file ? viewerUrl(file, reduced) : null));
  const viewerAvailable = src !== null;
  const latest = useRef({ spin, cool, hidden });
  latest.current = { spin, cool, hidden };

  const send = useCallback((name: string, value?: unknown) => {
    try {
      frame.current?.contentWindow?.postMessage(viewerCommand(name, value), location.origin);
    } catch {
      /* quadro descarregado */
    }
  }, []);

  // Estado escolhido antes de o modelo terminar de carregar.
  const restore = useCallback(() => {
    const s = latest.current;
    if (s.spin) send('turntable', true);
    if (s.cool) send('atmosphere', 'cool');
    for (const name of s.hidden) send('layer', { name, visible: false });
  }, [send]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== location.origin) return;
      const source = frame.current?.contentWindow;
      if (!source || event.source !== source) return;
      const value = parseViewerMessage(event.data);
      if (value === null) return;
      if (value === 'ready') {
        // "ready" chega logo após setup() e de novo (ponte Status) quando o
        // GLB termina de ser lido; reaplicar é idempotente e cobre as camadas.
        setPhase('ready');
        restore();
        return;
      }
      if (isViewerError(value)) setPhase('failed');
      setStatus(cleanPartName(value));
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [restore]);

  // Libera o WebGL e a memória do quadro ao fechar a folha.
  useEffect(
    () => () => {
      const element = frame.current;
      if (element) {
        try {
          element.src = 'about:blank';
        } catch {
          /* já removido */
        }
      }
    },
    [],
  );

  const onFrameLoad = useCallback(async () => {
    const element = frame.current;
    const win = element?.contentWindow;
    if (!element || !win || element.getAttribute('src') === 'about:blank') return;
    // Ponte "Status" (como o canal do WebView nativo): nome da peça tocada e erros.
    try {
      const doc = element.contentDocument;
      if (doc && !(win as Window & { Status?: unknown }).Status) {
        const script = doc.createElement('script');
        script.textContent = STATUS_BRIDGE;
        (doc.body ?? doc.documentElement).appendChild(script);
      }
    } catch {
      /* sem acesso ao documento: seguem só as mensagens do visualizador */
    }
    if (!local) return;
    try {
      const buffer = await userModelBuffer(local.module, local.key);
      if (!buffer) {
        setPhase('failed');
        setStatus(tr('Arquivo do modelo importado não encontrado neste aparelho.', 'Imported model file not found on this device.', 'No se encontró el archivo del modelo importado en este dispositivo.'));
        return;
      }
      if (frame.current?.contentWindow !== win) return;
      win.postMessage({ channel: 'biblia3d', name: 'buffer', value: buffer }, location.origin, [buffer]);
    } catch (error) {
      setPhase('failed');
      setStatus(`${tr('Erro ao carregar arquivo 3D', 'Error loading 3D file', 'Error al cargar el archivo 3D')}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }, [local]);

  const controlsOff = text || !viewerAvailable || phase === 'confirm';
  const parts = useMemo(() => uniqueParts(m.parts), [m.parts]);
  const licenseUrl = typeof (m as unknown as { license_url?: unknown }).license_url === 'string' ? (m as unknown as { license_url: string }).license_url : '';

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-outline/30 px-2 py-1">
        <div className="no-scrollbar flex items-center gap-0.5 overflow-x-auto" role="toolbar" aria-label={tr('Controles do modelo 3D', '3D model controls', 'Controles del modelo 3D')}>
          <Tool label={t('reset')} icon={Undo2} onClick={() => send('reset')} disabled={controlsOff} />
          <Tool label={`${t('rotate')} ←`} icon={RotateCcw} onClick={() => send('rotate', -15)} disabled={controlsOff} />
          <Tool label={`${t('rotate')} →`} icon={RotateCw} onClick={() => send('rotate', 15)} disabled={controlsOff} />
          <Tool label={t('zoomIn')} icon={ZoomIn} onClick={() => send('zoom', 0.8)} disabled={controlsOff} />
          <Tool label={t('zoomOut')} icon={ZoomOut} onClick={() => send('zoom', 1.25)} disabled={controlsOff} />
          <Tool label={tr('Vista superior', 'Top view', 'Vista superior')} icon={ArrowUpToLine} onClick={() => send('viewpoint', 'top')} disabled={controlsOff} />
          <Tool label={tr('Vista frontal', 'Front view', 'Vista frontal')} icon={RectangleVertical} onClick={() => send('viewpoint', 'front')} disabled={controlsOff} />
        </div>
        <Wrap className="px-1 pb-1 pt-0.5">
          <FilterChip
            label={tr('Giro automático', 'Auto-rotate', 'Giro automático')}
            selected={spin && !reduced}
            disabled={reduced}
            hint={reduced ? tr('Desativado por “Movimento reduzido”.', 'Disabled by “Reduce motion”.', 'Desactivado por “Movimiento reducido”.') : undefined}
            onChange={(v) => {
              setSpin(v);
              send('turntable', v);
            }}
          />
          <FilterChip
            label={tr('Luz neutra', 'Neutral light', 'Luz neutra')}
            selected={cool}
            onChange={(v) => {
              setCool(v);
              send('atmosphere', v ? 'cool' : 'warm');
            }}
          />
          <FilterChip label={t('textAlternative')} selected={text} onChange={setText} />
        </Wrap>
      </div>

      {/* O quadro fica montado (oculto) no modo texto para não baixar o modelo outra vez. */}
      <div className={cx('relative min-h-[200px] flex-[7] bg-[#272d33]', text && 'hidden')}>
        {!viewerAvailable ? (
          <p className="flex h-full items-center justify-center p-6 text-center text-[15px] text-white">
            {tr('Arquivo de modelo 3D inválido.', 'Invalid 3D model file.', 'Archivo de modelo 3D no válido.')}
          </p>
        ) : phase === 'confirm' ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-white">
            <Box size={40} aria-hidden className="opacity-80" />
            <p className="text-[17px] font-medium">
              {tr('Modelo 3D', '3D model', 'Modelo 3D')} · {formatModelSize(bytes ?? 0, language)}
            </p>
            <p className="max-w-sm text-sm opacity-85">
              {saveData
                ? tr(
                    'A economia de dados está ativada no navegador. O arquivo só será baixado se você pedir.',
                    'Data saver is on in your browser. The file will only download if you ask.',
                    'El ahorro de datos está activado en el navegador. El archivo solo se descargará si usted lo pide.',
                  )
                : tr(
                    'Arquivo grande: confira a conexão antes de baixar. A descrição e as referências continuam disponíveis abaixo.',
                    'Large file: check your connection before downloading. The description and references remain available below.',
                    'Archivo grande: verifique la conexión antes de descargar. La descripción y las referencias siguen disponibles abajo.',
                  )}
            </p>
            <Button icon={Download} onClick={() => setPhase('loading')}>
              {tr('Carregar modelo', 'Load model', 'Cargar modelo')}
            </Button>
          </div>
        ) : (
          <>
            <iframe
              ref={frame}
              src={src ?? undefined}
              title={tr('Reconstrução bíblica 3D', 'Biblical 3D reconstruction', 'Reconstrucción bíblica 3D')}
              onLoad={() => void onFrameLoad()}
              className="absolute inset-0 h-full w-full border-0"
            />
            {phase === 'loading' && (
              <div role="status" className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-center gap-2 bg-black/40 p-2 text-sm text-white">
                <LoaderCircle size={18} aria-hidden className="animate-spin" />
                {tr('Carregando modelo 3D…', 'Loading 3D model…', 'Cargando modelo 3D…')}
                {bytes ? ` · ${formatModelSize(bytes, language)}` : ''}
              </div>
            )}
          </>
        )}
        {phase === 'loading' && viewerAvailable && (
          <div className="absolute inset-x-0 bottom-0">
            <Progress />
          </div>
        )}
      </div>

      <div className={cx('scroll-area min-h-[9rem] px-5 py-4', text ? 'flex-1' : 'flex-[2]')}>
        <div className="mx-auto max-w-3xl space-y-3">
          <p aria-live="polite" className={cx('text-[15px]', status ? '' : 'sr-only', phase === 'failed' && 'text-danger')}>
            {phase === 'failed' && <TriangleAlert size={16} aria-hidden className="mr-1 inline align-[-2px]" />}
            {status}
          </p>
          <p className="select-text whitespace-pre-line text-[15.5px] leading-relaxed">{m.description}</p>
          <p className="text-[15px] leading-relaxed">{m.certainty}</p>
          <p className="text-sm text-muted">
            {m.author} ·{' '}
            {licenseUrl ? (
              <a href={licenseUrl} target="_blank" rel="noopener noreferrer" className="underline decoration-dotted underline-offset-2">
                {m.license}
              </a>
            ) : (
              m.license
            )}
          </p>
          {m.source && <p className="select-text text-sm text-muted">{m.source}</p>}
          {text && parts.length > 0 && (
            <section aria-label={tr('Partes do modelo', 'Model parts', 'Partes del modelo')}>
              <h3 className="mb-1 text-[15px] font-semibold">{tr('Partes do modelo', 'Model parts', 'Partes del modelo')}</h3>
              <p className="text-[15px] leading-relaxed">{parts.join(' · ')}</p>
            </section>
          )}
          {m.references.length > 0 && (
            <Wrap>
              {m.references.map((id) => {
                const r = fromId(id);
                if (!r) return null;
                return <Action key={id} label={refLabel(r, language)} icon={BookOpen} onClick={() => showPassage(r, { sourceEdition: local ? undefined : 'BLN4' })} />;
              })}
            </Wrap>
          )}
          {m.layers.length > 0 && (
            <fieldset>
              <legend className="mb-1 text-[15px] font-semibold">{tr('Camadas', 'Layers', 'Capas')}</legend>
              {m.layers.map((layer) => (
                <label key={layer} className="flex min-h-[44px] cursor-pointer items-center gap-3 text-[15.5px]">
                  <input
                    type="checkbox"
                    className="h-5 w-5 accent-[rgb(var(--primary))]"
                    checked={!hidden.has(layer)}
                    onChange={(e) => {
                      const visible = e.target.checked;
                      setHidden((current) => {
                        const next = new Set(current);
                        if (visible) next.delete(layer);
                        else next.add(layer);
                        return next;
                      });
                      send('layer', { name: layer, visible });
                    }}
                  />
                  {layer}
                </label>
              ))}
            </fieldset>
          )}
        </div>
      </div>
    </div>
  );
}
