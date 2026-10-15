export const SAVE_SLOTS = [1, 2, 3] as const;
export type SaveSlot = (typeof SAVE_SLOTS)[number];

/** Slot 1 keeps the original keys, so earlier journeys need no destructive migration. */
export function slotKey(base: string, slot: SaveSlot = 1): string {
  if (!SAVE_SLOTS.includes(slot)) throw new Error('Espaço de save inválido.');
  return slot === 1 ? base : `${base}:slot:${slot}`;
}
