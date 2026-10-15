import { beforeEach, describe, expect, it } from 'vitest';
import { get, getAll, put, write } from '../../src/lib/db';
import { emptyProgress, newJourney, progressWithJourney } from '../../src/games/chronicles/campaign-engine';
import { CAMPAIGN_SAVE_KEY, loadCampaign, recoverCampaign, saveCampaign } from '../../src/games/chronicles/campaign-persistence';
import { createGame } from '../../src/games/chronicles/engine';
import { loadGame, saveGame, SAVE_KEY } from '../../src/games/chronicles/persistence';
import { SAVE_SLOTS, slotKey, type SaveSlot } from '../../src/games/chronicles/save-slot-key';
import { activateSaveSlot, overwriteSaveSlot, readSaveSlots, SLOT_CATALOG_KEY } from '../../src/games/chronicles/save-slots';

const journey = (x = 17) => ({ ...progressWithJourney(emptyProgress(), { ...newJourney('creation'), x, introduced: true }), activeEpisodeId: 'creation' });
beforeEach(async () => { await write(['meta'], async tx => { tx.objectStore('meta').clear(); }); });

describe('Três livros de save de Crônicas', () => {
  it('reconhece os dois saves legados no espaço 1 sem reescrever suas chaves', async () => {
    await saveCampaign(journey());
    await saveGame(createGame());
    const before = await getAll('meta');
    const catalog = await readSaveSlots();
    expect(catalog.active).toBe(1);
    expect(catalog.slots.map(s => s.status)).toEqual(['saved', 'empty', 'empty']);
    expect(catalog.slots[0].hasPilot).toBe(true);
    expect(await getAll('meta')).toEqual(before);
    expect(await loadCampaign(1)).toEqual(journey());
    expect(await loadGame(1)).toEqual(createGame());
  });
  it('mantém posição, capítulo e piloto independentes nos três espaços', async () => {
    for (const id of SAVE_SLOTS) {
      await saveCampaign(journey(10 + id), id);
      await saveGame({ ...createGame(), x: 6 + id }, id);
    }
    for (const id of SAVE_SLOTS) {
      expect((await loadCampaign(id)).episodes.creation.x).toBe(10 + id);
      expect((await loadGame(id))?.x).toBe(6 + id);
    }
    expect((await readSaveSlots()).slots.every(s => s.status === 'saved')).toBe(true);
    expect(slotKey(CAMPAIGN_SAVE_KEY, 1)).toBe(CAMPAIGN_SAVE_KEY);
    expect(slotKey(SAVE_KEY, 2)).not.toBe(slotKey(CAMPAIGN_SAVE_KEY, 2));
  });
  it('retém o espaço ativo e qual jornada deve continuar após reabrir', async () => {
    await saveCampaign(journey(), 2);
    await saveGame(createGame(), 2);
    await activateSaveSlot(2, 'pilot');
    expect((await readSaveSlots()).active).toBe(2);
    expect((await readSaveSlots()).slots[1].chapter).toBe('O Vale e a Coragem');
    await activateSaveSlot(2, 'campaign');
    expect((await readSaveSlots()).slots[1].chapter).toBe('O Primeiro Alvorecer');
    expect((await readSaveSlots()).slots[1].saga).toBe(0);
  });
  it('captura o piloto no momento do checkpoint, antes de aguardar a fila', async () => {
    const state = createGame();
    const task = saveGame(state, 3);
    state.x = 15;
    await task;
    expect((await loadGame(3))?.x).toBe(createGame().x);
  });
  it('recupera um espaço danificado sem misturar backup, piloto ou outros espaços', async () => {
    await saveCampaign(journey(9), 1);
    await saveCampaign(journey(11), 2);
    await saveCampaign(journey(12), 2);
    await saveGame(createGame(), 2);
    const key = slotKey(CAMPAIGN_SAVE_KEY, 2);
    await put('meta', { key, state: 'danificado' });
    await expect(loadCampaign(2)).rejects.toMatchObject({ recoverable: true });
    expect((await readSaveSlots()).slots[1].status).toBe('damaged');
    expect((await recoverCampaign(2)).episodes.creation.x).toBe(11);
    expect((await loadCampaign(1)).episodes.creation.x).toBe(9);
    expect(await loadGame(2)).toEqual(createGame());
    expect(await get('meta', key + ':preserved')).toMatchObject({ envelope: { state: 'danificado' } });
  });
  it('arquiva aventuras e piloto atomicamente na sobrescrita, preservando os demais jogos', async () => {
    await saveCampaign(journey(8), 1);
    await saveCampaign(journey(11), 3);
    await saveGame(createGame(), 3);
    await put('meta', { key: 'mezuzah:keep', state: 'partida' });
    await overwriteSaveSlot(3);
    expect(await loadCampaign(3)).toEqual(emptyProgress());
    expect(await loadGame(3)).toBeNull();
    expect((await loadCampaign(1)).episodes.creation.x).toBe(8);
    expect(await get('meta', 'mezuzah:keep')).toMatchObject({ state: 'partida' });
    const records = await getAll<{ key: string; entries?: { key: string }[] }>('meta');
    const archive = records.find(r => r.key.startsWith(SLOT_CATALOG_KEY + ':archive:3:'));
    expect(archive?.entries?.filter(Boolean).map(e => e.key)).toContain(slotKey(SAVE_KEY, 3));
    expect(archive?.entries?.filter(Boolean).map(e => e.key)).toContain(slotKey(CAMPAIGN_SAVE_KEY, 3));
    expect((await readSaveSlots()).active).toBe(3);
    expect((await readSaveSlots()).slots[2].status).toBe('empty');
  });
  it('não transforma corrupção do catálogo em perda dos envelopes válidos', async () => {
    await saveCampaign(journey(14), 3);
    await put('meta', { key: SLOT_CATALOG_KEY, active: 99, kinds: 'inválido' });
    expect((await readSaveSlots()).active).toBe(1);
    expect((await readSaveSlots()).slots[2].status).toBe('saved');
    expect((await loadCampaign(3)).episodes.creation.x).toBe(14);
    expect(await get('meta', SLOT_CATALOG_KEY)).toMatchObject({ active: 99 });
  });
  it('rejeita identificadores de espaço fora dos três previstos', () => {
    expect(() => slotKey(CAMPAIGN_SAVE_KEY, 0 as SaveSlot)).toThrow();
    expect(() => slotKey(SAVE_KEY, 4 as SaveSlot)).toThrow();
  });
});
