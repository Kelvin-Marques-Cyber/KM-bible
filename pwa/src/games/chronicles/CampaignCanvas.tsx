import { useEffect, useRef } from "react";
import type { ChronicleEpisode } from "./campaign-content";
import type { JourneyState } from "./campaign-engine";
import {
  CampaignRenderer,
  SCENE_HEIGHT,
  SCENE_WIDTH,
} from "./campaign-renderer";

type Props = {
  episode: ChronicleEpisode;
  game: JourneyState;
  paused: boolean;
  input: { dx: number; dy: number; run: boolean };
  onMove: (dx: number, dy: number, seconds: number, run: boolean) => void;
  onInteract: () => void;
  decorative?: boolean;
};
/** Cached procedural art at 30 fps; simulation is independent and pauses when hidden. */
export default function CampaignCanvas(props: Props) {
  const canvas = useRef<HTMLCanvasElement>(null),
    frame = useRef(0),
    latest = useRef(props);
  latest.current = props;
  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const ctx = el.getContext("2d", { alpha: false });
    if (!ctx) return;
    const renderer = new CampaignRenderer(),
      keys = new Set<string>();
    const media = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    let running = true,
      previous = 0,
      drawAt = -100,
      wasPaused = false,
      wasFocused = false,
      frozenAt = 0,
      lastDrawnState: JourneyState | null = null;
    const clear = () => {
      keys.clear();
      previous = 0;
    };
    const down = (event: KeyboardEvent) => {
      if (
        document.activeElement !== el ||
        latest.current.decorative ||
        latest.current.paused ||
        document.hidden
      )
        return;
      const key = event.key.toLowerCase();
      if (
        [
          "arrowleft",
          "arrowright",
          "arrowup",
          "arrowdown",
          "w",
          "a",
          "s",
          "d",
          "e",
          "enter",
          " ",
          "shift",
        ].includes(key)
      )
        event.preventDefault();
      if (key === "e" || key === "enter") {
        if (!event.repeat) latest.current.onInteract();
        return;
      }
      keys.add(key);
    };
    const up = (event: KeyboardEvent) => keys.delete(event.key.toLowerCase());
    const tick = (now: number) => {
      if (!running) return;
      const p = latest.current,
        paused = p.paused || document.hidden,
        focused = document.activeElement === el;
      if ((paused && !wasPaused) || (!focused && wasFocused)) clear();
      if (paused && !wasPaused) frozenAt = now;
      if (!paused) frozenAt = 0;
      wasPaused = paused;
      wasFocused = focused;
      const dt = previous ? Math.min((now - previous) / 1000, 0.05) : 0;
      previous = now;
      if (!paused && !p.decorative) {
        const dx =
          Number(keys.has("arrowright") || keys.has("d")) -
          Number(keys.has("arrowleft") || keys.has("a")) +
          p.input.dx;
        const dy =
          Number(keys.has("arrowdown") || keys.has("s")) -
          Number(keys.has("arrowup") || keys.has("w")) +
          p.input.dy;
        if ((dx || dy) && dt > 0)
          p.onMove(dx, dy, dt, keys.has("shift") || p.input.run);
      }
      // On pause/menus the world becomes still: avoid redrawing at 30 FPS
      // behind a dialogue, which drains battery on installed mobile PWAs.
      const needsPaint =
        !paused ? now - drawAt >= 33.3 :
          lastDrawnState !== p.game || now - drawAt >= 1000;
      if (!document.hidden && needsPaint) {
        renderer.draw(ctx, p.episode, p.game, paused ? frozenAt : now, !!media?.matches);
        lastDrawnState = p.game;
        drawAt = now;
      }
      frame.current = requestAnimationFrame(tick);
    };
    const visibility = () => {
      clear();
      if (document.hidden) cancelAnimationFrame(frame.current);
      else {
        drawAt = -100;
        frame.current = requestAnimationFrame(tick);
      }
    };
    el.addEventListener("keydown", down);
    el.addEventListener("keyup", up);
    el.addEventListener("blur", clear);
    window.addEventListener("blur", clear);
    document.addEventListener("visibilitychange", visibility);
    frame.current = requestAnimationFrame(tick);
    return () => {
      running = false;
      cancelAnimationFrame(frame.current);
      renderer.reset();
      el.removeEventListener("keydown", down);
      el.removeEventListener("keyup", up);
      el.removeEventListener("blur", clear);
      window.removeEventListener("blur", clear);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);
  return (
    <canvas
      ref={canvas}
      width={SCENE_WIDTH}
      height={SCENE_HEIGHT}
      tabIndex={props.decorative ? -1 : 0}
      role={props.decorative ? "img" : "application"}
      aria-hidden={props.decorative || undefined}
      aria-label={
        props.decorative
          ? undefined
          : "RPG pixel art — " +
            props.episode.title +
            ". Mova com setas ou WASD; interaja com E perto dos três marcos."
      }
      data-player-x={props.game.x.toFixed(3)}
      data-player-y={props.game.y.toFixed(3)}
      className="h-full w-full rounded-xl bg-[#253934] outline-offset-2 focus-visible:outline-2 focus-visible:outline-[#f3d48c]"
      style={{ imageRendering: "pixelated", objectFit: "contain" }}
      onPointerDown={(event) => {
        if (!props.decorative)
          event.currentTarget.focus({ preventScroll: true });
      }}
    />
  );
}
