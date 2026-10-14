// Lógica pura do grafo de estudos (port de lib/graph.dart): coleta dos nós,
// filtro por tipo/densidade, layout radial, campo de estrelas determinístico,
// limites dos rótulos, teste de toque e matemática de zoom/enquadramento.
// Sem React: tudo aqui é testável em tests/unit/models-graph.test.ts.
import { eventsAt, type ContextData, type CrossRef, type Topic } from './content';
import { fromId, refId, refLabel, type Ref } from './domain';
import { lang, tr } from './i18n';
import type { Note } from './store';

export type RelationKind = 'editorial' | 'textual' | 'theological' | 'personal' | 'history' | 'place' | 'topic';
export const RELATION_KINDS: RelationKind[] = ['editorial', 'textual', 'theological', 'personal', 'history', 'place', 'topic'];

/** relationLabels do original (pt) com equivalentes en/es. */
export function relationLabel(kind: string): string {
  switch (kind) {
    case 'editorial':
      return tr('Referência editorial', 'Editorial reference', 'Referencia editorial');
    case 'textual':
      return tr('Citação textual', 'Textual quotation', 'Cita textual');
    case 'theological':
      return tr('Interpretação teológica', 'Theological interpretation', 'Interpretación teológica');
    case 'personal':
      return tr('Anotação pessoal', 'Personal note', 'Anotación personal');
    case 'history':
      return tr('Acontecimento', 'Event', 'Acontecimiento');
    case 'place':
      return tr('Lugar', 'Place', 'Lugar');
    case 'topic':
      return tr('Tema editorial', 'Editorial topic', 'Tema editorial');
    default:
      return kind;
  }
}

export interface GraphNode {
  id: string;
  title: string;
  kind: string;
  description: string;
  reference?: Ref;
}

export interface Relation {
  from: string;
  to: string;
  kind: string;
  description: string;
}

export interface GraphSources {
  root: Ref;
  topics: Topic[];
  xrefs: CrossRef[];
  curated: Relation[];
  notes: Note[];
  context: ContextData | null;
  language?: string;
}

/**
 * Todos os vizinhos candidatos, na ordem de inserção do Map do original
 * (temas → referências → relações curadas → notas → acontecimentos/lugares).
 * Uma chave repetida mantém a posição original e atualiza o conteúdo.
 */
export function collectNodes(src: GraphSources): GraphNode[] {
  const language = src.language ?? lang();
  const r = src.root;
  const rootId = refId(r);
  const nodes = new Map<string, GraphNode>();
  for (const theme of src.topics) {
    const id = `topic:${theme.id}`;
    nodes.set(id, {
      id,
      title: theme.title,
      kind: 'topic',
      description: tr(
        'Tema associado pelo índice histórico de R. A. Torrey. Expanda para explorar suas passagens.',
        "Topic associated by R. A. Torrey's historical index. Expand it to explore its passages.",
        'Tema asociado por el índice histórico de R. A. Torrey. Amplíelo para explorar sus pasajes.',
      ),
    });
  }
  for (const edge of src.xrefs) {
    const target = fromId(edge.target);
    if (!target) continue;
    const end = fromId(edge.end_reference) ?? target;
    const id = refId(target);
    const chapter =
      edge.scope === 'chapter'
        ? `${tr(
            'Relação do capítulo; não é associação específica deste versículo.',
            'Chapter-level relation; not a specific association of this verse.',
            'Relación del capítulo; no es una asociación específica de este versículo.',
          )}\n`
        : '';
    const range =
      refId(end) !== id ? `${tr('Intervalo até', 'Range up to', 'Intervalo hasta')} ${refLabel(end, language)}. ` : '';
    nodes.set(id, {
      id,
      title: refLabel(target, language),
      kind: 'editorial',
      description: `${chapter}${tr('Fonte', 'Source', 'Fuente')}: ${edge.provenance}. ${range}${tr(
        'Leia as duas passagens no contexto.',
        'Read both passages in context.',
        'Lea ambos pasajes en su contexto.',
      )}`,
      reference: target,
    });
  }
  for (const edge of src.curated) {
    const other = edge.from === rootId ? edge.to : edge.to === rootId ? edge.from : null;
    const target = other === null ? null : fromId(String(other));
    if (!target) continue;
    const id = refId(target);
    nodes.set(id, { id, title: refLabel(target, language), kind: edge.kind, description: edge.description, reference: target });
  }
  for (const note of src.notes) {
    nodes.set(note.id, {
      id: note.id,
      title: note.title || tr('Anotação sem título', 'Untitled note', 'Anotación sin título'),
      kind: 'personal',
      description: tr(
        'Nota vinculada ou com referência à passagem.',
        'Note linked to or referencing the passage.',
        'Nota vinculada o con referencia al pasaje.',
      ),
    });
  }
  if (src.context) {
    for (const event of eventsAt(src.context, r)) {
      const id = `event:${event.id}`;
      nodes.set(id, {
        id,
        title: event.title,
        kind: 'history',
        description: `${event.description}\n${event.certainty} — ${tr('associação pela perícope.', 'association by pericope.', 'asociación por la perícopa.')}`,
      });
      const place = src.context.locations.find((p) => p.id === event.location);
      if (place) {
        const placeId = `place:${place.id}`;
        nodes.set(placeId, { id: placeId, title: place.ancient, kind: 'place', description: String(place.uncertainty ?? '') });
      }
    }
  }
  return [...nodes.values()];
}

