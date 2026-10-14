// GraphPage e StudyGraphPainter (lib/graph.dart): rede de conexões de uma
// passagem (temas, referências editoriais, relações curadas, notas pessoais,
// acontecimentos e lugares) em layout radial SVG, com zoom/pan, lista
// acessível, trilha de navegação e expansão de temas.
import { ArrowLeft, BookOpen, Circle, Focus, List, Minus, Network, NotebookPen, Plus, Tag } from 'lucide-react';
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { app, useApp } from '../lib/app';
import {
  backlinks as noteBacklinks,
  notesAt,
  note as findNote,
  pref,
  storeRevision,
  type Note,
} from '../lib/store';
import {
  crossReferenceCount,
  crossReferences,
  loadContext,
  relations,
  topic as loadTopic,
  topicsAt,
  type ContextData,
  type CrossRef,
  type Topic,
} from '../lib/content';
import { refId, refLabel, type Ref } from '../lib/domain';
import { lang, tr } from '../lib/i18n';
import {
  RELATION_KINDS,
  centerLabelBounds,
  clampView,
  collectNodes,
  fitView,
  hitTest,
  labelBounds,
  radialLayout,
  relationLabel,
  sceneSize,
  selectNodes,
  starField,
  textMeasurer,
  toScene,
  topicNodes,
  viewTransform,
  viewportHeight,
  wrapLabel,
  zoomView,
  type GraphNode,
  type Point,
  type Rect,
  type Relation,
  type Size,
  type View,
} from '../lib/models-graph';
import { Action, Button, Card, ErrorBox, IconButton, Progress, Select, Small, Spinner, Wrap, cx, useAsync } from '../components/ui';
import { choosePassage, openNote, openTopic, showPassage } from './open';

// Cores do StudyGraphPainter: tokens do tema + tons fixos do Material.
const KIND_COLORS: Record<string, string> = {
  textual: 'rgb(var(--primary))',
  theological: 'rgb(var(--tertiary))',
  personal: '#ffa000', // amber.shade700
  history: '#42a5f5', // blue.shade400
  place: '#26a69a', // teal.shade400
  topic: '#ab47bc', // purple.shade400
};
const kindColor = (kind: string) => KIND_COLORS[kind] ?? 'rgb(var(--secondary))';

interface RootData {
  key: string;
  topicTitle?: string;
  references?: string[];
  topics?: Topic[];
  xrefs?: CrossRef[];
  count?: number;
  notes?: Note[];
}

async function loadRootData(root: Ref, topicId: string | null, key: string): Promise<RootData> {
  if (topicId) {
    const detail = await loadTopic(topicId);
    return { key, topicTitle: detail?.title, references: detail?.references ?? [] };
  }
  const id = refId(root);
  const [themes, xrefs, count, own, links] = await Promise.all([
    topicsAt(root, 3).catch(() => [] as Topic[]),
    crossReferences(root, 60),
    crossReferenceCount(root),
    notesAt(id),
    noteBacklinks(id),
  ]);
  return { key, topics: themes, xrefs, count, notes: [...own, ...links] };
}

async function loadBase(): Promise<{ curated: Relation[]; context: ContextData | null }> {
  // Como no original: sem esses arquivos o grafo continua com as demais ligações.
  const [curated, context] = await Promise.all([relations().catch(() => [] as Relation[]), loadContext().catch(() => null)]);
  return { curated, context };
}

interface Controller {
  zoom: (factor: number) => void;
  fit: () => void;
}

