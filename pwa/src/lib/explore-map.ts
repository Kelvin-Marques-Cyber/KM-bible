// Geometria e navegação do mapa offline (MapPainter + InteractiveViewer de
// lib/explore.dart), em funções puras: projeção, recorte da costa, rotas,
// limites de deslocamento/zoom e escolha de rótulos sem sobreposição.

/** Tamanho lógico do mapa no original: Size(1200, 680). */
export const MAP_W = 1200;
export const MAP_H = 680;
export const MAX_SCALE = 16;
/** Centro padrão (Mediterrâneo oriental) quando não há local em foco. */
export const DEFAULT_CENTER = { lon: 33, lat: 34 };

export type Point = [number, number];

/** Projeção equiretangular do original: x=(lon+20)/100·W, y=(65−lat)/55·H. */
export function project(lon: number, lat: number): Point {
  return [((lon + 20) / 100) * MAP_W, ((65 - lat) / 55) * MAP_H];
}

/** Recorte de Sutherland–Hodgman de um polígono por um retângulo. */
export function clipPolygon(points: Point[], x0: number, y0: number, x1: number, y1: number): Point[] {
  const edges: [(p: Point) => boolean, (a: Point, b: Point) => Point][] = [
    [(p) => p[0] >= x0, (a, b) => [x0, a[1] + ((x0 - a[0]) / (b[0] - a[0])) * (b[1] - a[1])]],
    [(p) => p[0] <= x1, (a, b) => [x1, a[1] + ((x1 - a[0]) / (b[0] - a[0])) * (b[1] - a[1])]],
    [(p) => p[1] >= y0, (a, b) => [a[0] + ((y0 - a[1]) / (b[1] - a[1])) * (b[0] - a[0]), y0]],
    [(p) => p[1] <= y1, (a, b) => [a[0] + ((y1 - a[1]) / (b[1] - a[1])) * (b[0] - a[0]), y1]],
  ];
  let out = points;
  for (const [inside, cross] of edges) {
    const input = out;
    out = [];
    if (input.length === 0) break;
    let prev = input[input.length - 1];
    for (const cur of input) {
      const curIn = inside(cur);
      if (curIn) {
        if (!inside(prev)) out.push(cross(prev, cur));
        out.push(cur);
      } else if (inside(prev)) {
        out.push(cross(prev, cur));
      }
      prev = cur;
    }
  }
  return out;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export interface LandGeometry {
  /** Um único atributo "d" com todos os polígonos (um só elemento SVG). */
  d: string;
  polygons: number;
  points: number;
}

const landCache = new WeakMap<object, LandGeometry>();

/**
 * Converte land.json (lista de anéis [lon, lat]) em um único caminho SVG,
 * descartando polígonos fora da área do mapa e recortando os que a cruzam
 * (com margem; o resto é cortado por clipPath). Resultado em cache por arquivo.
 */
export function landGeometry(polygons: unknown, margin = 6): LandGeometry {
  if (polygons && typeof polygons === 'object') {
    const cached = landCache.get(polygons as object);
    if (cached) return cached;
  }
  const x0 = -margin, y0 = -margin, x1 = MAP_W + margin, y1 = MAP_H + margin;
  let d = '';
  let count = 0;
  let points = 0;
  for (const ring of Array.isArray(polygons) ? polygons : []) {
    if (!Array.isArray(ring) || ring.length < 3) continue;
    const projected: Point[] = [];
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of ring) {
      if (!Array.isArray(p) || typeof p[0] !== 'number' || typeof p[1] !== 'number') continue;
      const q = project(p[0], p[1]);
      projected.push(q);
      if (q[0] < minX) minX = q[0];
      if (q[0] > maxX) maxX = q[0];
      if (q[1] < minY) minY = q[1];
      if (q[1] > maxY) maxY = q[1];
    }
    if (projected.length < 3 || maxX < x0 || minX > x1 || maxY < y0 || minY > y1) continue;
    const inside = minX >= x0 && maxX <= x1 && minY >= y0 && maxY <= y1;
    const clipped = inside ? projected : clipPolygon(projected, x0, y0, x1, y1);
    const parts: string[] = [];
    let last = '';
    for (const [x, y] of clipped) {
      const s = `${round1(x)},${round1(y)}`;
      if (s !== last) parts.push(s);
      last = s;
    }
    if (parts.length > 1 && parts[parts.length - 1] === parts[0]) parts.pop();
    if (parts.length < 3) continue;
    d += `M${parts.join(' ')}Z`;
    count++;
    points += parts.length;
  }
  const result = { d, polygons: count, points };
  if (polygons && typeof polygons === 'object') landCache.set(polygons as object, result);
  return result;
}

