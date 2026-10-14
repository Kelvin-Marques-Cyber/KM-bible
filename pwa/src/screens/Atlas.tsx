// AtlasPage e MapPainter de lib/explore.dart: mapa offline em SVG (costa atual
// de referência, rotas reconstruídas, lugares antigos/atuais) com arrastar,
// pinça, roda do mouse, botões e teclado; lista filtrável de lugares.
// Desempenho: a costa é um único <path> memorizado; deslocamento e zoom só
// alteram o atributo transform de um <g> (requestAnimationFrame), sem render.
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, BookOpen, LocateFixed, Minus, NotebookPen, Plus, RotateCcw, Route } from 'lucide-react';
import { forwardRef, memo, useEffect, useId, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { useApp } from '../lib/app';
import { catalog, packUrl } from '../lib/catalog';
import { loadContext, type ContextData, type ContextLocation } from '../lib/content';
import { fromId, refId, refLabel, type Ref } from '../lib/domain';
import { eventDates, filterLocations } from '../lib/explore-logic';
import {
  DEFAULT_CENTER,
  LABEL_DX,
  LABEL_DY,
  LABEL_SIZE,
  MAP_H,
  MAP_W,
  centerOn,
  clampView,
  declutter,
  fitPoints,
  landGeometry,
  mapPalette,
  pinchView,
  project,
  routePath,
  zoomAt,
  type LandGeometry,
  type MapPalette,
  type Point,
  type View,
} from '../lib/explore-map';
import { fetchJson } from '../lib/fetcher';
import { lang, t, tr } from '../lib/i18n';
import { pref } from '../lib/store';
import { selectedTheme } from '../lib/themes';
import { Action, Async, Button, Chip, ErrorBox, Field, IconButton, Small, Spinner, cx, useAsync, useDebounced } from '../components/ui';
import { openNewNote, openPlace, showPassage } from './open';

const PLACE_PAGE = 100;
const PAN_STEP = 60;
const valid = (l: ContextLocation) => Number.isFinite(Number(l.lon)) && Number.isFinite(Number(l.lat));

/** land.json direto do pacote (falhas não ficam em cache: "Tentar novamente" funciona). */
const loadLand = () => fetchJson<unknown>(packUrl(catalog.misc, 'land.json'));

function useMapPalette(): MapPalette {
  const dark = selectedTheme(pref('theme', 'sepia')).dark;
  const contrast = pref('contrast', false);
  return useMemo(() => mapPalette(dark, contrast), [dark, contrast]);
}

// ---------------------------------------------------------------- AtlasPage
export default function AtlasPage({ focus }: { focus?: string }) {
  useApp();
  const state = useAsync(() => Promise.all([loadContext(), loadLand()]), []);
  if (state.error) return <ErrorBox error={state.error} onRetry={state.reload} />;
  if (!state.data) return <Spinner />;
  return <AtlasView data={state.data[0]} land={state.data[1]} focus={focus} />;
}

function AtlasView({ data, land, focus }: { data: ContextData; land: unknown; focus?: string }) {
  const language = lang();
  const palette = useMapPalette();
  const [modern, setModern] = useState(false);
  const [routeId, setRouteId] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(PLACE_PAGE);
  const filter = useDebounced(search, 250);
  const map = useRef<MapHandle>(null);

  const geometry = useMemo(() => landGeometry(land), [land]);
  const locations = useMemo(() => data.locations.filter(valid), [data.locations]);
  const route = data.routes.find((r) => r.id === routeId) ?? null;
  const routeD = useMemo(() => (route ? routePath(route.places, locations) : ''), [route, locations]);
  const routePlaces = useMemo(() => new Set(route?.places ?? []), [route]);
  const rows = useMemo(() => filterLocations(data.locations, filter), [data.locations, filter]);
  useEffect(() => setLimit(PLACE_PAGE), [filter]);

  // Rota escolhida: enquadra os lugares dela.
  useEffect(() => {
    if (!route) return;
    const byId = new Map(locations.map((l) => [l.id, l]));
    const points = route.places.map((id) => byId.get(id)).filter((l): l is ContextLocation => !!l).map((l) => project(Number(l.lon), Number(l.lat)));
    map.current?.fit(points);
  }, [route, locations]);

  const showOnMap = (l: ContextLocation) => {
    setSelected(l.id);
    map.current?.center(project(Number(l.lon), Number(l.lat)));
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-outline/40 px-3 py-2">
        <Chip selected={modern} onClick={() => setModern((v) => !v)}>
          {t('modern')}
        </Chip>
        <label className="flex min-w-[11rem] flex-1 items-center gap-2">
          <Route size={20} aria-hidden className="shrink-0 text-muted" />
          <span className="sr-only">Rota / Route</span>
          <select
            value={routeId}
            onChange={(e) => setRouteId(e.target.value)}
            title="Rota / Route"
            className="min-w-0 flex-1 rounded-xl border border-outline bg-surface px-3 py-2 text-[15px] outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
          >
            <option value="">Nenhuma / None</option>
            {data.routes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.title}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <MapCanvas
          ref={map}
          geometry={geometry}
          locations={locations}
          routeD={routeD}
          routePlaces={routePlaces}
          modern={modern}
          focus={focus}
          selected={selected}
          palette={palette}
          onPlace={(id) => {
            const l = locations.find((x) => x.id === id);
            if (l) openPlace(l.id, l.ancient);
          }}
        />
        <div className="scroll-area min-h-0 flex-[9_1_0%] border-t border-outline/40 md:w-[22rem] md:flex-none md:border-l md:border-t-0">
          <div className="p-4">
            <Small className="leading-relaxed">
              {tr(
                'Geografia atual de referência. Linhas de rota são sequências reconstruídas, não estradas medidas. Fronteiras antigas não são inferidas da costa moderna.',
                'Present-day reference geography. Route lines are reconstructed sequences, not measured roads. Ancient borders are not inferred from the modern coastline.',
                'Geografía actual de referencia. Las líneas de ruta son secuencias reconstruidas, no caminos medidos. Las fronteras antiguas no se infieren de la costa moderna.',
              )}
            </Small>
            {route && (
              <p className="mt-2 text-[15px]" aria-live="polite">
                {route.source} · {route.certainty}
              </p>
            )}
            {geometry.polygons === 0 && (
              <Small className="mt-2">{tr('Contorno da costa indisponível.', 'Coastline unavailable.', 'Contorno de la costa no disponible.')}</Small>
            )}
            <Field
              label={t('search')}
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoComplete="off"
              enterKeyHint="search"
              className="mt-3"
            />
            <p className="sr-only" aria-live="polite">
              {`${rows.length} ${tr('lugares', 'places', 'lugares')}`}
            </p>
            <ul className="mt-2">
              {rows.slice(0, limit).map((l) => (
                <li key={l.id} className="flex items-start gap-1">
                  <button
                    type="button"
                    onClick={() => openPlace(l.id, l.ancient)}
                    className={cx(
                      'min-w-0 flex-1 rounded-xl px-3 py-2.5 text-left transition hover:bg-on-surface/5',
                      (l.id === selected || l.id === focus) && 'bg-secondary-container',
                    )}
                  >
                    <span className="block text-[15.5px] leading-snug">
                      {l.ancient} / {l.modern}
                    </span>
                    <span className="mt-0.5 block text-sm text-muted">
                      {l.lat}, {l.lon} · {l.uncertainty}
                    </span>
                  </button>
                  {valid(l) && (
                    <IconButton
                      label={`${tr('Mostrar no mapa', 'Show on map', 'Mostrar en el mapa')}: ${l.ancient}`}
                      icon={LocateFixed}
                      size={20}
                      active={l.id === selected}
                      onClick={() => showOnMap(l)}
                    />
                  )}
                </li>
              ))}
            </ul>
            {rows.length > limit && (
              <div className="flex justify-center py-2">
                <Button variant="text" onClick={() => setLimit((n) => n + PLACE_PAGE)}>
                  {tr('Mostrar mais', 'Show more', 'Mostrar más')} ({rows.length - limit})
                </Button>
              </div>
            )}
            {rows.length === 0 && <p className="px-3 py-4 text-[15px]">{t('insufficient')}</p>}
            {language && null}
          </div>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ mapa
interface MapHandle {
  center: (p: Point) => void;
  fit: (points: Point[]) => void;
}

interface MapProps {
  geometry: LandGeometry;
  locations: ContextLocation[];
  routeD: string;
  routePlaces: Set<string>;
  modern: boolean;
  focus?: string;
  selected: string | null;
  palette: MapPalette;
  onPlace: (id: string) => void;
}

const distance = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const midpoint = (a: Point, b: Point): Point => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];

const MapCanvas = forwardRef<MapHandle, MapProps>(function MapCanvas(props, handle) {
  const { geometry, locations, routeD, routePlaces, modern, focus, selected, palette, onPlace } = props;
  const container = useRef<HTMLDivElement>(null);
  const group = useRef<SVGGElement>(null);
  const view = useRef<View>({ x: 0, y: 0, s: 1 });
  const size = useRef({ w: 0, h: 0 });
  const frame = useRef(0);
  const labelTimer = useRef(0);
  const labelScaleRef = useRef(1);
  const [labelScale, setLabelScale] = useState(1);
  const pointers = useRef(new Map<number, Point>());
  const pinch = useRef<{ start: View; mid: Point; dist: number } | null>(null);
  const tap = useRef<{ place: string | null; x: number; y: number; moved: number } | null>(null);
  const lastTap = useRef<{ x: number; y: number; time: number } | null>(null);
  const box = useRef<DOMRect | null>(null);
  const onPlaceRef = useRef(onPlace);
  onPlaceRef.current = onPlace;
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const clipId = `km-land-${uid}`;
  const helpId = `km-map-help-${uid}`;

  const focusLocation = useMemo(() => locations.find((l) => l.id === focus), [locations, focus]);
  const home = (): View => {
    const { w, h } = size.current;
    if (focusLocation) {
      const [x, y] = project(Number(focusLocation.lon), Number(focusLocation.lat));
      return centerOn(x, y, 1.5, w, h);
    }
    const [x, y] = project(DEFAULT_CENTER.lon, DEFAULT_CENTER.lat);
    return centerOn(x, y, 1, w, h);
  };

  /** Escreve a transformação no DOM (uma vez por quadro) e agenda nova escolha de rótulos. */
  const write = () => {
    frame.current = 0;
    const g = group.current;
    if (!g) return;
    const { x, y, s } = view.current;
    g.setAttribute('transform', `translate(${x.toFixed(2)} ${y.toFixed(2)}) scale(${s.toFixed(5)})`);
    g.style.setProperty('--inv', String(1 / s));
    if (Math.abs(Math.log(s / labelScaleRef.current)) > 0.03) {
      window.clearTimeout(labelTimer.current);
      labelTimer.current = window.setTimeout(() => {
        labelScaleRef.current = view.current.s;
        setLabelScale(view.current.s);
      }, 160);
    }
  };
  const setView = (v: View, immediate = false) => {
    view.current = clampView(v, size.current.w, size.current.h);
    if (immediate) {
      if (frame.current) cancelAnimationFrame(frame.current);
      write();
    } else if (!frame.current) {
      frame.current = requestAnimationFrame(write);
    }
  };
  const zoom = (factor: number) => setView(zoomAt(view.current, size.current.w / 2, size.current.h / 2, factor, size.current.w, size.current.h));
  const pan = (dx: number, dy: number) => setView({ ...view.current, x: view.current.x + dx, y: view.current.y + dy });
  const reset = () => setView(home());

  useImperativeHandle(handle, () => ({
    center: ([x, y]) => setView(centerOn(x, y, Math.max(view.current.s, 2), size.current.w, size.current.h)),
    fit: (points) => {
      const v = fitPoints(points, size.current.w, size.current.h);
      if (v) setView(v);
    },
  }));

  // Medida inicial, vista de partida e acompanhamento do tamanho.
  useLayoutEffect(() => {
    const el = container.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      return { w: r.width, h: r.height };
    };
    size.current = measure();
    view.current = clampView(home(), size.current.w, size.current.h);
    write();
    labelScaleRef.current = view.current.s;
    setLabelScale(view.current.s);
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      const next = measure();
      const prev = size.current;
      if (next.w === prev.w && next.h === prev.h) return;
      size.current = next;
      if (prev.w === 0 || prev.h === 0) setView(home(), true);
      else setView({ ...view.current, x: view.current.x + (next.w - prev.w) / 2, y: view.current.y + (next.h - prev.h) / 2 }, true);
    });
    observer.observe(el);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(
    () => () => {
      if (frame.current) cancelAnimationFrame(frame.current);
      window.clearTimeout(labelTimer.current);
    },
    [],
  );

  // Roda do mouse / pinça do trackpad: ouvinte não passivo para impedir a rolagem da folha.
  useEffect(() => {
    const el = container.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
      const factor = Math.min(2, Math.max(0.5, Math.exp(-e.deltaY * unit * 0.0018)));
      setView(zoomAt(view.current, e.clientX - r.left, e.clientY - r.top, factor, size.current.w, size.current.h));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const local = (e: ReactPointerEvent): Point => {
    const r = box.current ?? container.current!.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };
  const startPinch = () => {
    const [a, b] = [...pointers.current.values()];
    pinch.current = { start: { ...view.current }, mid: midpoint(a, b), dist: distance(a, b) };
  };
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if ((e.target as Element).closest('button, a, input, select')) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    box.current = e.currentTarget.getBoundingClientRect();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* sem captura (navegadores antigos) */
    }
    const p = local(e);
    pointers.current.set(e.pointerId, p);
    if (pointers.current.size === 1) {
      const place = (e.target as Element).closest('[data-place]')?.getAttribute('data-place') ?? null;
      tap.current = { place, x: p[0], y: p[1], moved: 0 };
      pinch.current = null;
    } else {
      tap.current = null;
      startPinch();
    }
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    const p = local(e);
    pointers.current.set(e.pointerId, p);
    if (pointers.current.size === 1) {
      if (tap.current) tap.current.moved = Math.max(tap.current.moved, distance(p, [tap.current.x, tap.current.y]));
      pan(p[0] - prev[0], p[1] - prev[1]);
    } else if (pinch.current) {
      const [a, b] = [...pointers.current.values()];
      const { start, mid, dist } = pinch.current;
      setView(pinchView(start, mid, dist, midpoint(a, b), distance(a, b), size.current.w, size.current.h));
    }
  };
  const onPointerEnd = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(e.pointerId)) return;
    const p = local(e);
    pointers.current.delete(e.pointerId);
    if (pointers.current.size >= 2) {
      startPinch();
      return;
    }
    pinch.current = null;
    if (pointers.current.size === 1) return; // continua arrastando com o dedo restante
    const t0 = tap.current;
    tap.current = null;
    if (!t0 || t0.moved >= 8 || e.type !== 'pointerup') return;
    if (t0.place) {
      lastTap.current = null;
      onPlaceRef.current(t0.place);
      return;
    }
    // Toque duplo (ou clique duplo) amplia no ponto tocado.
    const now = performance.now();
    const last = lastTap.current;
    if (last && now - last.time < 320 && distance(p, [last.x, last.y]) < 30) {
      lastTap.current = null;
      setView(zoomAt(view.current, p[0], p[1], 1.8, size.current.w, size.current.h));
    } else {
      lastTap.current = { x: p[0], y: p[1], time: now };
    }
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget || e.altKey || e.ctrlKey || e.metaKey) return;
    switch (e.key) {
      case 'ArrowLeft':
        pan(PAN_STEP, 0);
        break;
      case 'ArrowRight':
        pan(-PAN_STEP, 0);
        break;
      case 'ArrowUp':
        pan(0, PAN_STEP);
        break;
      case 'ArrowDown':
        pan(0, -PAN_STEP);
        break;
      case '+':
      case '=':
        zoom(1.3);
        break;
      case '-':
      case '_':
        zoom(0.77);
        break;
      case '0':
        reset();
        break;
      default:
        return;
    }
    e.preventDefault();
  };

  const overlay = 'h-10 w-10 bg-surface/90 shadow ring-1 ring-outline/40 backdrop-blur-sm hover:bg-surface';
  return (
    <div
      ref={container}
      tabIndex={0}
      role="region"
      aria-label={tr('Mapa', 'Map', 'Mapa')}
      aria-describedby={helpId}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onKeyDown={onKeyDown}
      className="relative min-h-[180px] flex-[11_1_0%] select-none overflow-hidden focus-visible:[outline-offset:-3px] md:flex-[1_1_0%]"
      style={{ touchAction: 'none', background: palette.outside, cursor: 'grab' }}
    >
      <p id={helpId} className="sr-only">
        {tr(
          'Arraste para mover; use a roda do mouse, dois dedos ou toque duplo para ampliar. Com o mapa em foco, as setas movem, + e − ampliam ou reduzem e 0 redefine. A lista de lugares abaixo traz os mesmos dados.',
          'Drag to move; use the mouse wheel, two fingers or a double tap to zoom. With the map focused, arrow keys move, + and − zoom and 0 resets. The list of places below has the same data.',
          'Arrastre para mover; use la rueda del ratón, dos dedos o un doble toque para ampliar. Con el mapa enfocado, las flechas mueven, + y − amplían o reducen y 0 restablece. La lista de lugares de abajo contiene los mismos datos.',
        )}
      </p>
      <svg width="100%" height="100%" aria-hidden="true" className="absolute inset-0 block" style={{ fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' }}>
        <g ref={group}>
          <LandLayer d={geometry.d} palette={palette} clipId={clipId} />
          {routeD && (
            <path
              d={routeD}
              fill="none"
              stroke={palette.route}
              strokeWidth={3}
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          )}
          <Markers
            locations={locations}
            modern={modern}
            focus={focus}
            selected={selected}
            routePlaces={routePlaces}
            palette={palette}
            labelScale={labelScale}
          />
        </g>
      </svg>
      <div className="absolute right-2 top-2 flex flex-col gap-2">
        <IconButton label={t('zoomIn')} icon={Plus} size={20} className={overlay} onClick={() => zoom(1.3)} />
        <IconButton label={t('zoomOut')} icon={Minus} size={20} className={overlay} onClick={() => zoom(0.77)} />
        <IconButton label={t('reset')} icon={RotateCcw} size={19} className={overlay} onClick={reset} />
      </div>
      <div className="absolute bottom-2 left-2 grid grid-cols-3 gap-0.5">
        <span />
        <IconButton label={tr('Mover norte', 'Move north', 'Mover al norte')} icon={ArrowUp} size={18} className={cx(overlay, '!h-9 !w-9')} onClick={() => pan(0, PAN_STEP)} />
        <span />
        <IconButton label={tr('Mover oeste', 'Move west', 'Mover al oeste')} icon={ArrowLeft} size={18} className={cx(overlay, '!h-9 !w-9')} onClick={() => pan(PAN_STEP, 0)} />
        <span />
        <IconButton label={tr('Mover leste', 'Move east', 'Mover al este')} icon={ArrowRight} size={18} className={cx(overlay, '!h-9 !w-9')} onClick={() => pan(-PAN_STEP, 0)} />
        <span />
        <IconButton label={tr('Mover sul', 'Move south', 'Mover al sur')} icon={ArrowDown} size={18} className={cx(overlay, '!h-9 !w-9')} onClick={() => pan(0, -PAN_STEP)} />
        <span />
      </div>
    </div>
  );
});

