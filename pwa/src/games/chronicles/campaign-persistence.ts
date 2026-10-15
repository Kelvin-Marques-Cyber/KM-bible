import { get, requestValue, write } from '../../lib/db';
import { emptyProgress, validCampaignProgress, type CampaignProgress } from './campaign-engine';

export const CAMPAIGN_SAVE_KEY = 'chronicles:campaigns:v1';
export const CAMPAIGN_BACKUP_KEY = CAMPAIGN_SAVE_KEY + ':backup';
export const CAMPAIGN_DAMAGED_KEY = CAMPAIGN_SAVE_KEY + ':preserved';
type Envelope = { key: string; state: CampaignProgress; savedAt: string };
const validEnvelope = (value: unknown, key: string): value is Envelope => {
  if (!value || typeof value !== 'object') return false;
  const item = value as Envelope;
  // Early v1 saves can lack savedAt; state validation is the compatibility boundary.
  return item.key === key && validCampaignProgress(item.state);
};
export class CampaignSaveError extends Error {
  constructor(message: string, public readonly recoverable = false) { super(message); this.name = 'CampaignSaveError'; }
}

export async function loadCampaign(): Promise<CampaignProgress> {
  const [current, backup] = await Promise.all([get('meta', CAMPAIGN_SAVE_KEY), get('meta', CAMPAIGN_BACKUP_KEY)]);
  if (validEnvelope(current, CAMPAIGN_SAVE_KEY)) return current.state;
  if (!current && !backup) return emptyProgress();
  throw new CampaignSaveError('O progresso das aventuras está danificado ou é de outra versão. Nenhum dado foi apagado.', validEnvelope(backup, CAMPAIGN_BACKUP_KEY));
}

// Serialize writes and snapshot before any await: checkpoints cannot overtake discoveries.
let pending: Promise<void> = Promise.resolve();
export function saveCampaign(state: CampaignProgress): Promise<void> {
  if (!validCampaignProgress(state)) return Promise.reject(new CampaignSaveError('Progresso inválido; os dados anteriores foram preservados.'));
  const snapshot = JSON.parse(JSON.stringify(state)) as CampaignProgress;
  const task = pending.then(() => write(['meta'], async tx => {
    const store = tx.objectStore('meta');
    const previous = await requestValue(store.get(CAMPAIGN_SAVE_KEY));
    if (previous && !validEnvelope(previous, CAMPAIGN_SAVE_KEY)) {
      throw new CampaignSaveError('O save anterior está danificado. Recupere ou preserve uma cópia antes de recomeçar.');
    }
    if (validEnvelope(previous, CAMPAIGN_SAVE_KEY)) store.put({ ...previous, key: CAMPAIGN_BACKUP_KEY });
    store.put({ key: CAMPAIGN_SAVE_KEY, state: snapshot, savedAt: new Date().toISOString() } satisfies Envelope);
  }));
  pending = task.catch(() => {});
  return task;
}

/** Explicit recovery keeps the damaged envelope in a separate forensic slot. */
export async function recoverCampaign(): Promise<CampaignProgress> {
  await pending;
  let recovered = emptyProgress();
  await write(['meta'], async tx => {
    const store = tx.objectStore('meta');
    const previous = await requestValue(store.get(CAMPAIGN_SAVE_KEY));
    const backup = await requestValue(store.get(CAMPAIGN_BACKUP_KEY));
    if (!validEnvelope(backup, CAMPAIGN_BACKUP_KEY)) throw new CampaignSaveError('Não há cópia de segurança válida para recuperar.');
    recovered = backup.state;
    if (previous) store.put({ key: CAMPAIGN_DAMAGED_KEY, envelope: previous, preservedAt: new Date().toISOString() });
    store.put({ ...backup, key: CAMPAIGN_SAVE_KEY });
  });
  return recovered;
}

/** Only called after the player confirms; no other game's key is touched. */
export async function preserveAndRestartCampaign(): Promise<CampaignProgress> {
  await pending;
  const state = emptyProgress();
  await write(['meta'], async tx => {
    const store = tx.objectStore('meta');
    const current = await requestValue(store.get(CAMPAIGN_SAVE_KEY));
    const backup = await requestValue(store.get(CAMPAIGN_BACKUP_KEY));
    store.put({ key: CAMPAIGN_DAMAGED_KEY, envelope: current, backup, preservedAt: new Date().toISOString() });
    store.put({ key: CAMPAIGN_SAVE_KEY, state, savedAt: new Date().toISOString() } satisfies Envelope);
    store.delete(CAMPAIGN_BACKUP_KEY);
  });
  return state;
}

export async function exportCampaignArchive(): Promise<string> {
  await pending;
  const keys = [CAMPAIGN_SAVE_KEY, CAMPAIGN_BACKUP_KEY, CAMPAIGN_DAMAGED_KEY];
  const entries = await Promise.all(keys.map(key => get('meta', key)));
  return JSON.stringify({ format: 'km-bible-chronicles', version: 1, entries }, null, 2);
}
