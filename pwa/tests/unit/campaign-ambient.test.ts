import { describe, expect, it } from 'vitest';
import { CAMPAIGN_EPISODES } from '../../src/games/chronicles/campaign-content';
import { ambientActors } from '../../src/games/chronicles/campaign-ambient';

describe('Ambiência viva sem alterar o motor bíblico', () => {
  it('não inventa população humana nos prólogos da criação e do jardim', () => {
    for (const id of ['creation', 'garden']) {
      const episode = CAMPAIGN_EPISODES.find(e => e.id === id)!;
      expect(ambientActors(episode, 1200).some(actor => actor.kind === 'villager')).toBe(false);
    }
  });

  it('usa moradores móveis nos povoados e mantém seus percursos longe dos marcos', () => {
    const episode = CAMPAIGN_EPISODES.find(e => e.setting === 'city')!;
    const before = ambientActors(episode, 0);
    const later = ambientActors(episode, 4400);
    expect(before.filter(actor => actor.kind === 'villager')).toHaveLength(3);
    expect(before.map(actor => actor.x)).not.toEqual(later.map(actor => actor.x));
    for (const actor of later) {
      expect(actor.x).toBeGreaterThan(40);
      expect(actor.x).toBeLessThan(460);
      expect(actor.y).toBeGreaterThan(160);
    }
  });

  it('respeita movimento reduzido e não altera o estado do capítulo', () => {
    const episode = CAMPAIGN_EPISODES.find(e => e.setting === 'fields')!;
    const first = ambientActors(episode, 0, true);
    expect(ambientActors(episode, 250000, true)).toEqual(first);
    expect(first.filter(actor => actor.kind === 'sheep')).toHaveLength(2);
    expect(Object.keys(episode)).not.toContain('actors');
  });

  it('limita quantidade de atores em todas as 36 aventuras', () => {
    expect(CAMPAIGN_EPISODES).toHaveLength(36);
    for (const episode of CAMPAIGN_EPISODES) {
      const actors = ambientActors(episode, 8234);
      expect(actors.length).toBeLessThanOrEqual(5);
      expect(actors).toEqual(ambientActors(episode, 8234));
      expect(actors.every(actor => Number.isFinite(actor.x) && Number.isFinite(actor.y))).toBe(true);
    }
  });
});
