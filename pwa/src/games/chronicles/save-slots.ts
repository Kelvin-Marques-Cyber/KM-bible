import { get, getAll, requestValue, write } from '../../lib/db';
import { CAMPAIGN_EPISODES } from './campaign-content';
import { emptyProgress, validCampaignProgress, type CampaignProgress } from './campaign-engine';
import { CAMPAIGN_SAVE_KEY, waitForCampaignWrites } from './campaign-persistence';
import { isGameState, type GameState } from './engine';
import { SAVE_KEY, waitForPilotWrites } from './persistence';
import { SAVE_SLOTS, slotKey, type SaveSlot } from './save-slot-key';

export const SLOT_CATALOG_KEY = 'chronicles:slots:v1';
export type JourneyKind = 'campaign' | 'pilot';
type SlotCatalog = { key: string; active: SaveSlot; kinds: Partial<Record<SaveSlot, JourneyKind>> };
export type SaveSlotSummary = {
  id: SaveSlot;
  status: 'empty' | 'saved' | 'damaged';
  completed: number;
  episodeId?: string;
  saga?: number;
  chapter: string;
  kind: JourneyKind;
  savedAt?: string;
  hasPilot: boolean;
};
type Envelope = { key: string; state: unknown; savedAt?: string };

function catalog(value: unknown): SlotCatalog {
  const fallback: SlotCatalog = { key: SLOT_CATALOG_KEY, active: 1, kinds: {} };
  if (!value || typeof value !== 'object') return fallback;
  const input = value as SlotCatalog;
  if (input.key !== SLOT_CATALOG_KEY || !SAVE_SLOTS.includes(input.active)) return fallback;
  const kinds: SlotCatalog['kinds'] = {};
  for (const slot of SAVE_SLOTS) {
    const kind = input.kinds?.[slot];
    if (kind === 'campaign' || kind === 'pilot') kinds[slot] = kind;
  }
  return { ...fallback, active: input.active, kinds };
}
const envelope = (value: unknown, key: string): Envelope | undefined =>
  value && typeof value === 'object' && (value as Envelope).key === key ? value as Envelope : undefined;

/** Reads the six original envelopes; summaries are never a second source of game state. */
export async function readSaveSlots(): Promise<{ active: SaveSlot; slots: SaveSlotSummary[] }> {
  const selected = catalog(await get('meta', SLOT_CATALOG_KEY));
  const slots = await Promise.all(SAVE_SLOTS.map(async id => {
    const key = slotKey(CAMPAIGN_SAVE_KEY, id), pilotKey = slotKey(SAVE_KEY, id);
    const [campaignValue, pilotValue, backup] = await Promise.all([
      get('meta', key), get('meta', pilotKey), get('meta', key + ':backup'),
    ]);
    const c = envelope(campaignValue, key), p = envelope(pilotValue, pilotKey);
    const campaign = c && validCampaignProgress(c.state) ? c.state as CampaignProgress : undefined;
    const pilot = p && isGameState(p.state) ? p.state as GameState : undefined;
    const journeys = campaign ? Object.values(campaign.episodes) : [];
    const active = campaign?.activeEpisodeId ?? journeys.at(-1)?.episodeId;
    const episode = CAMPAIGN_EPISODES.find(e => e.id === active);
    const damaged = !!((campaignValue || backup) && !campaign || pilotValue && !pilot);
    const hasCampaign = journeys.length > 0;
    let kind: JourneyKind = selected.kinds[id] ?? (pilot && (!hasCampaign || (p?.savedAt ?? '') > (c?.savedAt ?? '')) ? 'pilot' : 'campaign');
    if (kind === 'pilot' && !pilot && hasCampaign) kind = 'campaign';
    if (kind === 'campaign' && !hasCampaign && pilot) kind = 'pilot';
    return {
      id, status: damaged ? 'damaged' : hasCampaign || pilot ? 'saved' : 'empty',
      completed: campaign?.completed.length ?? 0, episodeId: episode?.id, saga: episode?.saga,
      chapter: kind === 'pilot' ? 'O Vale e a Coragem' : episode?.title ?? 'Nova jornada',
      kind, savedAt: kind === 'pilot' ? p?.savedAt : c?.savedAt, hasPilot: !!pilot,
    } satisfies SaveSlotSummary;
  }));
  return { active: selected.active, slots };
}

export async function activateSaveSlot(id: SaveSlot, kind?: JourneyKind): Promise<void> {
  slotKey(CAMPAIGN_SAVE_KEY, id); // Validate even at runtime/import boundaries.
  await write(['meta'], async tx => {
    const store = tx.objectStore('meta');
    const before = catalog(await requestValue(store.get(SLOT_CATALOG_KEY)));
    store.put({ ...before, active: id, kinds: { ...before.kinds, ...(kind ? { [id]: kind } : {}) } });
  });
}

/** Explicit overwrite archives both journeys atomically before clearing only the chosen slot. */
export async function overwriteSaveSlot(id: SaveSlot): Promise<void> {
  const key = slotKey(CAMPAIGN_SAVE_KEY, id), pilotKey = slotKey(SAVE_KEY, id);
  await Promise.all([waitForCampaignWrites(), waitForPilotWrites()]);
  await write(['meta'], async tx => {
    const store = tx.objectStore('meta');
    const keys = [key, key + ':backup', key + ':preserved', pilotKey];
    const entries = await Promise.all(keys.map(k => requestValue(store.get(k))));
    if (entries.some(Boolean)) store.put({
      key: `${SLOT_CATALOG_KEY}:archive:${id}:${crypto.randomUUID()}`,
      slot: id, entries, preservedAt: new Date().toISOString(),
    });
    keys.forEach(k => store.delete(k));
    store.put({ key, state: emptyProgress(), savedAt: new Date().toISOString() });
    const before = catalog(await requestValue(store.get(SLOT_CATALOG_KEY)));
    store.put({ ...before, active: id, kinds: { ...before.kinds, [id]: 'campaign' } });
  });
}

export async function exportSaveSlots(session?: { slot: SaveSlot; state: CampaignProgress }): Promise<string> {
  await Promise.all([waitForCampaignWrites(), waitForPilotWrites()]);
  const entries = (await getAll<{ key: string }>('meta')).filter(item =>
    item.key.startsWith('chronicles:campaigns:') || item.key.startsWith('chronicles:vale-coragem:') || item.key.startsWith(SLOT_CATALOG_KEY));
  return JSON.stringify({ format: 'km-bible-chronicles-slots', version: 1, entries,
    session: session && validCampaignProgress(session.state) ? session : undefined }, null, 2);
}