/** Mar + terra: estático, só muda com o tema. */
const LandLayer = memo(function LandLayer({ d, palette, clipId }: { d: string; palette: MapPalette; clipId: string }) {
  return (
    <>
      <defs>
        <clipPath id={clipId}>
          <rect width={MAP_W} height={MAP_H} />
        </clipPath>
      </defs>
      <rect width={MAP_W} height={MAP_H} fill={palette.sea} />
      {d && (
        <path
          d={d}
          fill={palette.land}
          stroke={palette.coast}
          strokeWidth={0.8}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          clipPath={`url(#${clipId})`}
        />
      )}
    </>
  );
});

/**
 * Marcadores e rótulos com tamanho constante na tela (escala inversa via
 * --inv). Os rótulos visíveis são recalculados só quando o zoom assenta.
 */
const Markers = memo(function Markers({
  locations,
  modern,
  focus,
  selected,
  routePlaces,
  palette,
  labelScale,
}: {
  locations: ContextLocation[];
  modern: boolean;
  focus?: string;
  selected: string | null;
  routePlaces: Set<string>;
  palette: MapPalette;
  labelScale: number;
}) {
  const placed = useMemo(
    () =>
      locations.map((l) => {
        const [x, y] = project(Number(l.lon), Number(l.lat));
        return { l, x, y };
      }),
    [locations],
  );
  const hot = (id: string) => id === focus || id === selected;
  const ordered = useMemo(() => {
    const rank = (id: string) => (id === focus || id === selected ? 0 : routePlaces.has(id) ? 1 : 2);
    return placed.map((p, i) => ({ ...p, rank: rank(p.l.id), i })).sort((a, b) => a.rank - b.rank || a.i - b.i);
  }, [placed, focus, selected, routePlaces]);
  const visible = useMemo(
    () => declutter(ordered.map((p) => ({ id: p.l.id, x: p.x, y: p.y, text: String((modern ? p.l.modern : p.l.ancient) ?? '') })), labelScale),
    [ordered, modern, labelScale],
  );
  // Desenha na ordem inversa da prioridade: o foco fica por cima.
  const drawn = useMemo(() => [...ordered].reverse(), [ordered]);
  return (
    <g>
      {drawn.map(({ l, x, y }) => {
        const strong = hot(l.id);
        const name = String((modern ? l.modern : l.ancient) ?? '');
        return (
          <g key={l.id} transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`} data-place={l.id} style={{ cursor: 'pointer' }}>
            <title>{`${l.ancient} / ${l.modern}`}</title>
            <g style={{ transform: 'scale(var(--inv, 1))', transformOrigin: '0 0' }}>
              <circle r={12} fill="transparent" />
              <circle r={strong ? 7 : 4} fill={strong ? palette.focus : palette.marker} stroke={palette.halo} strokeWidth={strong ? 2 : 1} />
              {visible.has(l.id) && (
                <text
                  x={LABEL_DX}
                  y={LABEL_DY}
                  fontSize={LABEL_SIZE}
                  fontWeight={strong ? 600 : 400}
                  fill={palette.label}
                  stroke={palette.halo}
                  strokeWidth={3}
                  strokeLinejoin="round"
                  paintOrder="stroke"
                >
                  {name}
                </text>
              )}
            </g>
          </g>
        );
      })}
    </g>
  );
});

// ---------------------------------------------------------------- PlacePage
export function PlacePage({ id }: { id: string }) {
  useApp();
  const language = lang();
  const state = useAsync(loadContext, []);
  return (
    <div className="mx-auto max-w-3xl p-[22px]">
      <Async state={state}>
        {(data) => {
          const l = data.locations.find((x) => x.id === id);
          if (!l) return <p className="text-[15px]">{t('noContent')}</p>;
          const events = data.events.filter((e) => e.location === id);
          return (
            <>
              <p className="text-sm text-muted">
                {l.modern} · {l.lat}, {l.lon}
              </p>
              <p className="mt-3 select-text whitespace-pre-line text-[15.5px] leading-relaxed">{`${l.source ?? ''}\n${l.uncertainty ?? ''}`}</p>
              <div className="-ml-3 mt-3">
                <Action label={t('note')} icon={NotebookPen} onClick={() => void openNewNote({ title: l.ancient, reference: `place:${l.id}` })} />
              </div>
              {events.length > 0 && (
                <section className="mt-5">
                  <h3 className="text-[17px] font-semibold">{tr('Acontecimentos associados', 'Associated events', 'Acontecimientos asociados')}</h3>
                  <ul className="mt-2 space-y-3">
                    {events.map((e) => {
                      const refs = (e.references ?? []).map((r) => fromId(String(r))).filter((r): r is Ref => r !== null);
                      return (
                        <li key={e.id} className="rounded-xl bg-surface-low p-3 ring-1 ring-outline/30">
                          <p className="text-[15.5px] font-medium">{e.title}</p>
                          <p className="text-sm text-muted">{eventDates(e, language)}</p>
                          {refs.length > 0 && (
                            <div className="-ml-3 mt-1 flex flex-wrap gap-1">
                              {refs.map((r) => (
                                <Action key={refId(r)} label={refLabel(r, language)} icon={BookOpen} onClick={() => showPassage(r, { sourceEdition: 'BLN4' })} />
                              ))}
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </section>
              )}
            </>
          );
        }}
      </Async>
    </div>
  );
}
