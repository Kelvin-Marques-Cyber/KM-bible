// Lógica pura da área "estudo conectado" (verse_study.dart, bible_topics.dart,
// DocumentPage/StudyText/LongStudyText de common.dart e portuguese_resources.dart).
// Sem React: testável em tests/unit/studycontext.test.ts.
import type { ModuleInfo } from './catalog';
import type { DocumentRow, Study } from './content';
import { fromId, refId, type Ref } from './domain';

/** traditionTitles de lib/studies.dart (+ expandedTraditionTitles de lib/study_catalog.dart). */
export const traditionTitles: Record<string, string> = {
  lutheran: 'Luterana confessional',
  anglican: 'Anglicana histórica',
  buddhism_mahayana: 'Budismo Mahayana',
  jainism: 'Jainismo',
  shinto: 'Xintoísmo',
  daoism: 'Taoismo / Daoismo',
  confucianism: 'Confucionismo',
  zoroastrianism: 'Zoroastrismo',
  eastern_orthodox: 'Ortodoxa oriental',
  methodist: 'Metodista',
  pentecostal: 'Pentecostal clássico',
  jehovahs_witnesses: 'Testemunhas de Jeová',
  latter_day_saints: 'Santos dos Últimos Dias',
  judaism: 'Judaísmo (fonte ortodoxa)',
  islam: 'Islã — cristologia',
  shia_islam: 'Islã xiita duodecimano',
  hinduism_vedanta: 'Hinduísmo — Vedanta',
  buddhism_theravada: 'Budismo Theravada',
  sikhism: 'Sikhismo',
  bahai: 'Fé Bahá’í',
  spiritism: 'Espiritismo kardecista',
  secular_humanism: 'Humanismo secular',
  umbanda: 'Umbanda (método de estudo)',
  candomble: 'Candomblé (método de estudo)',
  indigenous_traditions: 'Tradições indígenas (método de estudo)',
  presbyterian: 'Presbiteriana reformada',
  baptist: 'Batista confessional',
  seventh_day_adventist: 'Adventista do Sétimo Dia',
  roman_catholic: 'Católica romana',
  atheism: 'Ateísmo / objeções filosóficas',
};
export const traditionTitle = (target: string) => traditionTitles[target] ?? target;

/** Corta textos longos como o trecho clássico de Matthew Henry (1800 caracteres + "…"). */
export function truncateText(text: string, max = 1800): string {
  return text.length > max ? `${text.substring(0, max)}…` : text;
}

/**
 * Parágrafos de LongStudyText: separa por linhas em branco (\n\s*\n) e descarta
 * vazios. Blocos de código cercados (```) não são partidos ao meio.
 */
export function splitParagraphs(text: string): string[] {
  const raw = text.replace(/\r\n?/g, '\n').split(/\n\s*\n/);
  const out: string[] = [];
  let open: string | null = null;
  for (const piece of raw) {
    if (open !== null) {
      open = `${open}\n\n${piece}`;
      if (fenceCount(piece) % 2 === 1) {
        out.push(open);
        open = null;
      }
      continue;
    }
    if (fenceCount(piece) % 2 === 1) {
      open = piece;
      continue;
    }
    if (piece.trim()) out.push(piece);
  }
  if (open !== null && open.trim()) out.push(open);
  return out;
}
const fenceCount = (s: string) => (s.match(/^\s*```/gm) ?? []).length;

/**
 * Remove marcação HTML do índice original (TopicPage: replaceAll('<[^>]*>', ' ')).
 * Quebras <br> viram quebras de linha para preservar a estrutura do índice.
 */
export function stripTags(html: string): string {
  return html
    .replace(/\r\n?/g, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    // Sem recuo no início das linhas: quatro espaços virariam bloco de código no Markdown.
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Estudos que citam o versículo; senão até `bookLimit` que citam o livro (associação ampla). */
export function studiesCiting(all: Study[], r: Ref, bookLimit = 12): { direct: boolean; items: Study[] } {
  const id = refId(r);
  const direct = all.filter((s) => s.refs.some((x) => String(x) === id));
  if (direct.length > 0) return { direct: true, items: direct };
  const items: Study[] = [];
  for (const s of all) {
    if (items.length >= bookLimit) break;
    if (s.refs.some((x) => fromId(String(x))?.book === r.book)) items.push(s);
  }
  return { direct: false, items };
}

export const CONFESSION_MODULES = ['WCF', 'WSC', 'WLC'];
/** Nos Padrões de Westminster o corpo já traz o guia em português; a versão "pt" é a tradução de apoio. */
export const isConfessionModule = (id: string) => CONFESSION_MODULES.includes(id);

/**
 * Referências de um documento: somente metadata.references, como DocumentPage do
 * original (ids inválidos são ignorados; repetidos aparecem uma vez).
 */
export function documentReferences(doc: Pick<DocumentRow, 'metadata'>): Ref[] {
  const list = Array.isArray(doc.metadata?.references) ? (doc.metadata.references as unknown[]) : [];
  const seen = new Set<string>();
  const out: Ref[] = [];
  for (const id of list) {
    const r = fromId(String(id));
    if (!r || seen.has(refId(r))) continue;
    seen.add(refId(r));
    out.push(r);
  }
  return out;
}

/** Texto copiado com citação: corpo + "autor; título do módulo; id; fonte". */
export function documentCitation(doc: Pick<DocumentRow, 'id' | 'body'>, m?: Pick<ModuleInfo, 'author' | 'title' | 'source'> | null): string {
  return `${doc.body}\n\n${m?.author ?? ''}; ${m?.title ?? ''}; ${doc.id}; ${m?.source ?? ''}`;
}

/** Metadados do módulo em linhas "chave: valor" (exibidos junto da licença). */
export function metadataLines(metadata: Record<string, unknown> | null | undefined): string {
  if (!metadata) return '';
  return Object.entries(metadata)
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
    .join('\n');
}

/** Rótulo "autor · idioma" do cabeçalho do documento. */
export function authorLine(m?: Pick<ModuleInfo, 'author' | 'language'> | null): string {
  return `${m?.author ?? ''} · ${m?.language ?? ''}`;
}

/** Altura estimada (px) de um parágrafo Markdown para o virtualizador (.md usa altura de linha 1,6). */
export function estimateParagraphHeight(text: string, fontSize: number, lineHeight = 1.6, width = 340): number {
  const charsPerLine = Math.max(20, Math.floor(width / (fontSize * 0.5)));
  const lines = text.split('\n').reduce((n, line) => n + Math.max(1, Math.ceil(line.length / charsPerLine)), 0);
  return Math.round(lines * fontSize * lineHeight + 14);
}
