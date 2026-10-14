import { afterEach, describe, expect, it } from 'vitest';
import {
  CARD_MODES,
  GRADES,
  cardPrompt,
  clozeText,
  dateKey,
  dueCards,
  isAfterReminder,
  memoryStats,
  msUntilNextReminder,
  normalizeReminderTime,
  parseReminderTime,
  pickCards,
  reminderAction,
  reminderMoment,
} from '../../src/lib/notes-memory';
import { checkReminder, onReminderBanner, stopReminders } from '../../src/lib/notes-reminders';
import { ref } from '../../src/lib/domain';
import { addCard, cards, pref, setPref } from '../../src/lib/store';

describe('cartões (memory.dart)', () => {
  it('cinco modos, na ordem do original', () => {
    expect(CARD_MODES).toEqual(['reference_to_text', 'text_to_reference', 'cloze', 'recitation', 'theme_card']);
    expect(GRADES.map(([, g]) => g)).toEqual([0, 3, 4, 5]);
  });

  it('cloze troca cada 4ª palavra por _____', () => {
    expect(clozeText('Porque Deus amou o mundo de tal maneira que deu')).toBe('Porque Deus amou _____ mundo de tal _____ que deu');
    expect(clozeText('um dois três')).toBe('um dois três');
    expect(clozeText('a b c d e f g h')).toBe('a b c _____ e f g _____');
  });

  it('enunciado por modo igual ao ReviewPage', () => {
    const card = { text: 'No princípio era o Verbo', topic: 'Cristologia' };
    expect(cardPrompt({ ...card, mode: 'reference_to_text' }, 'João 1:1', 'Recitação livre')).toBe('João 1:1');
    expect(cardPrompt({ ...card, mode: 'text_to_reference' }, 'João 1:1', 'Recitação livre')).toBe(card.text);
    expect(cardPrompt({ ...card, mode: 'cloze' }, 'João 1:1', 'Recitação livre')).toBe('No princípio era _____ Verbo');
    expect(cardPrompt({ ...card, mode: 'recitation' }, 'João 1:1', 'Recitação livre')).toBe('João 1:1\nRecitação livre');
    expect(cardPrompt({ ...card, mode: 'theme_card' }, 'João 1:1', 'Recitação livre')).toBe('Cristologia');
    expect(cardPrompt({ ...card, mode: 'desconhecido' }, 'João 1:1', 'Recitação livre')).toBe('João 1:1');
  });

  it('acompanhamento: revisões, % lembrados e consolidados', () => {
    expect(memoryStats([], { n: 0, correct: 0 })).toEqual({ cards: 0, reviews: 0, remembered: 0, consolidated: 0 });
    expect(memoryStats([{ interval: 30 }, { interval: 29 }, { interval: 90 }], { n: 3, correct: 2 })).toEqual({
      cards: 3,
      reviews: 3,
      remembered: 67,
      consolidated: 2,
    });
  });

  it('pendentes e seleção por id', () => {
    const all = [
      { id: 'a', due: 0 },
      { id: 'b', due: 5000 },
      { id: 'c', due: 100 },
    ];
    expect(dueCards(all, 1000).map((c) => c.id)).toEqual(['a', 'c']);
    expect(pickCards(all, ['c', 'x', 'a', 'c']).map((c) => c.id)).toEqual(['c', 'a']);
  });
});

describe('lembrete diário', () => {
  const at = (h: number, m: number) => new Date(2026, 9, 14, h, m, 0, 0);

  it('horário válido ou 19:00', () => {
    expect(parseReminderTime('07:05')).toEqual([7, 5]);
    expect(parseReminderTime('7:30')).toEqual([7, 30]);
    expect(parseReminderTime('24:00')).toEqual([19, 0]);
    expect(parseReminderTime(null)).toEqual([19, 0]);
    expect(normalizeReminderTime('7:30')).toBe('07:30');
  });

  it('próximo disparo hoje ou amanhã', () => {
    expect(msUntilNextReminder(at(18, 0), '19:00')).toBe(3600_000);
    expect(msUntilNextReminder(at(19, 0), '19:00')).toBe(24 * 3600_000);
    expect(msUntilNextReminder(at(20, 0), '19:00')).toBe(23 * 3600_000);
    expect(reminderMoment(at(8, 0), '06:15').getHours()).toBe(6);
    expect(isAfterReminder(at(19, 0), '19:00')).toBe(true);
    expect(isAfterReminder(at(18, 59), '19:00')).toBe(false);
    expect(dateKey(at(1, 0))).toBe('2026-10-14');
  });

  it('decide entre nada, notificação e aviso no app', () => {
    const base = { now: at(19, 1), enabled: true, time: '19:00', due: 2, lastShown: '', permission: 'granted' as const, visible: false, onTime: true };
    expect(reminderAction(base)).toBe('notify');
    expect(reminderAction({ ...base, enabled: false })).toBe('none');
    expect(reminderAction({ ...base, due: 0 })).toBe('none');
    expect(reminderAction({ ...base, now: at(18, 0) })).toBe('none');
    expect(reminderAction({ ...base, lastShown: '2026-10-14' })).toBe('none');
    // Sem permissão: só o aviso dentro do app, e apenas com o app visível.
    expect(reminderAction({ ...base, permission: 'denied' })).toBe('none');
    expect(reminderAction({ ...base, permission: 'denied', visible: true })).toBe('banner');
    // Ao abrir o app depois do horário (não é o temporizador): aviso no app.
    expect(reminderAction({ ...base, onTime: false, visible: true })).toBe('banner');
    // Temporizador muito atrasado (aparelho dormiu): não notifica.
    expect(reminderAction({ ...base, now: at(22, 0), visible: true })).toBe('banner');
  });
});

describe('checkReminder com dados pessoais', () => {
  afterEach(() => stopReminders());

  it('mostra o aviso uma vez por dia quando há cartões pendentes', async () => {
    const shown: number[] = [];
    const off = onReminderBanner((due) => shown.push(due));
    const now = new Date();
    await setPref('reminder_enabled', true, false);
    await setPref('reminder_time', '00:00', false);
    await setPref('reminder_last', '', false);
    expect(await checkReminder(false, now)).toBe('none');
    await addCard('ARA', ref(43, 3, 16), 'Porque Deus amou o mundo');
    expect((await cards(true)).length).toBe(1);
    expect(await checkReminder(false, now)).toBe('banner');
    expect(shown).toEqual([1]);
    expect(pref('reminder_last', '')).toBe(dateKey(now));
    expect(await checkReminder(false, now)).toBe('none');
    expect(shown).toEqual([1]);
    off();
  });
});
