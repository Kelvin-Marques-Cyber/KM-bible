import { expect, test, type Page } from "@playwright/test";
import { finishOnboarding } from "./helpers";

type SavedEpisode = {
  x: number;
  y: number;
  mapId: string;
  flags: string[];
  dialogue: { id: string } | null;
};

async function savedEpisode(page: Page): Promise<SavedEpisode | null> {
  return page.evaluate(
    () =>
      new Promise((resolve) => {
        const request = indexedDB.open("km-bible");
        request.onerror = () => resolve(null);
        request.onsuccess = () => {
          const db = request.result;
          const read = db
            .transaction("meta", "readonly")
            .objectStore("meta")
            .get("chronicles:vale-coragem:v1");
          read.onsuccess = () => {
            resolve(read.result?.state ?? null);
            db.close();
          };
          read.onerror = () => {
            resolve(null);
            db.close();
          };
        };
      }),
  );
}

async function openEpisode(page: Page, resume = false) {
  await page
    .getByRole("button", { name: "Ferramentas e Games", exact: true })
    .click();
  await page
    .getByRole("button", { name: /RPG bíblico 2D.*Crônicas da Aliança/ })
    .click();
  await expect(
    page.getByRole("heading", { name: "Crônicas da Aliança", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Menu principal do jogo" })).toBeVisible();
  if (resume) {
    await page.getByRole("button", { name: "Continuar", exact: true }).click();
    await page.getByRole("button", { name: "Selecionar save 1", exact: true }).click();
  } else await page.getByRole("button", { name: /^O Vale e a Coragem/ }).click();
}

test("piloto renderiza, conversa, pausa, salva e retoma offline sem afetar Memorização", async ({
  page,
  context,
}) => {
  const browserErrors: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  await finishOnboarding(page);
  await openEpisode(page);
  await expect(
    page.getByText("Escritura e ficção complementar", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Começar episódio", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Conversa com Crônicas da Aliança" }),
  ).toContainText("testemunha fictícia");
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  const canvas = page.getByRole("application", {
    name: /Crônicas da Aliança — Povoado das oliveiras/,
  });
  await expect(canvas).toBeVisible();
  await expect
    .poll(() =>
      canvas.evaluate((element) => {
        const context = (element as HTMLCanvasElement).getContext("2d")!;
        const data = context.getImageData(
          0,
          0,
          context.canvas.width,
          context.canvas.height,
        ).data;
        const colors = new Set<string>();
        for (let i = 0; i < data.length; i += 128)
          colors.add(`${data[i]},${data[i + 1]},${data[i + 2]}`);
        return colors.size;
      }),
    )
    .toBeGreaterThan(40);

  await canvas.focus();
  await page.keyboard.down("d");
  await page.waitForTimeout(1050);
  await page.keyboard.up("d");
  await expect
    .poll(async () => (await savedEpisode(page))?.x ?? 0)
    .toBeGreaterThan(8.5);
  await page.keyboard.press("e");
  await expect(
    page.getByRole("dialog", { name: /Conversa com Tirza/ }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Ajudar com a entrega", exact: true })
    .click();
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await expect
    .poll(
      async () =>
        (await savedEpisode(page))?.flags.includes("mission-accepted") ?? false,
    )
    .toBe(true);
  const beforePause = (await savedEpisode(page))!;
  await page.getByRole("button", { name: "Pausar", exact: true }).click();
  await canvas.focus();
  await page.keyboard.down("a");
  await page.waitForTimeout(350);
  await page.keyboard.up("a");
  expect((await savedEpisode(page))?.x).toBe(beforePause.x);
  await page.getByRole("button", { name: "Continuar", exact: true }).click();

  await page.getByRole("button", { name: "Inventário", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Bolsa de Neri" }),
  ).toContainText("Mapa do caminho");
  await page.keyboard.press("c");
  await expect(
    page.getByRole("dialog", { name: "Códice dos Testemunhos" }),
  ).toContainText("Ficção complementar");
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBe(true);

  await context.setOffline(true);
  await page.reload();
  await openEpisode(page, true);
  await expect(
    page.getByRole("button", { name: "Começar episódio", exact: true }),
  ).toHaveCount(0);
  await expect(canvas).toBeVisible();
  expect((await savedEpisode(page))?.flags).toContain("mission-accepted");
  await page.keyboard.press("Escape");
  await page.getByRole("dialog", { name: "Menu de pausa", exact: true })
    .getByRole("button", { name: "Mapa de aventuras", exact: true }).click();
  await page
    .getByRole("button", { name: "Voltar para Ferramentas e Games", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Memorização", exact: true }),
  ).toBeVisible();
  expect(browserErrors).toEqual([]);
});

test("controle por toque desloca Neri e solta a direção ao finalizar o gesto", async ({
  page,
}) => {
  await finishOnboarding(page);
  await openEpisode(page);
  await page
    .getByRole("button", { name: "Começar episódio", exact: true })
    .click();
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await expect.poll(async () => (await savedEpisode(page))?.x ?? 0).toBe(6.5);
  const right = page.getByRole("button", {
    name: "Caminhar para direita",
    exact: true,
  });
  await right.scrollIntoViewIfNeeded();
  const bounds = await right.boundingBox();
  expect(bounds).not.toBeNull();
  await page.mouse.move(
    bounds!.x + bounds!.width / 2,
    bounds!.y + bounds!.height / 2,
  );
  await page.mouse.down();
  await page.waitForTimeout(450);
  await page.mouse.up();
  await expect
    .poll(async () => (await savedEpisode(page))?.x ?? 0)
    .toBeGreaterThan(7.1);
  const afterRelease = (await savedEpisode(page))!.x;
  await page.waitForTimeout(500);
  expect((await savedEpisode(page))!.x).toBe(afterRelease);
});

test("piloto usa I/J/M/C e pausa sobre o mundo, sem mover Neri nos menus", async ({ page }) => {
  await finishOnboarding(page);
  await openEpisode(page);
  await page.getByRole("button", { name: "Começar episódio", exact: true }).click();
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  const canvas = page.getByRole("application", { name: /Crônicas da Aliança — Povoado das oliveiras/ });
  await canvas.focus();
  await expect.poll(async () => (await savedEpisode(page))?.x ?? null).toBe(6.5);
  const before = await savedEpisode(page);
  for (const [key, label] of [["i", "Bolsa de Neri"], ["j", "Diário de missões"], ["m", "Mapa do episódio"], ["c", "Códice dos Testemunhos"], ["Escape", "Menu de pausa"]]) {
    await page.keyboard.press(key);
    const overlay = page.getByRole("dialog", { name: label, exact: true });
    await expect(overlay).toBeVisible();
    await expect(overlay).toHaveAttribute("aria-modal", "true");
    expect(await overlay.evaluate(element => element.contains(document.activeElement))).toBe(true);
    await overlay.getByRole("button").last().focus();
    await page.keyboard.press("Tab");
    expect(await overlay.evaluate(element => element.contains(document.activeElement))).toBe(true);
    await overlay.getByRole("button").first().focus();
    await page.keyboard.press("Shift+Tab");
    expect(await overlay.evaluate(element => element.contains(document.activeElement))).toBe(true);
    await page.keyboard.down("d");
    await page.waitForTimeout(180);
    await page.keyboard.up("d");
    expect((await savedEpisode(page))?.x).toBe(before?.x);
    await page.keyboard.press("Escape");
    await expect(overlay).toHaveCount(0);
    await expect(canvas).toBeFocused();
  }
  await page.keyboard.press("c");
  const codex = page.getByRole("dialog", { name: "Códice dos Testemunhos", exact: true });
  await codex.getByRole("button", { name: "1 Samuel 17:17–22", exact: true }).click();
  const reader = page.getByRole("dialog").last();
  await expect(reader).toContainText("Samuel");
  await reader.getByRole("button", { name: "Fechar", exact: true }).last().click();
  await expect.poll(() => codex.evaluate(element => element.contains(document.activeElement))).toBe(true);
  await codex.getByRole("button", { name: "Memorizar passagem", exact: true }).first().click();
  const create = page.locator("form").last();
  await expect(create).toBeVisible();
  await create.getByRole("button", { name: /salvar|criar/i }).click();
  await expect.poll(() => codex.evaluate(element => element.contains(document.activeElement))).toBe(true);
  await page.keyboard.press("Escape");
  await page.keyboard.press("i");
  await page.keyboard.press("m");
  await expect(page.getByRole("dialog", { name: "Bolsa de Neri" })).toHaveCount(0);
  await expect(page.getByRole("dialog", { name: "Mapa do episódio" })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await page.getByRole("dialog", { name: "Menu de pausa" })
    .getByRole("button", { name: "Mapa de aventuras", exact: true }).click();
  await expect(page.getByRole("button", { name: /^Escolher saga / })).toHaveCount(6);
  expect((await savedEpisode(page))?.x).toBe(before?.x);
});
