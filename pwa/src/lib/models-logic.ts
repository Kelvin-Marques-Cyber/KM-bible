// Lógica pura das reconstruções 3D (ModelsPage/ModelPage de lib/explore.dart
// e Browser3D de lib/model3d_browser_web.dart). Testável sem DOM.
import type { Model3D, SceneBlock } from './content';
import { fold } from './domain';
import { lang } from './i18n';

/** Modelos com imagem de prévia publicada em 3d/previews/<id>.jpg. */
export const PREVIEW_IDS = new Set(['arca_noe', 'arca_alianca', 'tabernaculo', 'templo_salomao', 'habitacao', 'harpa']);

export const IMPORTED_CATEGORY = 'Módulo importado';
export const modelCategory = (m: Model3D) => m.category ?? IMPORTED_CATEGORY;

/** Categorias na ordem em que aparecem (toSet() do original). */
export function modelCategories(models: Model3D[]): string[] {
  return [...new Set(models.map(modelCategory))];
}

export type Association = SceneBlock['items'][number];

export interface ModelFilter {
  /** Bloco contextual (apenas os modelos do trecho) ou null. */
  block: SceneBlock | null;
  contextual: boolean;
  category: string;
  query: string;
}

/** Filtro do original: trecho, categoria e busca (título + descrição, sem acentos). */
export function filterModels(models: Model3D[], f: ModelFilter): Model3D[] {
  const items = f.block?.items ?? [];
  const ids = new Set(items.map((i) => i.model_id));
  const q = fold(f.query);
  return models.filter(
    (m) =>
      (!f.contextual || ids.has(m.id)) &&
      (!f.category || m.category === f.category || (f.category === IMPORTED_CATEGORY && !m.category)) &&
      (!q || fold(`${m.title} ${m.description}`).includes(q)),
  );
}

export const associationFor = (block: SceneBlock | null, modelId: string): Association | null =>
  block?.items.find((i) => i.model_id === modelId) ?? null;

// ------------------------------------------------------------ download
/** Acima disso (ou com economia de dados) o modelo só baixa quando a pessoa pede. */
export const CONFIRM_BYTES = 3_000_000;

export function formatModelSize(bytes: number, language: string = lang()): string {
  const locale = language === 'en' ? 'en-US' : language === 'es' ? 'es-ES' : 'pt-BR';
  if (bytes < 1_000_000) {
    return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(Math.max(1, Math.round(bytes / 1000)))} KB`;
  }
  return `${new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(bytes / 1_000_000)} MB`;
}

export function needsConfirmation(bytes: number | undefined, saveData: boolean): boolean {
  return saveData || (bytes ?? 0) > CONFIRM_BYTES;
}

export function saveDataEnabled(): boolean {
  try {
    const nav = navigator as Navigator & { connection?: { saveData?: boolean } };
    return nav.connection?.saveData === true;
  } catch {
    return false;
  }
}

/** Mesmo filtro do Browser3D: só nomes simples de arquivos .glb. */
export const validModelFile = (file: string | undefined | null): file is string => !!file && /^[a-zA-Z0-9_-]+\.glb$/.test(file);

// ------------------------------------------------------- texto alternativo
/** Remove sufixos numéricos do Blender ("Tábuas.012") e repetições. */
export const cleanPartName = (name: string) => name.replace(/\.\d{3,}$/, '').trim();
export function uniqueParts(parts: string[] | undefined): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of parts ?? []) {
    const name = cleanPartName(String(raw));
    if (!name || seen.has(name)) continue;
    seen.add(name);
    out.push(name);
  }
  return out;
}

// ----------------------------------------------------------- mensagens
export const CHANNEL = 'biblia3d';
export const viewerCommand = (name: string, value?: unknown) => JSON.stringify({ channel: CHANNEL, name, value: value ?? null });

/** "biblia3d:<status>" vindo do visualizador; null para qualquer outra mensagem. */
export function parseViewerMessage(data: unknown): string | null {
  if (typeof data !== 'string' || !data.startsWith(`${CHANNEL}:`)) return null;
  return data.slice(CHANNEL.length + 1);
}

/** Erro reportado pelo visualizador (falha de carga, contexto gráfico, controle). */
export const isViewerError = (status: string) => /^(error\b|Falha no modelo 3D|Nome de modelo 3D inválido|Controle 3D)/i.test(status);

/** Script injetado no visualizador: o canal Status do WebView nativo, via postMessage. */
export const STATUS_BRIDGE = `window.Status={postMessage:function(m){try{parent.postMessage('${CHANNEL}:'+String(m),location.origin)}catch(_){}}};`;
