import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CampaignChronicles from "../../src/games/chronicles/CampaignChronicles";
import {
  emptyProgress,
  newJourney,
  progressWithJourney,
} from "../../src/games/chronicles/campaign-engine";
const spies = vi.hoisted(() => ({
  load: vi.fn(),
  save: vi.fn(),
  verse: vi.fn(),
  card: vi.fn(),
  passage: vi.fn(),
  message: vi.fn(),
}));
vi.mock("../../src/games/chronicles/campaign-persistence", () => ({
  loadCampaign: spies.load,
  saveCampaign: spies.save,
  CampaignSaveError: class extends Error {},
  exportCampaignArchive: vi.fn(),
  recoverCampaign: vi.fn(),
  preserveAndRestartCampaign: vi.fn(),
}));
vi.mock("../../src/games/chronicles/CampaignCanvas", () => ({
  default: () => createElement("canvas", { "aria-label": "Cenário pixel art" }),
}));
vi.mock("../../src/lib/app", () => ({ app: { translation: "BLN4" } }));
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
  spies.load.mockResolvedValue(emptyProgress());
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
describe("36 aventuras: interface central", () => {
  it("oferece seis sagas, seis capítulos por saga e o piloto independente", async () => {
    await render();
    expect(host.querySelectorAll(".ca-saga")).toHaveLength(6);
    expect(host.querySelectorAll(".ca-chapter")).toHaveLength(6);
    expect(host.textContent).toContain("0/36");
    expect(host.textContent).toContain("O Vale e a Coragem");
    const titles = new Set<string>();
    for (const saga of host.querySelectorAll<HTMLButtonElement>(".ca-saga")) {
      act(() => saga.click());
      for (const chapter of host.querySelectorAll(".ca-chapter h4"))
        titles.add(chapter.textContent!);
    }
    expect(titles.size).toBe(36);
    click("Explorar A Cidade da Esperança");
    expect(
      host.querySelector("[role=dialog]")?.getAttribute("aria-label"),
    ).toBe("Introdução da aventura");
    click("Iniciar exploração");
    expect(host.querySelector("[role=dialog]")).toBeNull();
    expect(host.querySelector("canvas")).not.toBeNull();
    await act(async () => {
      click("Mapa de aventuras");
    });
    expect(host.querySelectorAll(".ca-saga")).toHaveLength(6);
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
    expect(host.querySelector(".ca-chapter")).toBeNull();
    expect(spies.save).not.toHaveBeenCalled();
  });
});
