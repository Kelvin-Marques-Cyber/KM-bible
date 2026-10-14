// Lógica pura da memorização (lib/memory.dart) e do lembrete diário
// (lib/notifications.dart adaptado à web). Sem React, testável.
import type { Flashcard } from './store';

export const CARD_MODES = ['reference_to_text', 'text_to_reference', 'cloze', 'recitation', 'theme_card'] as const;
export type CardMode = (typeof CARD_MODES)[number];

/** Notas de revisão do original: again(0), hard(3), good(4), easy(5). */
export const GRADES = [
  ['again', 0],
  ['hard', 3],
  ['good', 4],
  ['easy', 5],
] as const;

/** Completar palavras: cada 4ª palavra (separada por espaço) vira "_____". */
export function clozeText(text: string): string {
  let i = 0;
  return text
    .split(' ')
    .map((w) => (++i % 4 === 0 ? '_____' : w))
    .join(' ');
}

/**
 * Enunciado do cartão conforme o modo, idêntico ao ReviewPage do original.
 * `label` é o rótulo da referência; `recitation` é t('recitation').
 */
export function cardPrompt(card: Pick<Flashcard, 'mode' | 'text' | 'topic'>, label: string, recitation: string): string {
  switch (card.mode) {
    case 'text_to_reference':
      return card.text;
    case 'cloze':
      return clozeText(card.text);
    case 'recitation':
      return `${label}\n${recitation}`;
    case 'theme_card':
      return card.topic;
    default:
      return label;
  }
}

export interface MemoryStats {
  cards: number;
  reviews: number;
  /** Porcentagem (0–100, arredondada) de revisões com nota ≥ 3. */
  remembered: number;
  /** Cartões com intervalo ≥ 30 dias. */
  consolidated: number;
}

export function memoryStats(all: readonly Pick<Flashcard, 'interval'>[], history: { n: number; correct: number }): MemoryStats {
  return {
    cards: all.length,
    reviews: history.n,
    remembered: history.n === 0 ? 0 : Math.round((history.correct * 100) / history.n),
    consolidated: all.filter((c) => (c.interval ?? 0) >= 30).length,
  };
}

/** Cartões pendentes (due ≤ agora), na ordem recebida. */
export const dueCards = <T extends Pick<Flashcard, 'due'>>(all: readonly T[], now = Date.now()) => all.filter((c) => c.due <= now);

/** Ordena cartões na ordem dos ids pedidos, ignorando ids inexistentes. */
export function pickCards<T extends Pick<Flashcard, 'id'>>(all: readonly T[], ids: readonly string[]): T[] {
  const byId = new Map(all.map((c) => [c.id, c]));
  const out: T[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    const card = byId.get(id);
    if (card && !seen.has(id)) {
      seen.add(id);
      out.push(card);
    }
  }
  return out;
}

// ------------------------------------------------------------ lembrete
export const DEFAULT_REMINDER_TIME = '19:00';

/** "HH:MM" válido → [hora, minuto]; qualquer outro valor usa 19:00. */
export function parseReminderTime(value: unknown): [number, number] {
  const m = typeof value === 'string' ? /^(\d{1,2}):(\d{2})$/.exec(value.trim()) : null;
  if (m) {
    const h = Number(m[1]);
    const min = Number(m[2]);
    if (h >= 0 && h <= 23 && min >= 0 && min <= 59) return [h, min];
  }
  return [19, 0];
}

export const formatReminderTime = (h: number, m: number) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

export const normalizeReminderTime = (value: unknown) => formatReminderTime(...parseReminderTime(value));

/** Data local "AAAA-MM-DD" (um lembrete por dia). */
export function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** Instante do lembrete no dia local de `now`. */
export function reminderMoment(now: Date, time: unknown): Date {
  const [h, m] = parseReminderTime(time);
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0);
}

export const isAfterReminder = (now: Date, time: unknown) => now.getTime() >= reminderMoment(now, time).getTime();

/** Milissegundos até o próximo horário (hoje, se ainda não passou; senão amanhã), como Reminders.enable. */
export function msUntilNextReminder(now: Date, time: unknown): number {
  const [h, m] = parseReminderTime(time);
  let when = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0);
  if (when.getTime() <= now.getTime()) when = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, h, m, 0, 0);
  return when.getTime() - now.getTime();
}

export type ReminderAction = 'none' | 'notify' | 'banner';

/**
 * Decide o que fazer numa verificação do lembrete:
 * - nada antes do horário, sem cartões pendentes ou se já avisou hoje;
 * - notificação do sistema quando a permissão foi dada e a verificação ocorre
 *   perto do horário (até 2 h depois; evita avisos atrasados após o aparelho dormir);
 * - caso contrário, aviso dentro do aplicativo (se estiver visível).
 */
export function reminderAction(options: {
  now: Date;
  enabled: boolean;
  time: unknown;
  due: number;
  lastShown: string;
  permission: NotificationPermission | 'unsupported';
  visible: boolean;
  onTime: boolean;
}): ReminderAction {
  const { now, enabled, time, due, lastShown, permission, visible, onTime } = options;
  if (!enabled || due <= 0 || !isAfterReminder(now, time) || lastShown === dateKey(now)) return 'none';
  const late = now.getTime() - reminderMoment(now, time).getTime();
  if (permission === 'granted' && onTime && late <= 2 * 3600_000) return 'notify';
  return visible ? 'banner' : 'none';
}
