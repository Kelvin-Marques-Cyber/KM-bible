import { del, get, put } from '../../lib/db';
import { isGameState, type GameState } from './engine';
import { slotKey, type SaveSlot } from './save-slot-key';

export const SAVE_KEY = 'chronicles:vale-coragem:v1';
type SaveEnvelope = { key: string; state: GameState; savedAt: string };
export class ChroniclesSaveError extends Error {
  constructor(message: string) { super(message); this.name = 'ChroniclesSaveError'; }
}
export async function loadGame(slot: SaveSlot = 1): Promise<GameState | null> {
  const key = slotKey(SAVE_KEY, slot);
  let value: unknown;
  try { value = await get<SaveEnvelope>('meta', key); }
  catch { throw new ChroniclesSaveError('Não foi possível abrir o progresso de Crônicas da Aliança neste navegador.'); }
  if (value === undefined) return null;
  if (!value || typeof value !== 'object' || (value as SaveEnvelope).key !== key || !isGameState((value as SaveEnvelope).state)) {
    throw new ChroniclesSaveError('O progresso de Crônicas da Aliança está incompatível ou danificado. Inicie um novo episódio para substituí-lo.');
  }
  return (value as SaveEnvelope).state;
}
let pending: Promise<void> = Promise.resolve();
export async function saveGame(state: GameState, slot: SaveSlot = 1): Promise<void> {
  if (!isGameState(state)) throw new ChroniclesSaveError('O progresso não pôde ser salvo porque contém dados inválidos.');
  const snapshot = JSON.parse(JSON.stringify(state)) as GameState;
  const task = pending.then(() => put('meta', { key: slotKey(SAVE_KEY, slot), state: snapshot, savedAt: new Date().toISOString() } satisfies SaveEnvelope));
  pending = task.catch(() => {});
  try { await task; }
  catch { throw new ChroniclesSaveError('Não foi possível salvar Crônicas da Aliança. Verifique o espaço e o armazenamento do navegador.'); }
}
export async function resetGame(slot: SaveSlot = 1): Promise<void> {
  await pending;
  try { await del('meta', slotKey(SAVE_KEY, slot)); }
  catch { throw new ChroniclesSaveError('Não foi possível apagar o progresso deste episódio. Tente novamente.'); }
}
export const waitForPilotWrites = () => pending;