/** Linha de rota: sequência de lugares por id (lugares ausentes são ignorados). */
export function routePath(places: string[], locations: { id: string; lon: number; lat: number }[]): string {
  const byId = new Map(locations.map((l) => [l.id, l]));
  const parts: string[] = [];
  for (const id of places ?? []) {
    const l = byId.get(id);
    if (!l || !Number.isFinite(l.lon) || !Number.isFinite(l.lat)) continue;
    const [x, y] = project(l.lon, l.lat);
    parts.push(`${round1(x)},${round1(y)}`);
  }
  return parts.length < 2 ? '' : `M${parts.join(' L')}`;
}

// ------------------------------------------------------------- navegação
/** Translação (px de tela) e escala aplicadas ao grupo do mapa. */
export interface View {
  x: number;
  y: number;
  s: number;
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Escala mínima: a do original (0,6) ou o mapa inteiro visível, se menor. */
export const minScale = (vw: number, vh: number) => Math.min(0.6, vw / MAP_W, vh / MAP_H);

/** Limites do InteractiveViewer: o mapa cobre a área visível; se menor, fica centralizado. */
export function clampView(v: View, vw: number, vh: number): View {
  if (!(vw > 0) || !(vh > 0)) return v;
  const s = clamp(Number.isFinite(v.s) ? v.s : 1, minScale(vw, vh), MAX_SCALE);
  const cw = MAP_W * s, ch = MAP_H * s;
  const x = cw <= vw ? (vw - cw) / 2 : clamp(v.x, vw - cw, 0);
  const y = ch <= vh ? (vh - ch) / 2 : clamp(v.y, vh - ch, 0);
  return { x, y, s };
}

/** Amplia/reduz mantendo fixo o ponto (px, py) da tela. */
export function zoomAt(v: View, px: number, py: number, factor: number, vw: number, vh: number): View {
  const s = clamp(v.s * factor, minScale(vw, vh), MAX_SCALE);
  const mx = (px - v.x) / v.s, my = (py - v.y) / v.s;
  return clampView({ x: px - mx * s, y: py - my * s, s }, vw, vh);
}

/** Gesto de pinça: escala pela razão das distâncias e acompanha o ponto médio. */
export function pinchView(start: View, mid0: Point, dist0: number, mid: Point, dist: number, vw: number, vh: number): View {
  const s = clamp(start.s * (dist0 > 0 ? dist / dist0 : 1), minScale(vw, vh), MAX_SCALE);
  const mx = (mid0[0] - start.x) / start.s, my = (mid0[1] - start.y) / start.s;
  return clampView({ x: mid[0] - mx * s, y: mid[1] - my * s, s }, vw, vh);
}

/** Centraliza um ponto do mapa (coordenadas 1200×680) com a escala dada. */
export const centerOn = (mx: number, my: number, s: number, vw: number, vh: number): View =>
  clampView({ x: vw / 2 - mx * s, y: vh / 2 - my * s, s }, vw, vh);

/** Enquadra pontos do mapa (ex.: lugares de uma rota) com margem. */
export function fitPoints(points: Point[], vw: number, vh: number, padding = 40, maxScale = 4): View | null {
  if (points.length === 0 || !(vw > 0) || !(vh > 0)) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of points) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  const pad = Math.min(padding, vw / 4, vh / 4);
  const s = Math.min((vw - 2 * pad) / Math.max(maxX - minX, 1), (vh - 2 * pad) / Math.max(maxY - minY, 1), maxScale);
  return centerOn((minX + maxX) / 2, (minY + maxY) / 2, s, vw, vh);
}