export default function GraphPage({ reference }: { reference?: Ref }) {
  useApp();
  const language = lang();
  const [root, setRoot] = useState<Ref>(() => reference ?? app.passage);
  const [topicId, setTopicId] = useState<string | null>(null);
  const [trail, setTrail] = useState<{ reference: Ref; topicId: string | null }[]>([]);
  const [kind, setKind] = useState('all');
  const [density, setDensity] = useState(8);
  const [list, setList] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [fitToken, setFitToken] = useState(0);
  const controller = useRef<Controller | null>(null);
  const details = useRef<HTMLDivElement>(null);
  const current = useRef({ root, topicId });
  current.current = { root, topicId };

  const base = useAsync(loadBase, []);
  const key = `${refId(root)}|${topicId ?? ''}`;
  const revision = storeRevision(); // notas criadas/alteradas atualizam a rede
  const data = useAsync(() => loadRootData(root, topicId, key), [key, revision]);
  const ready = data.data?.key === key ? data.data : null;

  const candidates = useMemo(() => {
    if (!ready || ready.references) return null;
    return collectNodes({
      root,
      topics: ready.topics ?? [],
      xrefs: ready.xrefs ?? [],
      curated: base.data?.curated ?? [],
      notes: ready.notes ?? [],
      context: base.data?.context ?? null,
      language,
    });
  }, [ready, root, base.data, language]);

  const nodes = useMemo<GraphNode[] | null>(() => {
    if (!ready) return null;
    if (ready.references) return topicNodes(ready.references, kind, density, language);
    return selectNodes(candidates ?? [], refId(root), kind, density);
  }, [ready, candidates, kind, density, root, language]);

  const selected = nodes?.find((n) => n.id === selectedId) ?? null;
  const centerId = topicId ?? refId(root);
  const centerTitle = topicId ? ready?.topicTitle ?? tr('Tema', 'Topic', 'Tema') : refLabel(root, language);

  const focus = useCallback((r: Ref, options: { remember?: boolean; topic?: string | null } = {}) => {
    if (options.remember !== false) {
      const previous = current.current;
      setTrail((t) => [...t, { reference: previous.root, topicId: previous.topicId }]);
    }
    setRoot(r);
    setTopicId(options.topic ?? null);
    setKind('all');
    setSelectedId(null);
    setFitToken((n) => n + 1);
  }, []);

  const back = () => {
    const previous = trail[trail.length - 1];
    if (!previous) return;
    setTrail((t) => t.slice(0, -1));
    focus(previous.reference, { topic: previous.topicId, remember: false });
  };

  const expandable = (n: GraphNode) => n.reference !== undefined || n.kind === 'topic';
  const expand = (n: GraphNode) => {
    if (n.reference) focus(n.reference);
    else if (n.kind === 'topic') focus(root, { topic: n.id.slice('topic:'.length) });
  };

  const selectFromGraph = useCallback((id: string) => {
    setSelectedId(id);
    // Os detalhes ficam abaixo do grafo: traz o cartão para a tela.
    requestAnimationFrame(() =>
      details.current?.scrollIntoView?.({ block: 'nearest', behavior: pref('reduced_motion', false) ? 'auto' : 'smooth' }),
    );
  }, []);

  let body;
  if (data.error && !ready) body = <ErrorBox error={data.error} onRetry={data.reload} />;
  else if (!nodes) body = <Spinner />;
  else if (nodes.length === 0)
    body = (
      <p className="p-6 text-[15px]">
        {tr(
          'Este filtro não possui ligações cadastradas. Escolha outro tipo ou passagem.',
          'This filter has no registered connections. Choose another type or passage.',
          'Este filtro no tiene conexiones registradas. Elija otro tipo o pasaje.',
        )}
      </p>
    );
  else if (list)
    body = (
      <ul className="mt-1">
        {nodes.map((n) => (
          <li key={n.id} className="flex items-center gap-1">
            <button
              type="button"
              aria-pressed={selectedId === n.id}
              onClick={() => setSelectedId(n.id)}
              className={cx(
                'flex min-w-0 flex-1 items-start gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-on-surface/5',
                selectedId === n.id && 'bg-secondary-container',
              )}
            >
              <Circle size={20} aria-hidden className="mt-0.5 shrink-0" style={{ color: kindColor(n.kind) }} />
              <span className="min-w-0 flex-1">
                <span className="block text-[15.5px] leading-snug">{n.title}</span>
                <span className="block text-sm text-muted">{relationLabel(n.kind)}</span>
              </span>
            </button>
            {expandable(n) && (
              <IconButton label={`${tr('Expandir conexões', 'Expand connections', 'Ampliar conexiones')}: ${n.title}`} icon={Network} onClick={() => expand(n)} />
            )}
          </li>
        ))}
      </ul>
    );
  else
    body = (
      <GraphCanvas
        nodes={nodes}
        centerId={centerId}
        centerTitle={centerTitle}
        selectedId={selectedId}
        onSelect={selectFromGraph}
        fitToken={fitToken}
        controller={controller}
      />
    );

  return (
    <div className="mx-auto max-w-3xl p-4">
      <Wrap className="gap-1.5">
        {!topicId && <Action label={tr('Ler passagem', 'Read passage', 'Leer pasaje')} icon={BookOpen} onClick={() => showPassage(root, { sourceEdition: 'BLN4' })} />}
        {trail.length > 0 && <IconButton label={tr('Voltar à conexão anterior', 'Back to the previous connection', 'Volver a la conexión anterior')} icon={ArrowLeft} onClick={back} />}
        <Button
          variant="text"
          icon={BookOpen}
          title={tr('Escolher passagem', 'Choose passage', 'Elegir pasaje')}
          aria-label={`${tr('Escolher passagem', 'Choose passage', 'Elegir pasaje')}: ${centerTitle}`}
          className="min-w-0 max-w-full"
          onClick={() => choosePassage({ initial: root, onSelect: (r) => focus(r) })}
        >
          <span className="truncate">{centerTitle}</span>
        </Button>
      </Wrap>
      <Small className="mt-1">
        {topicId
          ? tr(
              'Rede do tema · toque numa passagem para explorar suas conexões.',
              'Topic network · tap a passage to explore its connections.',
              'Red del tema · toque un pasaje para explorar sus conexiones.',
            )
          : ready
            ? tr(
                `${ready.count ?? 0} referências diretas na base. Toque para ampliar a conexão.`,
                `${ready.count ?? 0} direct references in the database. Tap to widen the connection.`,
                `${ready.count ?? 0} referencias directas en la base. Toque para ampliar la conexión.`,
              )
            : ' '}
      </Small>

      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_9rem]">
        <Select
          label={tr('Tipo de ligação', 'Connection type', 'Tipo de conexión')}
          value={kind}
          onChange={(e) => {
            setKind(e.target.value);
            setSelectedId(null);
            setFitToken((n) => n + 1);
          }}
          options={[{ value: 'all', label: tr('Todos', 'All', 'Todos') }, ...RELATION_KINDS.map((k) => ({ value: k, label: relationLabel(k) }))]}
        />
        <Select
          label={tr('Densidade', 'Density', 'Densidad')}
          value={String(density)}
          onChange={(e) => {
            setDensity(Number(e.target.value));
            setSelectedId(null);
            setFitToken((n) => n + 1);
          }}
          options={[8, 12, 20].map((n) => ({ value: String(n), label: tr(`${n} nós`, `${n} nodes`, `${n} nodos`) }))}
        />
      </div>

      <Wrap className="mt-2 gap-1">
        <Button variant="text" icon={list ? Network : List} onClick={() => setList((v) => !v)}>
          {list ? tr('Ver grafo', 'Show graph', 'Ver grafo') : tr('Lista acessível', 'Accessible list', 'Lista accesible')}
        </Button>
        <IconButton label={tr('Aproximar rede', 'Zoom in on the network', 'Acercar red')} icon={Plus} disabled={list} onClick={() => controller.current?.zoom(1.35)} />
        <IconButton label={tr('Afastar rede', 'Zoom out of the network', 'Alejar red')} icon={Minus} disabled={list} onClick={() => controller.current?.zoom(1 / 1.35)} />
        <IconButton label={tr('Enquadrar toda a galáxia', 'Fit the whole galaxy', 'Encuadrar toda la galaxia')} icon={Focus} disabled={list} onClick={() => controller.current?.fit()} />
      </Wrap>

      <div className="h-1">{(data.loading || base.loading) && <Progress />}</div>
      <p className="sr-only" aria-live="polite">
        {nodes ? tr(`${nodes.length} conexões: ${centerTitle}`, `${nodes.length} connections: ${centerTitle}`, `${nodes.length} conexiones: ${centerTitle}`) : ''}
      </p>
      {body}

      <div ref={details} className="scroll-mb-4">
        {selected ? (
          <Details
            node={selected}
            onRead={(r) => showPassage(r, { sourceEdition: 'BLN4' })}
            onExpand={() => expand(selected)}
          />
        ) : nodes && nodes.length > 0 ? (
          <p className="py-3 text-[15px]">
            {tr(
              'Toque em uma estrela para ver os detalhes e ampliar sua conexão. Use dois dedos ou +/− para o zoom. A lista é acessível por teclado.',
              'Tap a star to see details and widen its connection. Use two fingers or +/− to zoom. The list is keyboard accessible.',
              'Toque una estrella para ver los detalles y ampliar su conexión. Use dos dedos o +/− para el zoom. La lista es accesible por teclado.',
            )}
          </p>
        ) : null}
      </div>
      <Small className="mt-2">
        {tr(
          'As cores distinguem citação textual, referência editorial, interpretação teológica, nota pessoal, acontecimento e lugar. Referências editoriais não afirmam equivalência entre textos.',
          'Colors distinguish textual quotation, editorial reference, theological interpretation, personal note, event and place. Editorial references do not assert equivalence between texts.',
          'Los colores distinguen cita textual, referencia editorial, interpretación teológica, nota personal, acontecimiento y lugar. Las referencias editoriales no afirman equivalencia entre textos.',
        )}
      </Small>
    </div>
  );
}

