import type { ChronicleEpisode } from './campaign-content';

/** Decorative inhabitants add life without introducing fictitious biblical dialogue.
 * They do not alter the mission engine, collision, authored witnesses or saves.
 * Prologues (creation/garden) deliberately contain no imagined bystanders. */
export type AmbientActor = {
  kind: 'villager' | 'sheep';
  x: number; y: number;
  step: number; facing: -1 | 1;
  costume: string;
};
const POPULATED = new Set(['city', 'village', 'fields', 'palace', 'temple', 'egypt', 'upper']);
const PASTORAL = new Set(['fields', 'village', 'mountain', 'desert']);
const CLOTHES = ['#758e90', '#bd9b76', '#899e76', '#8987a2', '#b48166', '#879f95'];

export function ambientActors(episode: Pick<ChronicleEpisode, 'id' | 'saga' | 'setting'>, elapsedMs: number, reducedMotion = false): AmbientActor[] {
  const time = reducedMotion ? 0 : Math.max(0, elapsedMs);
  const actors: AmbientActor[] = [];
  const allowedPeople = episode.id !== 'creation' && episode.id !== 'garden' && POPULATED.has(episode.setting);
  if (allowedPeople) {
    for (let i = 0; i < 3; i++) {
      // Stay away from the three testimony stations and the player's entry.
      const y = 164 + (i % 2) * 45;
      const center = i === 1 ? 384 : (i === 0 ? 105 : 343);
      const phase = (time / (3900 + i * 950)) + i * 2.2;
      const excursion = Math.sin(phase) * (13 + i * 3);
      actors.push({
        kind: 'villager',
        x: center + excursion,
        y,
        facing: Math.cos(phase) >= 0 ? 1 : -1,
        step: reducedMotion ? 0 : Math.floor(time / 180 + i * 3) % 4,
        costume: CLOTHES[(episode.saga + i) % CLOTHES.length],
      });
    }
  }
  if (PASTORAL.has(episode.setting) || episode.id === 'creation') {
    for (let i = 0; i < 2; i++) {
      const phase = time / 4900 + i * 1.9;
      actors.push({
        kind: 'sheep',
        x: (i ? 365 : 120) + Math.sin(phase) * 10,
        y: 226 + (i % 2) * 10,
        facing: Math.cos(phase) >= 0 ? 1 : -1,
        step: reducedMotion ? 0 : Math.floor(time / 240 + i) % 4,
        costume: '#d6caa7',
      });
    }
  }
  return actors;
}