/** neighbors() do original: remove a raiz, filtra o tipo, editoriais por último, corta na densidade. */
export function selectNodes(all: GraphNode[], rootId: string, kind: string, density: number): GraphNode[] {
  const values = all.filter((n) => n.id !== rootId && (kind === 'all' || n.kind === kind));
  // Ligações pessoais e curadas continuam visíveis ao lado das referências (sort estável).
  values.sort((a, b) => (a.kind === 'editorial' ? 1 : 0) - (b.kind === 'editorial' ? 1 : 0));
  return values.slice(0, density);
}

/** Expansão de um tema: passagens do índice de Torrey como nós editoriais. */
export function topicNodes(references: string[], kind: string, density: number, language = lang()): GraphNode[] {
  if (kind !== 'all' && kind !== 'editorial') return [];
  const out: GraphNode[] = [];
  for (const id of references) {
    if (out.length >= density) break;
    const r = fromId(id);
    if (!r) continue;
    out.push({
      id: refId(r),
      title: refLabel(r, language),
      kind: 'editorial',
      description: tr(
        'Passagem associada ao tema no índice histórico de Torrey; relação editorial, não equivalência exegética.',
        "Passage associated with the topic in Torrey's historical index; an editorial relation, not exegetical equivalence.",
        'Pasaje asociado al tema en el índice histórico de Torrey; relación editorial, no equivalencia exegética.',
      ),
      reference: r,
    });
  }
  return out;
}

// ------------------------------------------------------------------ layout
export interface Point {
  x: number;
  y: number;
}
export interface Size {
  width: number;
  height: number;
}
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Cena consistente: 8 nós no primeiro anel e até 12 no segundo. */
export const sceneSize = (count: number): Size => (count <= 8 ? { width: 730, height: 670 } : { width: 900, height: 830 });

export function radialLayout(nodes: { id: string }[], centerId: string, scene: Size): Map<string, Point> {
  const center = { x: scene.width / 2, y: scene.height / 2 };
  const positions = new Map<string, Point>([[centerId, center]]);
  const n = nodes.length;
  for (let i = 0; i < n; i++) {
    const outer = i >= 8;
    const index = outer ? i - 8 : i;
    const count = outer ? n - 8 : Math.min(n, 8);
    const angle = -Math.PI / 2 + (2 * Math.PI * index) / count + (outer ? Math.PI / count : 0);
    const radius = outer ? 295 : n <= 8 ? 208 : 175;
    positions.set(nodes[i].id, { x: center.x + radius * Math.cos(angle), y: center.y + radius * Math.sin(angle) });
  }
  return positions;
}

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), Math.max(min, max));

export const LABEL_WIDTH = 138;
export const LABEL_HEIGHT = 44;

/** StudyGraphPainter.labelBounds: compartilhado pela pintura e pelo toque. */
export function labelBounds(p: Point, center: Point, scene: Size): Rect {
  const right = p.x >= center.x;
  const x = clamp(right ? p.x + 13 : p.x - LABEL_WIDTH - 13, 8, scene.width - LABEL_WIDTH - 8);
  const y = clamp(p.y - 22, 8, scene.height - 48);
  return { x, y, width: LABEL_WIDTH, height: LABEL_HEIGHT };
}

/** Rótulo central: 162 × 43, centrado 47 px acima do centro. */
export const centerLabelBounds = (center: Point): Rect => ({ x: center.x - 81, y: center.y - 47 - 21.5, width: 162, height: 43 });

const inside = (r: Rect, p: Point, inflate = 0) =>
  p.x >= r.x - inflate && p.x <= r.x + r.width + inflate && p.y >= r.y - inflate && p.y <= r.y + r.height + inflate;

/** Teste de toque do original: nós desenhados por último têm prioridade. */
export function hitTest(nodes: GraphNode[], positions: Map<string, Point>, center: Point, scene: Size, point: Point): GraphNode | null {
  for (let i = nodes.length - 1; i >= 0; i--) {
    const p = positions.get(nodes[i].id);
    if (!p) continue;
    if (Math.hypot(p.x - point.x, p.y - point.y) <= 30 || inside(labelBounds(p, center, scene), point, 13)) return nodes[i];
  }
  return null;
}