function Details({ node, onRead, onExpand }: { node: GraphNode; onRead: (r: Ref) => void; onExpand: () => void }) {
  const topicKey = node.kind === 'topic' ? node.id.slice('topic:'.length) : null;
  return (
    <Card className="mt-3 p-4">
      <h3 className="text-[17px] font-semibold leading-snug">{node.title}</h3>
      <p className="mt-0.5 flex items-center gap-1.5 text-sm font-medium text-muted">
        <Circle size={12} aria-hidden style={{ color: kindColor(node.kind), fill: kindColor(node.kind) }} />
        {relationLabel(node.kind)}
      </p>
      <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed">{node.description}</p>
      <Wrap className="mt-2">
        {node.reference ? (
          <>
            <Action label={tr('Ler passagem', 'Read passage', 'Leer pasaje')} icon={BookOpen} onClick={() => onRead(node.reference!)} />
            <Action label={tr('Expandir conexões', 'Expand connections', 'Ampliar conexiones')} icon={Network} onClick={onExpand} />
          </>
        ) : topicKey ? (
          <>
            <Action label={tr('Abrir estudo do tema', 'Open topic study', 'Abrir estudio del tema')} icon={Tag} onClick={() => openTopic(topicKey, node.title)} />
            <Action label={tr('Expandir passagens do tema', 'Expand topic passages', 'Ampliar pasajes del tema')} icon={Network} onClick={onExpand} />
          </>
        ) : node.kind === 'personal' ? (
          <Action
            label={tr('Abrir anotação', 'Open note', 'Abrir anotación')}
            icon={NotebookPen}
            onClick={async () => {
              const n = await findNote(node.id);
              if (n) openNote(n);
            }}
          />
        ) : null}
      </Wrap>
    </Card>
  );
}