// --------------------------------------------------------------- rótulos
export const LABEL_SIZE = 11;
export const LABEL_DX = 5;
export const LABEL_DY = -4;
/** Largura aproximada do rótulo (fonte sem serifa de 11 px). */
export const labelWidth = (text: string) => text.length * 6.2 + 4;

export interface LabelCandidate {
  id: string;
  /** Posição do marcador no mapa (1200×680). */
  x: number;
  y: number;
  text: string;
}

/**
 * Rótulos com tamanho constante na tela: escolhe, em ordem de prioridade
 * (a lista já vem ordenada), os que não se sobrepõem na escala s.
 * Grade espacial: custo linear mesmo com centenas de lugares importados.
 */
export function declutter(items: LabelCandidate[], s: number): Set<string> {
  const visible = new Set<string>();
  const cell = 96;
  const grid = new Map<string, [number, number, number, number][]>();
  for (const item of items) {
    if (!item.text) continue;
    const x0 = item.x * s + LABEL_DX - 1;
    const y0 = item.y * s + LABEL_DY - LABEL_SIZE - 1;
    const x1 = x0 + labelWidth(item.text);
    const y1 = y0 + LABEL_SIZE + 4;
    const cx0 = Math.floor(x0 / cell), cx1 = Math.floor(x1 / cell);
    const cy0 = Math.floor(y0 / cell), cy1 = Math.floor(y1 / cell);
    let free = true;
    for (let cx = cx0; cx <= cx1 && free; cx++) {
      for (let cy = cy0; cy <= cy1 && free; cy++) {
        for (const b of grid.get(`${cx}:${cy}`) ?? []) {
          if (x0 < b[2] && x1 > b[0] && y0 < b[3] && y1 > b[1]) {
            free = false;
            break;
          }
        }
      }
    }
    if (!free) continue;
    const box: [number, number, number, number] = [x0, y0, x1, y1];
    for (let cx = cx0; cx <= cx1; cx++) {
      for (let cy = cy0; cy <= cy1; cy++) {
        const key = `${cx}:${cy}`;
        const list = grid.get(key);
        if (list) list.push(box);
        else grid.set(key, [box]);
      }
    }
    visible.add(item.id);
  }
  return visible;
}

// ------------------------------------------------------------------ cores
export interface MapPalette {
  sea: string;
  land: string;
  coast: string;
  route: string;
  marker: string;
  focus: string;
  label: string;
  halo: string;
  outside: string;
}

/** Cores do MapPainter no tema claro; variantes harmonizadas para temas escuros e alto contraste. */
export function mapPalette(dark: boolean, highContrast = false): MapPalette {
  if (!dark) {
    return {
      sea: '#d8e5e7',
      land: '#ded4b8',
      coast: highContrast ? '#5d634c' : '#9fa58c',
      route: '#a85942',
      marker: '#304b3b',
      focus: '#c54131',
      label: highContrast ? '#000000' : '#23342c',
      halo: highContrast ? 'rgba(255,255,255,0.95)' : 'rgba(237,235,221,0.85)',
      outside: '#c9d3d4',
    };
  }
  return {
    sea: '#172832',
    land: '#3a3a2f',
    coast: highContrast ? '#a7ad92' : '#6f745f',
    route: '#ec9474',
    marker: '#a8d5b9',
    focus: '#ff7a6b',
    label: highContrast ? '#ffffff' : '#ece7d8',
    halo: highContrast ? 'rgba(0,0,0,0.95)' : 'rgba(14,20,24,0.85)',
    outside: '#0f1a20',
  };
}
