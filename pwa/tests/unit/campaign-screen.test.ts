import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CampaignChronicles from "../../src/games/chronicles/CampaignChronicles";
import { CampaignSaveError } from "../../src/games/chronicles/campaign-persistence";
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
  recover: vi.fn(),
  restart: vi.fn(),
}));
vi.mock("../../src/games/chronicles/campaign-persistence", () => ({
  loadCampaign: spies.load,
  saveCampaign: spies.save,
  CampaignSaveError: class extends Error {},
  exportCampaignArchive: vi.fn(),
  recoverCampaign: spies.recover,
  preserveAndRestartCampaign: spies.restart,
}));
vi.mock("../../src/games/chronicles/CampaignCanvas", () => ({
  default: (props: {
    onMove: (dx: number, dy: number, seconds: number, run: boolean) => void;
  }) =>
    createElement(
      "div",
      {},
      createElement("canvas", { "aria-label": "Cenário pixel art" }),
      createElement(
        "button",
        { onClick: () => props.onMove(1, 0, 0.05, false) },
        "Simular movimento",
      ),
    ),
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
describe("36 aventuras: interface central", () => {
  it("mostra o RPG primeiro, usa conversa dentro do cenário e abre o diário apenas sob demanda", async () => {
    await render();
    expect(host.querySelector('[aria-label="Menu principal do jogo"]')).not.toBeNull();
    expect(host.querySelector(".ca-chapter")).toBeNull();
    click("Nova jornada");
    expect(host.querySelectorAll(".ca-saga")).toHaveLength(6);
    click("Escolher saga Origens e Promessa");
    expect(host.querySelectorAll(".ca-chapter")).toHaveLength(6);
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
  it("oferece seis sagas, seis capítulos por saga e o piloto independente", async () => {
    await render();
    expect(host.textContent).toContain("0/36");
    expect(host.textContent).toContain("O Vale e a Coragem");
    expect(host.querySelectorAll(".ca-chapter")).toHaveLength(0);
    click("Nova jornada");
    expect(host.querySelectorAll(".ca-saga")).toHaveLength(6);
    const titles = new Set<string>();
    for (let i=0; i<6; i++) {
      const region=host.querySelectorAll<HTMLButtonElement>(".ca-saga")[i];
      act(() => region.click());
      expect(host.querySelectorAll(".ca-chapter")).toHaveLength(6);
      for (const chapter of host.querySelectorAll(".ca-chapter small"))
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
    expect(host.querySelector(".ca-chapter")).toBeNull();
    expect(spies.save).not.toHaveBeenCalled();
  });
  it("mantém checkpoint a cada cinco segundos durante movimento contínuo e salva ao ocultar", async () => {
    await render();
    await act(async () => {
      click("Nova jornada");
      click("Escolher saga Origens e Promessa");
      click("Entrar na aventura");
    });
    await act(async () => {
      click("Iniciar exploração");
    });
    const before = spies.save.mock.calls.length;
    for (let i = 0; i < 52; i++)
      await act(async () => {
        click("Simular movimento");
        await new Promise((resolve) => setTimeout(resolve, 100));
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
    expect(host.textContent).toContain("O Jardim e a Escolha");
    expect(host.querySelector('[role="alert"]')).toBeNull();
  });
});
