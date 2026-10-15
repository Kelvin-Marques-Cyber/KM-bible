import type { Ref } from "../../lib/domain";
import type { ChronicleEpisode } from "./campaign-content";
export const memoryReference = (episode: ChronicleEpisode): Ref => ({
  book: episode.reference.b,
  chapter: episode.reference.c,
  verse: episode.reference.v,
});
/** Displayed ranges open from their first verse; the memory anchor may be inside that range. */
export function episodePassage(episode: ChronicleEpisode): {
  start: Ref;
  end: Ref;
} {
  const r = episode.reference,
    range = r.label.match(/(\d+):(\d+)[–-](\d+)$/);
  const start = {
    book: r.b,
    chapter: r.c,
    verse: range ? Number(range[2]) : r.v,
  };
  return { start, end: { ...start, verse: range ? Number(range[3]) : r.v } };
}
