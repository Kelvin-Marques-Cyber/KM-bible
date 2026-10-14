// Lógica pura das telas de lib/explore.dart (linha do tempo, comparação de
// contexto e medidas). Sem React e sem acesso a rede: testável isoladamente.
import type { ContextData, ContextEvent, ContextLocation } from './content';
import { fold, geographicDistance, historicalInterval, type Lang } from './domain';

const pick = (language: Lang, pt: string, en: string, es: string) => (language === 'en' ? en : language === 'es' ? es : pt);
const locale = (language: Lang) => (language === 'en' ? 'en-US' : language === 'es' ? 'es-ES' : 'pt-BR');

// ------------------------------------------------------------------ datas
/** yearLabel() do original, com os rótulos de era no idioma da interface. */
export function yearText(year: number | null | undefined, language: Lang = 'pt'): string {
  if (year === null || year === undefined) return pick(language, 'Data não estabelecida', 'Date not established', 'Fecha no establecida');
  return year < 0 ? `${-year} ${pick(language, 'a.C.', 'BC', 'a. C.')}` : `${year} ${pick(language, 'd.C.', 'AD', 'd. C.')}`;
}

/** "início — fim · certeza", como no cartão da TimelinePage. */
export function eventDates(e: Pick<ContextEvent, 'start' | 'end' | 'certainty'>, language: Lang = 'pt'): string {
  const start = e.start ?? null;
  const end = e.end ?? null;
  return `${yearText(start, language)}${end !== start ? ` — ${yearText(end, language)}` : ''} · ${e.certainty}`;
}

export const alternativeLine = (alt: { label: string; start: number | null; end: number | null }, language: Lang = 'pt') =>
  `• ${alt.label}: ${yearText(alt.start, language)} — ${yearText(alt.end, language)}`;

// ---------------------------------------------------------------- fontes
export type Source = string | { title: string; url: string };
/** Texto copiado por sourceLinks(): mapas viram "título\nurl". */
export const sourceLabel = (s: Source) => (typeof s === 'string' ? s : `${s?.title ?? ''}\n${s?.url ?? ''}`);
export const sourceUrl = (s: Source): string | null => (typeof s === 'string' ? /https?:\/\/[^\s)]+/.exec(s)?.[0] ?? null : s?.url || null);

// ---------------------------------------------------------- linha do tempo
const folded = new WeakMap<ContextEvent, string>();
const haystack = (e: ContextEvent) => {
  let text = folded.get(e);
  if (text === undefined) {
    text = fold(`${e.title ?? ''} ${e.description ?? ''}`);
    folded.set(e, text);
  }
  return text;
};

/** Filtro e ordem da TimelinePage: paralelos opcionais, busca sem acentos, início nulo = -99999. */
export function timelineRows(events: ContextEvent[], world: boolean, query: string): ContextEvent[] {
  const q = fold(query);
  return events
    .filter((e) => (world || e.world !== true) && (!q || haystack(e).includes(q)))
    .sort((a, b) => (a.start ?? -99999) - (b.start ?? -99999));
}

/** Acontecimentos que podem servir de atalho na comparação (não paralelos, com referência). */
export const comparableEvents = (data: ContextData) => data.events.filter((e) => e.world !== true && (e.references ?? []).length > 0);

// ------------------------------------------------------ comparar contexto
export interface ComparisonResult {
  text: string;
  /** Os dois acontecimentos comparados (vazio quando os dados são insuficientes). */
  chosen: ContextEvent[];
}

const insufficient = (language: Lang) =>
  pick(
    language,
    'Não há dados suficientes para um cálculo confiável.',
    'Insufficient data for a reliable calculation.',
    'No hay datos suficientes para un cálculo fiable.',
  );