// ======================================================================
// Grafo (SVG): pintura idêntica ao StudyGraphPainter, zoom/pan sem re-render
// ======================================================================

function useViewportSize(element: React.RefObject<HTMLElement>): Size {
  const [size, setSize] = useState<Size>(() => ({
    width: 360,
    height: viewportHeight(typeof window === 'undefined' ? 700 : window.innerHeight),
  }));
  useLayoutEffect(() => {
    const update = () => {
      const width = element.current?.clientWidth || 360;
      const height = viewportHeight(window.innerHeight);
      setSize((s) => (s.width === width && s.height === height ? s : { width, height }));
    };
    update();
    window.addEventListener('resize', update);
    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && element.current) {
      observer = new ResizeObserver(update);
      observer.observe(element.current);
    }
    return () => {
      window.removeEventListener('resize', update);
      observer?.disconnect();
    };
  }, [element]);
  return size;
}

interface Gesture {
  start: Point;
  moved: boolean;
  multi: boolean;
  origin: { left: number; top: number };
}

function GraphCanvas({
  nodes,
  centerId,
  centerTitle,
  selectedId,
  onSelect,
  fitToken,
  controller,
}: {
  nodes: GraphNode[];
  centerId: string;
  centerTitle: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
  fitToken: number;
  controller: React.MutableRefObject<Controller | null>;
}) {
  const box = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const layer = useRef<SVGGElement>(null);
  const viewport = useViewportSize(box);
  const scene = sceneSize(nodes.length);
  const positions = useMemo(() => radialLayout(nodes, centerId, scene), [nodes, centerId, scene.width, scene.height]); // eslint-disable-line react-hooks/exhaustive-deps
  const center = positions.get(centerId)!;
  const view = useRef<View>(fitView(viewport, scene));
  const pointers = useRef(new Map<number, Point>());
  const gesture = useRef<Gesture | null>(null);
  const [focused, setFocused] = useState<string | null>(null);

  const apply = useCallback(() => {
    layer.current?.setAttribute('transform', viewTransform(view.current));
  }, []);
  const setView = useCallback(
    (next: View) => {
      view.current = clampView(next, viewport, scene);
      apply();
    },
    [apply, viewport, scene.width, scene.height], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Enquadra ao mudar de foco/filtro/densidade ou quando o quadro/cena mudam.
  useLayoutEffect(() => {
    view.current = fitView(viewport, scene);
    apply();
  }, [fitToken, viewport.width, viewport.height, scene.width, scene.height, apply]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    controller.current = {
      zoom: (factor) => setView(zoomView(view.current, factor, viewport)),
      fit: () => {
        view.current = fitView(viewport, scene);
        apply();
      },
    };
    return () => {
      controller.current = null;
    };
  }, [controller, setView, apply, viewport, scene.width, scene.height]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pinça do trackpad / Ctrl+roda: zoom no cursor (a roda simples rola a página).
  useEffect(() => {
    const element = svg.current;
    if (!element) return;
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const rect = element.getBoundingClientRect();
      const factor = Math.exp(-event.deltaY * 0.01);
      setView(zoomView(view.current, factor, viewport, { x: event.clientX - rect.left, y: event.clientY - rect.top }));
    };
    element.addEventListener('wheel', onWheel, { passive: false });
    return () => element.removeEventListener('wheel', onWheel);
  }, [setView, viewport]);

  const local = (event: ReactPointerEvent, origin: { left: number; top: number }): Point => ({ x: event.clientX - origin.left, y: event.clientY - origin.top });

  const onPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const origin = gesture.current?.origin ?? { left: rect.left, top: rect.top };
    const p = local(event, origin);
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* ponteiro sintético */
    }
    pointers.current.set(event.pointerId, p);
    if (pointers.current.size === 1) gesture.current = { start: p, moved: false, multi: false, origin };
    else if (gesture.current) gesture.current.multi = true;
  };

  const onPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const g = gesture.current;
    const previous = pointers.current.get(event.pointerId);
    if (!g || !previous) return;
    const p = local(event, g.origin);
    if (pointers.current.size === 1) {
      if (!g.moved && Math.hypot(p.x - g.start.x, p.y - g.start.y) > 6) g.moved = true;
      if (g.moved) setView({ ...view.current, x: view.current.x + p.x - previous.x, y: view.current.y + p.y - previous.y });
    } else {
      const other = [...pointers.current.entries()].find(([id]) => id !== event.pointerId)?.[1];
      if (other) {
        const before = Math.hypot(previous.x - other.x, previous.y - other.y);
        const after = Math.hypot(p.x - other.x, p.y - other.y);
        const midBefore = { x: (previous.x + other.x) / 2, y: (previous.y + other.y) / 2 };
        const midAfter = { x: (p.x + other.x) / 2, y: (p.y + other.y) / 2 };
        const zoomed = before > 0 ? zoomView(view.current, after / before, viewport, midAfter) : view.current;
        setView({ ...zoomed, x: zoomed.x + midAfter.x - midBefore.x, y: zoomed.y + midAfter.y - midBefore.y });
        g.moved = true;
      }
    }
    pointers.current.set(event.pointerId, p);
  };

  const onPointerEnd = (event: ReactPointerEvent<SVGSVGElement>, cancelled: boolean) => {
    const g = gesture.current;
    if (!pointers.current.delete(event.pointerId)) return;
    if (pointers.current.size > 0) return;
    gesture.current = null;
    if (cancelled || !g || g.moved || g.multi) return;
    const hit = hitTest(nodes, positions, center, scene, toScene(view.current, local(event, g.origin)));
    if (hit) onSelect(hit.id);
  };

  const onKeyDown = (event: KeyboardEvent<SVGSVGElement>) => {
    const step = 40;
    const actions: Record<string, () => void> = {
      '+': () => setView(zoomView(view.current, 1.35, viewport)),
      '=': () => setView(zoomView(view.current, 1.35, viewport)),
      '-': () => setView(zoomView(view.current, 1 / 1.35, viewport)),
      '0': () => controller.current?.fit(),
      ArrowLeft: () => setView({ ...view.current, x: view.current.x + step }),
      ArrowRight: () => setView({ ...view.current, x: view.current.x - step }),
      ArrowUp: () => setView({ ...view.current, y: view.current.y + step }),
      ArrowDown: () => setView({ ...view.current, y: view.current.y - step }),
    };
    const action = actions[event.key];
    if (action && !event.altKey && !event.ctrlKey && !event.metaKey) {
      event.preventDefault();
      action();
    }
  };

  return (
    <div ref={box} className="relative mt-2 overflow-hidden rounded-2xl bg-surface-low ring-1 ring-outline/30" style={{ height: viewport.height }}>
      <svg
        ref={svg}
        width="100%"
        height={viewport.height}
        role="group"
        aria-label={`${tr('Rede de conexões', 'Connection network', 'Red de conexiones')}: ${centerTitle}. ${tr(
          'Setas movem, + e − ampliam, 0 enquadra.',
          'Arrows pan, + and − zoom, 0 fits.',
          'Las flechas mueven, + y − amplían, 0 encuadra.',
        )}`}
        className="block cursor-grab touch-none select-none font-ui active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(e) => onPointerEnd(e, false)}
        onPointerCancel={(e) => onPointerEnd(e, true)}
        onKeyDown={onKeyDown}
      >
        <g ref={layer} transform={viewTransform(view.current)}>
          <Scene
            nodes={nodes}
            positions={positions}
            center={center}
            scene={scene}
            centerTitle={centerTitle}
            selectedId={selectedId}
            focusedId={focused}
            onSelect={onSelect}
            onFocusNode={setFocused}
          />
        </g>
      </svg>
    </div>
  );
}

