import { act, createElement, useSyncExternalStore } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CampaignChronicles from "../../src/games/chronicles/CampaignChronicles";
import { CampaignSaveError } from "../../src/games/chronicles/campaign-persistence";
import {
  emptyProgress,
  newJourney,
  progressWithJourney,
} from "../../src/games/chronicles/campaign-engine";
const sheetState = vi.hoisted(() => ({ sheets: [] as unknown[], revision: 0, listeners: new Set<() => void>() }));
const spies = vi.hoisted(() => ({
  canvas: vi.fn(),
  load: vi.fn(),
  save: vi.fn(),
  verse: vi.fn(),
  card: vi.fn(),
  passage: vi.fn(),
  message: vi.fn(),
  recover: vi.fn(),
  restart: vi.fn(),
  slots: vi.fn(),
  activate: vi.fn(),
  overwrite: vi.fn(),
}));
vi.mock("../../src/games/chronicles/campaign-persistence", () => ({
  loadCampaign: spies.load,
  saveCampaign: spies.save,
  CampaignSaveError: class extends Error {},
  exportCampaignArchive: vi.fn(),
  recoverCampaign: spies.recover,
  preserveAndRestartCampaign: spies.restart,
}));
vi.mock("../../src/games/chronicles/save-slots", () => ({
  readSaveSlots: spies.slots,
  activateSaveSlot: spies.activate,
  overwriteSaveSlot: spies.overwrite,
  exportSaveSlots: vi.fn(),
}));
vi.mock("../../src/games/chronicles/CampaignCanvas", () => ({
  default: (props: {
    onMove: (dx: number, dy: number, seconds: number, run: boolean) => void;
    paused: boolean;
  }) => {
    spies.canvas(props);
    return createElement(
      "div",
      {},
      createElement("canvas", { "aria-label": "Cenário pixel art", tabIndex: 0 }),
      createElement(
        "button",
        { onClick: () => props.onMove(1, 0, 0.05, false) },
        "Simular movimento",
      ),
    );
  },
}));
vi.mock("../../src/lib/app", () => ({
  app: { translation: "BLN4" },
  sheets: sheetState.sheets,
  useApp: () => useSyncExternalStore(listener => { sheetState.listeners.add(listener); return () => { sheetState.listeners.delete(listener); }; }, () => sheetState.revision),
}));
vi.mock("../../src/lib/content", () => ({ verse: spies.verse }));
vi.mock("../../src/screens/open", () => ({
  createCard: spies.card,
  showPassage: spies.passage,
}));
vi.mock("../../src/components/ui", () => ({
  message: spies.message,
  Spinner: () => null,
}));
let host: HTMLDivElement, root: Root;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.clearAllMocks();
  sheetState.sheets.length = 0;
  sheetState.revision = 0;
  // A abertura usa Canvas 2D real em produção; jsdom não implementa getContext.
  // O teste é de navegação/estado, não de pixels.
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  spies.load.mockResolvedValue(emptyProgress());
  spies.slots.mockResolvedValue({ active: 1, slots: [1,2,3].map(id => ({id,status:"empty",completed:0,chapter:"Nova jornada",kind:"campaign",hasPilot:false})) });
  spies.activate.mockResolvedValue(undefined);
  spies.overwrite.mockResolvedValue(undefined);
  spies.save.mockResolvedValue(undefined);
  spies.verse.mockResolvedValue({
    text: "No princípio criou Deus os céus e a terra.",
  });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.restoreAllMocks();
  vi.useRealTimers();
});
async function render() {
  await act(async () => {
    root.render(createElement(CampaignChronicles, { onBack: vi.fn() }));
  });
}
function click(text: string) {
  const b = [...host.querySelectorAll("button")].find(
    (el) =>
      el.textContent?.trim() === text || el.getAttribute("aria-label") === text,
  );
  expect(b, text).toBeDefined();
  act(() => b!.click());
}
function press(key: string, target: Element = document.activeElement ?? host) {
  act(() => target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true })));
}
function beginFirstChapter() {
  click("Aventuras");
  click("Escolher saga Origens e Promessa");
  click("Entrar na aventura");
  click("Iniciar exploração");
}
describe("36 aventuras: interface central", () => {
  it("abre bolsa, diário, mapa e códice como menus exclusivos, pausa a exploração e retoma com Esc", async () => {
    await render();
    beginFirstChapter();
    const canvas = host.querySelector("canvas")!;
    for (const [key, label] of [["i", "Inventário da jornada"], ["j", "Diário da jornada"], ["m", "Mapa da aventura"], ["c", "Códice de descobertas"]]) {
      press(key, canvas);
      expect(host.querySelectorAll('[role="dialog"]')).toHaveLength(1);
      const menu = host.querySelector<HTMLElement>(`[aria-label="${label}"]`)!;
      expect(menu.getAttribute("aria-modal")).toBe("true");
      expect(document.activeElement).toBe(menu);
      expect(spies.canvas.mock.calls.at(-1)?.[0].paused).toBe(true);
    }
    press("Escape");
    expect(host.querySelector('[role="dialog"]')).toBeNull();
    expect(spies.canvas.mock.calls.at(-1)?.[0].paused).toBe(false);
    press("Escape", canvas);
    expect(host.querySelector('[aria-label="Menu de pausa"]')).not.toBeNull();
    click("Tela de título");
    expect(host.querySelector('[aria-label="Menu principal do jogo"]')).not.toBeNull();
  });
  it("mantém atalhos fora de campos de edição e folhas do leitor, e prende Tab no menu", async () => {
    await render();
    beginFirstChapter();
    const input = document.createElement("input");
    host.querySelector(".ca-root")!.append(input);
    press("j", input);
    expect(host.querySelector('[role="dialog"]')).toBeNull();
    input.remove();
    const sheet = document.createElement("div");
    sheet.setAttribute("role", "dialog");
    sheet.setAttribute("aria-modal", "true");
    document.body.append(sheet);
    press("m", host.querySelector("canvas")!);
    expect(host.querySelector('[role="dialog"]')).toBeNull();
    sheet.remove();
    press("i", host.querySelector("canvas")!);
    const menu = host.querySelector('[aria-label="Inventário da jornada"]')!;
    const buttons = menu.querySelectorAll("button");
    act(() => buttons[buttons.length - 1].focus());
    press("Tab");
    expect(document.activeElement).toBe(buttons[0]);
    act(() => buttons[0].focus());
    act(() => buttons[0].dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true, cancelable: true })));
    expect(document.activeElement).toBe(buttons[buttons.length - 1]);
  });

  it("suspende o jogo com a folha bíblica aberta e devolve foco ao diário quando ela fecha", async () => {
    await render();
    beginFirstChapter();
    click("Abrir diário de missões");
    const trigger = Array.from(host.querySelectorAll("button")).find(button => button.textContent?.trim() === "Ler Gênesis 1:1–31")!;
    act(() => trigger.focus());
    click("Ler Gênesis 1:1–31");
    act(() => { sheetState.sheets.push({}); sheetState.revision++; sheetState.listeners.forEach(listener => listener()); });
    expect(spies.canvas.mock.calls.at(-1)?.[0].paused).toBe(true);
    press("Escape", host.querySelector("canvas")!);
    expect(host.querySelector('[aria-label="Diário da jornada"]')).not.toBeNull();
    act(() => { sheetState.sheets.length = 0; sheetState.revision++; sheetState.listeners.forEach(listener => listener()); });
    await act(async () => { await new Promise(resolve => requestAnimationFrame(resolve)); });
    expect(document.activeElement).toBe(trigger);
    expect(host.querySelector('[aria-label="Diário da jornada"]')).not.toBeNull();
  });
  it("mostra o RPG primeiro, usa conversa dentro do cenário e abre o diário apenas sob demanda", async () => {
    await render();
    expect(host.querySelector('[aria-label="Menu principal do jogo"]')).not.toBeNull();
    expect(host.querySelector(".gf-chapter-pin")).toBeNull();
    click("Aventuras");
    expect(host.querySelectorAll(".gf-region-pin")).toHaveLength(6);
    click("Escolher saga Origens e Promessa");
    expect(host.querySelectorAll(".gf-chapter-pin")).toHaveLength(6);
    click("Entrar na aventura");
    expect(host.querySelector(".ca-playing")).not.toBeNull();
    expect(host.querySelector(".ca-journal")).toBeNull();
    expect(host.querySelector(".ca-canvas [role=dialog]")?.getAttribute("aria-label")).toBe("Introdução da aventura");
    expect(host.querySelector(".ca-canvas.ca-has-dialog")).not.toBeNull();
    click("Iniciar exploração");
    expect(host.querySelector(".ca-canvas [role=dialog]")).toBeNull();
    click("Abrir diário de missões");
    expect(host.querySelector('[aria-label="Diário da jornada"]')).not.toBeNull();
    click("Fechar diário de missões");
    expect(host.querySelector(".ca-journal")).toBeNull();
    click("Códice 0/3");
    expect(host.querySelector('[aria-label="Códice de descobertas"]')).not.toBeNull();
    click("Voltar ao cenário");
    expect(host.querySelector('[aria-label="Códice de descobertas"]')).toBeNull();
  });
  it("exibe menu de pausa no próprio cenário e retorna à exploração", async () => {
    await render();
    click("Aventuras");
    click("Escolher saga Origens e Promessa");
    click("Entrar na aventura");
    click("Iniciar exploração");
    click("Pausar");
    expect(host.querySelector('[aria-label="Menu de pausa"]')).not.toBeNull();
    expect(host.querySelector('.ca-canvas.ca-has-dialog')).not.toBeNull();
    click("Retomar jornada");
    expect(host.querySelector('[aria-label="Menu de pausa"]')).toBeNull();
  });
  it("oferece seis sagas, seis capítulos por saga e o piloto independente", async () => {
    await render();
    expect(host.textContent).toContain("0/36");
    expect(host.textContent).toContain("O Vale e a Coragem");
    expect(host.querySelectorAll(".gf-chapter-pin")).toHaveLength(0);
    click("Aventuras");
    expect(host.querySelectorAll(".gf-region-pin")).toHaveLength(6);
    const titles = new Set<string>();
    for (let i=0; i<6; i++) {
      const region=host.querySelectorAll<HTMLButtonElement>(".gf-region-pin")[i];
      act(() => region.click());
      expect(host.querySelectorAll(".gf-chapter-pin")).toHaveLength(6);
      for (const chapter of host.querySelectorAll(".gf-chapter-pin small"))
        titles.add(chapter.textContent!);
      click("Atlas das sagas");
    }
    expect(titles.size).toBe(36);
    click("Escolher saga Testemunhas e Esperança");
    click("Explorar A Cidade da Esperança");
    click("Entrar na aventura");
    expect(
      host.querySelector("[role=dialog]")?.getAttribute("aria-label"),
    ).toBe("Introdução da aventura");
    click("Iniciar exploração");
    expect(host.querySelector("[role=dialog]")).toBeNull();
    expect(host.querySelector("canvas")).not.toBeNull();
    press("m", host.querySelector("canvas")!);
    await act(async () => { click("Mapa de aventuras"); });
    expect(host.querySelectorAll(".gf-region-pin")).toHaveLength(6);
  });
  it("retoma capítulo, posição e diálogo já salvo sem reapresentar a introdução", async () => {
    const journey = {
      ...newJourney("creation"),
      introduced: true,
      x: 5,
      y: 6,
      visited: [0],
      dialogue: 0,
    };
    spies.load.mockResolvedValue({
      ...progressWithJourney(emptyProgress(), journey),
      activeEpisodeId: "creation",
    });
    await render();
    expect(host.querySelector('[aria-label="Menu principal do jogo"]')).not.toBeNull();
    expect(host.querySelector('[role=dialog]')).toBeNull();
    click("Continuar");
    await act(async () => { click("Selecionar save 1"); });
    expect(host.querySelector("[role=dialog]")?.textContent).toContain(
      "O firmamento",
    );
    click("Registrar e continuar");
    click("Códice 1/3");
    expect(host.textContent).toContain("O texto distingue a expansão dos céus");
    await act(async () => {
      click("Ler Gênesis 1:1–31");
    });
    expect(spies.passage).toHaveBeenCalledWith(
      {
        book: 1,
        chapter: 1,
        verse: 1,
      },
      { end: { book: 1, chapter: 1, verse: 31 } },
    );
  });
  it("usa texto instalado para cartão e mantém respostas sem avaliações automáticas", async () => {
    spies.load.mockResolvedValue({
      ...progressWithJourney(emptyProgress(), {
        ...newJourney("creation"),
        introduced: true,
      }),
      activeEpisodeId: "creation",
    });
    await render();
    click("Continuar");
    await act(async () => { click("Selecionar save 1"); });
    // O botão faz parte do diário recolhível; primeiro abra-o, como um jogador.
    click("Abrir diário de missões");
    expect(host.querySelector('[aria-label="Diário da jornada"]')).not.toBeNull();
    await act(async () => {
      click("Criar cartão de memorização");
      click("Criar cartão de memorização");
    });
    expect(spies.verse).toHaveBeenCalledTimes(1);
    expect(spies.card).toHaveBeenCalledWith(
      { book: 1, chapter: 1, verse: 1 },
      "No princípio criou Deus os céus e a terra.",
    );
  });
  it("preserva save inválido e não grava progresso vazio sobre ele", async () => {
    spies.load.mockRejectedValue(
      new Error("Progresso danificado. Nenhum dado foi apagado."),
    );
    await render();
    expect(host.querySelector("[role=alert]")?.textContent).toContain(
      "Nenhum dado foi apagado",
    );
    expect(host.querySelector(".gf-chapter-pin")).toBeNull();
    expect(spies.save).not.toHaveBeenCalled();
  });
  it("mantém checkpoint a cada cinco segundos durante movimento contínuo e salva ao ocultar", async () => {
    vi.useFakeTimers();
    await render();
    click("Aventuras");
    click("Escolher saga Origens e Promessa");
    click("Entrar na aventura");
    await act(async () => {
      click("Iniciar exploração");
    });
    const before = spies.save.mock.calls.length;
    for (let i = 0; i < 52; i++)
      await act(async () => {
        click("Simular movimento");
        await vi.advanceTimersByTimeAsync(100);
      });
    expect(spies.save.mock.calls.length).toBeGreaterThan(before);
    const saved = spies.save.mock.calls.at(-1)![0];
    expect(saved.episodes.creation.steps).toBeGreaterThanOrEqual(45);
    await act(async () => {
      click("Simular movimento");
    });
    const hidden = vi.spyOn(document, "hidden", "get").mockReturnValue(true);
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(spies.save.mock.calls.at(-1)![0].episodes.creation.steps).toBe(53);
    hidden.mockRestore();
  }, 10000);
  it("oferece recuperação explícita do backup sem começar uma jornada vazia", async () => {
    const error = Object.assign(new CampaignSaveError("Save danificado"), {
      recoverable: true,
    });
    spies.load.mockRejectedValue(error);
    const restored = {
      ...progressWithJourney(emptyProgress(), {
        ...newJourney("garden"),
        introduced: true,
      }),
      activeEpisodeId: "garden",
    };
    spies.recover.mockResolvedValue(restored);
    await render();
    expect(host.textContent).toContain("Recuperar cópia de segurança");
    expect(spies.save).not.toHaveBeenCalled();
    await act(async () => {
      click("Recuperar cópia de segurança");
    });
    expect(spies.recover).toHaveBeenCalledTimes(1);
    click("Aventuras");
    click("Escolher saga Origens e Promessa");
    click("Continuar O Jardim e a Escolha");
    click("Continuar capítulo");
    expect(host.textContent).toContain("O Jardim e a Escolha");
    expect(host.querySelector('[role="alert"]')).toBeNull();
  });
});