/** Gerador determinístico (mulberry32): mesma semente, mesmo céu, sem timers. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Star {
  x: number;
  y: number;
  r: number;
  alpha: number;
}
export function starField(scene: Size, seed = 1729, count = 115): Star[] {
  const random = seededRandom(seed);
  const stars: Star[] = [];
  for (let i = 0; i < count; i++) {
    const x = random() * scene.width;
    const y = random() * scene.height;
    stars.push({ x, y, r: i % 9 === 0 ? 1.5 : 0.7, alpha: 0.1 + 0.15 * random() });
  }
  return stars;
}

// ------------------------------------------------------------- zoom e pan
export interface View {
  scale: number;
  x: number;
  y: number;
}
export const MIN_SCALE = 0.2;
export const MAX_SCALE = 4.5;
export const BOUNDARY_MARGIN = 900;

export function fitView(viewport: Size, scene: Size): View {
  if (!viewport.width || !viewport.height || !scene.width || !scene.height) return { scale: 1, x: 0, y: 0 };
  const scale = Math.min(viewport.width / scene.width, viewport.height / scene.height) * 0.94;
  return { scale, x: (viewport.width - scene.width * scale) / 2, y: (viewport.height - scene.height * scale) / 2 };
}

/** Zoom ao redor de um pivô (centro do quadro por padrão), limitado a 0,2–4,5. */
export function zoomView(view: View, factor: number, viewport: Size, pivot: Point = { x: viewport.width / 2, y: viewport.height / 2 }): View {
  if (view.scale <= 0 || !viewport.width) return view;
  const scale = clamp(view.scale * factor, MIN_SCALE, MAX_SCALE);
  const ratio = scale / view.scale;
  return { scale, x: pivot.x - (pivot.x - view.x) * ratio, y: pivot.y - (pivot.y - view.y) * ratio };
}

/** Mantém o quadro dentro da cena ampliada pela margem (boundaryMargin do InteractiveViewer). */
export function clampView(view: View, viewport: Size, scene: Size, margin = BOUNDARY_MARGIN): View {
  const axis = (offset: number, port: number, length: number) => {
    const span = (length + 2 * margin) * view.scale;
    if (span <= port) return (port - length * view.scale) / 2;
    return clamp(offset, port - (length + margin) * view.scale, margin * view.scale);
  };
  return { scale: view.scale, x: axis(view.x, viewport.width, scene.width), y: axis(view.y, viewport.height, scene.height) };
}

export const toScene = (view: View, p: Point): Point => ({ x: (p.x - view.x) / view.scale, y: (p.y - view.y) / view.scale });
export const viewTransform = (view: View) => `translate(${view.x.toFixed(2)} ${view.y.toFixed(2)}) scale(${view.scale.toFixed(4)})`;

/** Altura do quadro do original: entre 390 e 550 px, 56% da tela. */
export const viewportHeight = (screenHeight: number) => Math.min(550, Math.max(390, screenHeight * 0.56));

// ------------------------------------------------------------------ rótulos
/** Quebra em até `maxLines` linhas com reticências, como TextPainter(maxLines: 2, ellipsis: '…'). */
export function wrapLabel(text: string, maxWidth: number, measure: (s: string) => number, maxLines = 2): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (let i = 0; i < words.length; i++) {
    let word = words[i];
    const candidate = current ? `${current} ${word}` : word;
    if (measure(candidate) <= maxWidth) {
      current = candidate;
      continue;
    }
    if (current) {
      lines.push(current);
      current = '';
    }
    // Palavra maior que a linha: quebra por caracteres.
    while (measure(word) > maxWidth && word.length > 1) {
      let cut = word.length - 1;
      while (cut > 1 && measure(word.slice(0, cut)) > maxWidth) cut--;
      lines.push(word.slice(0, cut));
      word = word.slice(cut);
    }
    current = word;
  }
  if (current) lines.push(current);
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines - 1);
  let last = lines.slice(maxLines - 1).join(' ');
  while (last.length > 0 && measure(`${last}…`) > maxWidth) last = last.slice(0, -1);
  kept.push(`${last.trimEnd()}…`);
  return kept;
}

const measurers = new Map<string, (s: string) => number>();
/** Mede texto com canvas (OffscreenCanvas quando houver); estimativa sem canvas. */
export function textMeasurer(fontSize: number, weight: number): (s: string) => number {
  const key = `${weight}:${fontSize}`;
  const cached = measurers.get(key);
  if (cached) return cached;
  let measure = (s: string) => s.length * fontSize * 0.54;
  try {
    let ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null = null;
    if (typeof OffscreenCanvas !== 'undefined') ctx = new OffscreenCanvas(1, 1).getContext('2d');
    else if (typeof document !== 'undefined' && !/jsdom/i.test(navigator.userAgent)) ctx = document.createElement('canvas').getContext('2d');
    if (ctx) {
      const family = (typeof document !== 'undefined' && getComputedStyle(document.body).fontFamily) || 'system-ui, sans-serif';
      ctx.font = `${weight} ${fontSize}px ${family}`;
      const c = ctx;
      measure = (s: string) => c.measureText(s).width;
    }
  } catch {
    /* estimativa */
  }
  measurers.set(key, measure);
  return measure;
}
