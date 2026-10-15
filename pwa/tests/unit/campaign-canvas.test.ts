import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CampaignCanvas from "../../src/games/chronicles/CampaignCanvas";
import {
  CAMPAIGN_EPISODES,
  newJourney,
} from "../../src/games/chronicles/campaign-engine";
import { CampaignAudio } from "../../src/games/chronicles/campaign-audio";
import {
  episodePassage,
  memoryReference,
} from "../../src/games/chronicles/campaign-bible";
const { draw, reset } = vi.hoisted(() => ({ draw: vi.fn(), reset: vi.fn() }));
vi.mock("../../src/games/chronicles/campaign-renderer", () => ({
  SCENE_WIDTH: 480,
  SCENE_HEIGHT: 270,
  CampaignRenderer: class {
    draw = draw;
    reset = reset;
  },
}));
let root: Root, host: HTMLDivElement;
let sequence = 0;
const frames = new Map<number, FrameRequestCallback>();
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.clearAllMocks();
  frames.clear();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
    {} as CanvasRenderingContext2D,
  );
  vi.stubGlobal("requestAnimationFrame", (fn: FrameRequestCallback) => {
    frames.set(++sequence, fn);
    return sequence;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
function frame(t: number) {
  const callbacks = [...frames.values()];
  frames.clear();
  act(() => {
    for (const fn of callbacks) fn(t);
  });
}
function key(el: Element, type: "keydown" | "keyup", value: string) {
  act(() =>
    el.dispatchEvent(
      new KeyboardEvent(type, { key: value, bubbles: true, cancelable: true }),
    ),
  );
}
function setup(extra: Partial<Parameters<typeof CampaignCanvas>[0]> = {}) {
  const props = {
    episode: CAMPAIGN_EPISODES[0],
    game: newJourney("creation"),
    paused: false,
    input: { dx: 0, dy: 0, run: false },
    onMove: vi.fn(),
    onInteract: vi.fn(),
    ...extra,
  };
  act(() => root.render(createElement(CampaignCanvas, props)));
  return { props, canvas: host.querySelector("canvas")! };
}
describe("Canvas das aventuras: entradas, foco e recursos", () => {
  it("WASD e setas só movem no cenário focado; Shift corre e E/Enter interagem uma vez", () => {
    const { props, canvas } = setup();
    frame(100);
    key(document.body, "keydown", "d");
    frame(116);
    expect(props.onMove).not.toHaveBeenCalled();
    act(() => canvas.focus());
    key(canvas, "keydown", "d");
    key(canvas, "keydown", "Shift");
    frame(132);
    expect(props.onMove).toHaveBeenLastCalledWith(1, 0, 0.016, true);
    key(canvas, "keydown", "e");
    key(canvas, "keydown", "Enter");
    expect(props.onInteract).toHaveBeenCalledTimes(2);
    key(canvas, "keyup", "d");
    frame(148);
    expect(props.onMove).toHaveBeenCalledTimes(1);
  });
  it("limpa teclas ao pausar e ao perder foco, e impede investigação durante pausa", () => {
    const { props, canvas } = setup();
    act(() => canvas.focus());
    frame(100);
    key(canvas, "keydown", "a");
    frame(116);
    expect(props.onMove).toHaveBeenCalledTimes(1);
    act(() =>
      root.render(createElement(CampaignCanvas, { ...props, paused: true })),
    );
    frame(132);
    key(canvas, "keydown", "e");
    expect(props.onInteract).not.toHaveBeenCalled();
    act(() => root.render(createElement(CampaignCanvas, props)));
    frame(148);
    expect(props.onMove).toHaveBeenCalledTimes(1);
    key(canvas, "keydown", "w");
    act(() => canvas.blur());
    frame(164);
    expect(props.onMove).toHaveBeenCalledTimes(1);
  });
  it("combina toque, interrompe frames quando oculto e libera renderer ao sair", () => {
    const { props } = setup({ input: { dx: 1, dy: 0, run: false } });
    frame(100);
    frame(116);
    expect(props.onMove).toHaveBeenCalledTimes(1);
    const hidden = vi.spyOn(document, "hidden", "get").mockReturnValue(true);
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(frames.size).toBe(0);
    hidden.mockReturnValue(false);
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(frames.size).toBe(1);
    frame(200);
    expect(props.onMove).toHaveBeenCalledTimes(1);
    act(() => root.unmount());
    root = createRoot(host);
    expect(reset).toHaveBeenCalledTimes(1);
    expect(frames.size).toBe(0);
  });
  it("prévia decorativa não captura teclado nem cria parada de foco", () => {
    const { canvas, props } = setup({ decorative: true });
    expect(canvas.tabIndex).toBe(-1);
    act(() => canvas.focus());
    key(canvas, "keydown", "e");
    frame(100);
    frame(116);
    expect(props.onMove).not.toHaveBeenCalled();
    expect(props.onInteract).not.toHaveBeenCalled();
  });
  it("abre o intervalo completo e mantém o versículo escolhido para memorização", () => {
    const ruth = CAMPAIGN_EPISODES.find((e) => e.id === "ruth")!;
    expect(episodePassage(ruth)).toEqual({
      start: { book: 8, chapter: 1, verse: 6 },
      end: { book: 8, chapter: 1, verse: 22 },
    });
    expect(memoryReference(ruth)).toEqual({ book: 8, chapter: 1, verse: 16 });
  });
});

describe("Áudio original opcional", () => {
  it("não cria contexto automaticamente e cancela notas/timer ao pausar ou sair", async () => {
    vi.useFakeTimers();
    const param = {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      oscillators: any[] = [];
    const context = {
      state: "suspended",
      currentTime: 0,
      destination: {},
      resume: vi.fn(async () => {
        context.state = "running";
      }),
      suspend: vi.fn(async () => {
        context.state = "suspended";
      }),
      close: vi.fn(async () => {
        context.state = "closed";
      }),
      createOscillator: vi.fn(() => {
        const osc = {
          frequency: param,
          connect: vi.fn(),
          disconnect: vi.fn(),
          start: vi.fn(),
          stop: vi.fn(),
          onended: null,
        };
        oscillators.push(osc);
        return osc;
      }),
      createGain: vi.fn(() => ({
        gain: param,
        connect: vi.fn(),
        disconnect: vi.fn(),
      })),
    };
    const factory = vi.fn(function () {
      return context;
    });
    vi.stubGlobal("AudioContext", factory);
    const sound = new CampaignAudio();
    expect(factory).not.toHaveBeenCalled();
    expect(await sound.enable()).toBe(true);
    sound.setActive(true, 1);
    await Promise.resolve();
    expect(vi.getTimerCount()).toBe(1);
    sound.cue("discovery");
    expect(oscillators).toHaveLength(4);
    sound.setActive(false);
    await Promise.resolve();
    expect(vi.getTimerCount()).toBe(0);
    expect(context.suspend).toHaveBeenCalled();
    sound.setActive(true);
    sound.close();
    await Promise.resolve();
    expect(vi.getTimerCount()).toBe(0);
    expect(context.close).toHaveBeenCalledTimes(1);
  });
});