const Stars = memo(function Stars({ width, height }: { width: number; height: number }) {
  const stars = useMemo(() => starField({ width, height }), [width, height]);
  return (
    <g aria-hidden style={{ fill: 'rgb(var(--primary))' }}>
      {stars.map((s, i) => (
        <circle key={i} cx={s.x} cy={s.y} r={s.r} fillOpacity={s.alpha} />
      ))}
    </g>
  );
});

function Label({ text, rect, emphasized }: { text: string; rect: Rect; emphasized: boolean }) {
  const size = emphasized ? 14 : 13;
  const lines = useMemo(() => wrapLabel(text, rect.width - 8, textMeasurer(size, emphasized ? 700 : 500)), [text, rect.width, size, emphasized]);
  const lineHeight = size * 1.15;
  const cx = rect.x + rect.width / 2;
  const first = rect.y + rect.height / 2 - ((lines.length - 1) * lineHeight) / 2;
  return (
    <g aria-hidden>
      <rect x={rect.x} y={rect.y} width={rect.width} height={rect.height} rx={9} style={{ fill: 'rgb(var(--surface-low))' }} fillOpacity={emphasized ? 0.98 : 0.93} />
      <text
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={size}
        fontWeight={emphasized ? 700 : 500}
        style={{ fill: 'rgb(var(--on-surface))' }}
      >
        {lines.map((line, i) => (
          <tspan key={i} x={cx} y={first + i * lineHeight}>
            {line}
          </tspan>
        ))}
      </text>
    </g>
  );
}