export function formatNumber(value: number, digits: number, language: Lang = 'pt'): string {
  return new Intl.NumberFormat(locale(language), { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
}

/**
 * compare() da ContextComparisonPage: usa o primeiro acontecimento de cada
 * passagem; tempo (sem ano zero), distância em linha reta e ressalvas.
 */
export function compareContext(
  data: Pick<ContextData, 'locations'>,
  first: ContextEvent[],
  second: ContextEvent[],
  language: Lang = 'pt',
): ComparisonResult {
  if (first.length === 0 || second.length === 0) return { text: insufficient(language), chosen: [] };
  const e = first[0];
  const f = second[0];
  const lines: string[] = [`${e.title} ↔ ${f.title}`];
  let time: [number, number] | null = null;
  try {
    time = historicalInterval(e.start, e.end, f.start, f.end);
  } catch {
    time = null; // ano zero ou intervalo invertido em dados importados
  }
  lines.push(
    time === null
      ? insufficient(language)
      : pick(
          language,
          `Intervalo possível: ${time[0]}–${time[1]} anos. Não há ano zero.`,
          `Possible interval: ${time[0]}–${time[1]} years. There is no year zero.`,
          `Intervalo posible: ${time[0]}–${time[1]} años. No hay año cero.`,
        ),
  );
  const byId = (id: string | null) => (id == null ? undefined : data.locations.find((l) => l.id === id));
  const p = byId(e.location);
  const q = byId(f.location);
  if (p && q && [p.lat, p.lon, q.lat, q.lon].every((n) => Number.isFinite(Number(n)))) {
    const km = formatNumber(geographicDistance(Number(p.lat), Number(p.lon), Number(q.lat), Number(q.lon)), 1, language);
    lines.push(
      pick(
        language,
        `Distância em linha reta: ≈ ${km} km. Não é distância de viagem.`,
        `Straight-line distance: ≈ ${km} km. This is not travel distance.`,
        `Distancia en línea recta: ≈ ${km} km. No es la distancia de viaje.`,
      ),
    );
    lines.push(`${p.ancient}: ${p.uncertainty}\n${q.ancient}: ${q.uncertainty}`);
  } else {
    lines.push(
      pick(
        language,
        'Localização insuficiente para distância.',
        'Insufficient location data for a distance.',
        'Ubicación insuficiente para calcular la distancia.',
      ),
    );
  }
  lines.push(`${e.description}\n\n${f.description}`);
  lines.push(
    pick(
      language,
      'Associações por perícope. Um versículo pode mencionar vários acontecimentos: confira a identificação antes de usar os resultados.',
      'Associations by pericope. A verse may mention several events: check the identification before using the results.',
      'Asociaciones por perícopa. Un versículo puede mencionar varios acontecimientos: verifique la identificación antes de usar los resultados.',
    ),
  );
  return { text: lines.join('\n\n'), chosen: [e, f] };
}

// ------------------------------------------------------------- atlas: lista
const placeText = new WeakMap<ContextLocation, string>();
/** Filtro da lista do AtlasPage: nome antigo + atual, sem acentos. */
export function filterLocations(locations: ContextLocation[], query: string): ContextLocation[] {
  const q = fold(query);
  if (!q) return locations;
  return locations.filter((l) => {
    let text = placeText.get(l);
    if (text === undefined) {
      text = fold(`${l.ancient ?? ''} ${l.modern ?? ''}`);
      placeText.set(l, text);
    }
    return text.includes(q);
  });
}

// ---------------------------------------------------------------- medidas
export interface Measure {
  id: string;
  /** Nome em português, exatamente como em lib/explore.dart. */
  name: string;
  min: number;
  max: number;
  unit: string;
  notes: string;
  en: { name: string; unit: string; notes: string };
  es: { name: string; unit: string; notes: string };
}

/** const measures de lib/explore.dart (id, nome, mínimo, máximo, unidade, notas) + traduções. */
export const MEASURES: readonly Measure[] = [
  {
    id: 'cubit',
    name: 'Côvado',
    min: 0.45,
    max: 0.52,
    unit: 'm',
    notes: 'Comprimento do antebraço; padrões comuns e reais diferiam. Êxodo 25:10; Ezequiel 40:5.',
    en: { name: 'Cubit', unit: 'm', notes: 'Length of the forearm; common and royal standards differed. Exodus 25:10; Ezekiel 40:5.' },
    es: { name: 'Codo', unit: 'm', notes: 'Longitud del antebrazo; los patrones común y real diferían. Éxodo 25:10; Ezequiel 40:5.' },
  },
  {
    id: 'shekel',
    name: 'Siclo',
    min: 11.0,
    max: 11.5,
    unit: 'g',
    notes: 'Intervalo de referência do padrão hebraico; lugar, época e objeto pesável importam.',
    en: { name: 'Shekel', unit: 'g', notes: 'Reference range of the Hebrew standard; place, period and the weighed object matter.' },
    es: { name: 'Siclo', unit: 'g', notes: 'Intervalo de referencia del patrón hebreo; importan el lugar, la época y el objeto pesado.' },
  },
  {
    id: 'talent',
    name: 'Talento',
    min: 30000.0,
    max: 35000.0,
    unit: 'g',
    notes: 'Ordem de grandeza de padrões próximos orientais; não há massa universal para todo talento.',
    en: { name: 'Talent', unit: 'g', notes: 'Order of magnitude of Near Eastern standards; there is no universal mass for every talent.' },
    es: { name: 'Talento', unit: 'g', notes: 'Orden de magnitud de patrones del Oriente Próximo; no hay una masa universal para todo talento.' },
  },
  {
    id: 'ephah',
    name: 'Efa',
    min: 20.0,
    max: 25.0,
    unit: 'L',
    notes: 'Estimativa de capacidade seca; padrões e reconstruções diferem.',
    en: { name: 'Ephah', unit: 'L', notes: 'Estimate of dry capacity; standards and reconstructions differ.' },
    es: { name: 'Efa', unit: 'L', notes: 'Estimación de capacidad para áridos; los patrones y las reconstrucciones difieren.' },
  },
  {
    id: 'bath',
    name: 'Bato',
    min: 20.0,
    max: 25.0,
    unit: 'L',
    notes: 'Capacidade líquida; Ezequiel 45:11 relaciona bato e efa.',
    en: { name: 'Bath', unit: 'L', notes: 'Liquid capacity; Ezekiel 45:11 relates the bath and the ephah.' },
    es: { name: 'Bato', unit: 'L', notes: 'Capacidad para líquidos; Ezequiel 45:11 relaciona el bato y el efa.' },
  },
  {
    id: 'homer',
    name: 'Hômer',
    min: 200.0,
    max: 250.0,
    unit: 'L',
    notes: 'Dez efas, dentro do modelo de referência.',
    en: { name: 'Homer', unit: 'L', notes: 'Ten ephahs, within the reference model.' },
    es: { name: 'Homer', unit: 'L', notes: 'Diez efas, dentro del modelo de referencia.' },
  },
  {
    id: 'hin',
    name: 'Him',
    min: 3.3,
    max: 4.2,
    unit: 'L',
    notes: 'Estimativa comum; não substituir medições arqueológicas específicas.',
    en: { name: 'Hin', unit: 'L', notes: 'Common estimate; do not replace specific archaeological measurements.' },
    es: { name: 'Hin', unit: 'L', notes: 'Estimación común; no sustituye mediciones arqueológicas específicas.' },
  },
  {
    id: 'stade',
    name: 'Estádio',
    min: 180.0,
    max: 192.0,
    unit: 'm',
    notes: 'Padrões gregos e romanos variavam. Lucas 24:13.',
    en: { name: 'Stadion', unit: 'm', notes: 'Greek and Roman standards varied. Luke 24:13.' },
    es: { name: 'Estadio', unit: 'm', notes: 'Los patrones griegos y romanos variaban. Lucas 24:13.' },
  },
  {
    id: 'denarius',
    name: 'Denário',
    min: 3.0,
    max: 4.0,
    unit: 'g de prata',
    notes:
      'Massa aproximada de exemplares do início do Império; teor e massa mudaram. Mateus 20:2 apresenta um pagamento de trabalho em uma parábola. Não há câmbio universal para reais.',
    en: {
      name: 'Denarius',
      unit: 'g of silver',
      notes:
        'Approximate mass of early Imperial specimens; fineness and mass changed. Matthew 20:2 presents a payment for work in a parable. There is no universal exchange rate to modern currency.',
    },
    es: {
      name: 'Denario',
      unit: 'g de plata',
      notes:
        'Masa aproximada de ejemplares de inicios del Imperio; la ley y la masa cambiaron. Mateo 20:2 presenta un pago por trabajo en una parábola. No hay un tipo de cambio universal a la moneda actual.',
    },
  },
];

export const measure = (id: string) => MEASURES.find((m) => m.id === id) ?? MEASURES[0];
export const measureText = (m: Measure, language: Lang) =>
  language === 'en' ? m.en : language === 'es' ? m.es : { name: m.name, unit: m.unit, notes: m.notes };

/** double.tryParse(texto.replaceAll(',', '.')) do original; só números finitos. */
export function parseQuantity(text: string): number | null {
  const s = text.replace(/,/g, '.').trim();
  if (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Resultado da UnitsPage: "≈ mín–máx unidade", ou null para quantidade inválida/negativa. */
export function convertMeasure(m: Measure, quantity: number | null, language: Lang = 'pt'): string | null {
  if (quantity === null || quantity < 0) return null;
  const { unit } = measureText(m, language);
  return `≈ ${formatNumber(quantity * m.min, 2, language)}–${formatNumber(quantity * m.max, 2, language)} ${unit}`;
}

export const UNITS_SOURCES = ['Êxodo 25:10; Ezequiel 40:5; 45:10–14; Lucas 24:13; Mateus 20:2'];
