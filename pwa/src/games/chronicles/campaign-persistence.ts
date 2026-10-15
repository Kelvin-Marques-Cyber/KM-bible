import { get, requestValue, write } from "../../lib/db";
import { slotKey, type SaveSlot } from "./save-slot-key";
import {
  emptyProgress,
  validCampaignProgress,
  type CampaignProgress,
} from "./campaign-engine";

export const CAMPAIGN_SAVE_KEY = "chronicles:campaigns:v1";
export const CAMPAIGN_BACKUP_KEY = CAMPAIGN_SAVE_KEY + ":backup";
export const CAMPAIGN_DAMAGED_KEY = CAMPAIGN_SAVE_KEY + ":preserved";
type Envelope = { key: string; state: CampaignProgress; savedAt: string };
const validEnvelope = (value: unknown, key: string): value is Envelope => {
  if (!value || typeof value !== "object") return false;
  const item = value as Envelope;
  // Early v1 saves can lack savedAt; state validation is the compatibility boundary.
  return item.key === key && validCampaignProgress(item.state);
};
export class CampaignSaveError extends Error {
  constructor(
    message: string,
    public readonly recoverable = false,
  ) {
    super(message);
    this.name = "CampaignSaveError";
  }
}

export async function loadCampaign(slot: SaveSlot = 1): Promise<CampaignProgress> {
  const key = slotKey(CAMPAIGN_SAVE_KEY, slot), backupKey = key + ":backup";
  const [current, backup] = await Promise.all([
    get("meta", key),
    get("meta", backupKey),
  ]);
  if (validEnvelope(current, key)) return current.state;
  if (!current && !backup) return emptyProgress();
  throw new CampaignSaveError(
    "O progresso das aventuras está danificado ou é de outra versão. Nenhum dado foi apagado.",
    validEnvelope(backup, backupKey),
  );
}

// Serialize writes and snapshot before any await: checkpoints cannot overtake discoveries.
let pending: Promise<void> = Promise.resolve();
export function saveCampaign(state: CampaignProgress, slot: SaveSlot = 1): Promise<void> {
  const key = slotKey(CAMPAIGN_SAVE_KEY, slot), backupKey = key + ":backup";
  if (!validCampaignProgress(state))
    return Promise.reject(
      new CampaignSaveError(
        "Progresso inválido; os dados anteriores foram preservados.",
      ),
    );
  const snapshot = JSON.parse(JSON.stringify(state)) as CampaignProgress;
  const task = pending.then(() =>
    write(["meta"], async (tx) => {
      const store = tx.objectStore("meta");
      const previous = await requestValue(store.get(key));
      if (previous && !validEnvelope(previous, key)) {
        throw new CampaignSaveError(
          "O save anterior está danificado. Recupere ou preserve uma cópia antes de recomeçar.",
        );
      }
      if (validEnvelope(previous, key))
        store.put({ ...previous, key: backupKey });
      store.put({
        key,
        state: snapshot,
        savedAt: new Date().toISOString(),
      } satisfies Envelope);
    }),
  );
  pending = task.catch(() => {});
  return task;
}

/** Explicit recovery keeps the damaged envelope in a separate forensic slot. */
export async function recoverCampaign(slot: SaveSlot = 1): Promise<CampaignProgress> {
  const key = slotKey(CAMPAIGN_SAVE_KEY, slot), backupKey = key + ":backup", damagedKey = key + ":preserved";
  await pending;
  let recovered = emptyProgress();
  await write(["meta"], async (tx) => {
    const store = tx.objectStore("meta");
    const previous = await requestValue(store.get(key));
    const backup = await requestValue(store.get(backupKey));
    if (!validEnvelope(backup, backupKey))
      throw new CampaignSaveError(
        "Não há cópia de segurança válida para recuperar.",
      );
    recovered = backup.state;
    if (previous)
      store.put({
        key: damagedKey,
        envelope: previous,
        preservedAt: new Date().toISOString(),
      });
    store.put({ ...backup, key });
  });
  return recovered;
}

/** Only called after the player confirms; no other game's key is touched. */
export async function preserveAndRestartCampaign(slot: SaveSlot = 1): Promise<CampaignProgress> {
  const key = slotKey(CAMPAIGN_SAVE_KEY, slot), backupKey = key + ":backup", damagedKey = key + ":preserved";
  await pending;
  const state = emptyProgress();
  await write(["meta"], async (tx) => {
    const store = tx.objectStore("meta");
    const current = await requestValue(store.get(key));
    const backup = await requestValue(store.get(backupKey));
    store.put({
      key: damagedKey,
      envelope: current,
      backup,
      preservedAt: new Date().toISOString(),
    });
    store.put({
      key,
      state,
      savedAt: new Date().toISOString(),
    } satisfies Envelope);
    store.delete(backupKey);
  });
  return state;
}

export async function exportCampaignArchive(
  session?: CampaignProgress,
  slot: SaveSlot = 1,
): Promise<string> {
  await pending;
  const key = slotKey(CAMPAIGN_SAVE_KEY, slot);
  const keys = [key, key + ":backup", key + ":preserved"];
  const entries = await Promise.all(keys.map((key) => get("meta", key)));
  return JSON.stringify(
    { format: "km-bible-chronicles", version: 1, entries, session:validCampaignProgress(session)?session:undefined },
    null,
    2,
  );
}

export const waitForCampaignWrites = () => pending;