const Scene = memo(function Scene({
  nodes,
  positions,
  center,
  scene,
  centerTitle,
  selectedId,
  focusedId,
  onSelect,
  onFocusNode,
}: {
  nodes: GraphNode[];
  positions: Map<string, Point>;
  center: Point;
  scene: Size;
  centerTitle: string;
  selectedId: string | null;
  focusedId: string | null;
  onSelect: (id: string) => void;
  onFocusNode: (id: string | null) => void;
}) {
  return (
    <>
      <Stars width={scene.width} height={scene.height} />
      {nodes.map((node) => {
        const p = positions.get(node.id)!;
        const highlighted = node.id === selectedId;
        return (
          <line
            key={`edge:${node.id}`}
            x1={center.x}
            y1={center.y}
            x2={p.x}
            y2={p.y}
            style={{ stroke: kindColor(node.kind) }}
            strokeOpacity={highlighted ? 0.83 : 0.31}
            strokeWidth={highlighted ? 3 : 1.5}
          />
        );
      })}
      <circle cx={center.x} cy={center.y} r={25} style={{ fill: 'rgb(var(--primary))' }} fillOpacity={0.16} />
      <circle cx={center.x} cy={center.y} r={15} style={{ fill: 'rgb(var(--primary))' }} />
      <Label text={centerTitle} rect={centerLabelBounds(center)} emphasized />
      {nodes.map((node) => {
        const p = positions.get(node.id)!;
        const color = kindColor(node.kind);
        const highlighted = node.id === selectedId;
        const onKeyDown = (event: KeyboardEvent<SVGGElement>) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            event.stopPropagation();
            onSelect(node.id);
          }
        };
        return (
          <g
            key={node.id}
            role="button"
            tabIndex={0}
            aria-pressed={highlighted}
            aria-label={`${node.title} — ${relationLabel(node.kind)}`}
            className="outline-none"
            onKeyDown={onKeyDown}
            onFocus={(event) => {
              let visible = true;
              try {
                visible = event.currentTarget.matches(':focus-visible');
              } catch {
                /* seletor sem suporte */
              }
              onFocusNode(visible ? node.id : null);
            }}
            onBlur={() => onFocusNode(null)}
          >
            {highlighted && <circle cx={p.x} cy={p.y} r={23} style={{ fill: color }} fillOpacity={0.25} />}
            {focusedId === node.id && <circle cx={p.x} cy={p.y} r={18} fill="none" style={{ stroke: 'rgb(var(--primary))' }} strokeWidth={3} />}
            <circle cx={p.x} cy={p.y} r={highlighted ? 12 : 10} style={{ fill: color }} />
            <Label text={node.title} rect={labelBounds(p, center, scene)} emphasized={highlighted} />
          </g>
        );
      })}
    </>
  );
});
