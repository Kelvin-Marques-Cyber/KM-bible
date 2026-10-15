import { del, get, put } from '../../lib/db';
import { isGameState, type GameState } from './engine';

export const SAVE_KEY = 'chronicles:vale-coragem:v1';
type SaveEnvelope = { key: typeof SAVE_KEY; state: GameState; savedAt: string };
export class ChroniclesSaveError extends Error {
  constructor(message: string) { super(message); this.name = 'ChroniclesSaveError'; }
}
export async function loadGame(): Promise<GameState | null> {
  let value: unknown;
  try { value = await get<SaveEnvelope>('meta', SAVE_KEY); }
  catch { throw new ChroniclesSaveError('Não foi possível abrir o progresso de Crônicas da Aliança neste navegador.'); }
  if (value === undefined) return null;
  if (!value || typeof value !== 'object' || (value as SaveEnvelope).key !== SAVE_KEY || !isGameState((value as SaveEnvelope).state)) {
    throw new ChroniclesSaveError('O progresso de Crônicas da Aliança está incompatível ou danificado. Inicie um novo episódio para substituí-lo.');
  }
  return (value as SaveEnvelope).state;
}
export async function saveGame(state: GameState): Promise<void> {
  if (!isGameState(state)) throw new ChroniclesSaveError('O progresso não pôde ser salvo porque contém dados inválidos.');
  try { await put('meta', { key: SAVE_KEY, state, savedAt: new Date().toISOString() } satisfies SaveEnvelope); }
  catch { throw new ChroniclesSaveError('Não foi possível salvar Crônicas da Aliança. Verifique o espaço e o armazenamento do navegador.'); }
}
export async function resetGame(): Promise<void> {
  try { await del('meta', SAVE_KEY); }
  catch { throw new ChroniclesSaveError('Não foi possível apagar o progresso deste episódio. Tente novamente.'); }
}
