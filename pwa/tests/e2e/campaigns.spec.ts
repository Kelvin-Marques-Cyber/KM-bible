import { expect, test, type Page } from "@playwright/test";
import {
  CAMPAIGN_EPISODES,
  CAMPAIGN_SAGAS,
} from "../../src/games/chronicles/campaign-content";
import { finishOnboarding, waitForVerses } from "./helpers";

async function openCampaigns(page: Page, recovery = false) {
  await page
    .getByRole("button", { name: "Ferramentas e Games", exact: true })
    .first()
    .click();
  await page
    .getByRole("button", { name: /RPG bíblico 2D.*Crônicas da Aliança/ })
    .click();
  if (recovery) await expect(page.getByRole("alert")).toContainText("Nenhum dado foi apagado");
  else await expect(
    page.getByRole("heading", { name: "Crônicas da Aliança", exact: true }),
  ).toBeVisible();
}
async function startFirstAdventure(page: Page, slot = 1) {
  // Enter a real save book before opening the campaign atlas.
  await page.getByRole("button", { name: "Novo jogo", exact: true }).click();
  await expect(page.getByRole("region", { name: "Espaços de save" })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Selecionar save [123]$/ })).toHaveCount(3);
  await page.getByRole("button", { name: `Selecionar save ${slot}`, exact: true }).click();
  await page.getByRole("button", { name: "Escolher saga Origens e Promessa", exact: true }).click();
  await page.getByRole("button", { name: "Entrar na aventura", exact: true }).click();
}
async function continueAdventure(page: Page, slot = 1) {
  await expect(page.getByRole("navigation", { name: "Menu principal do jogo" })).toBeVisible();
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.getByRole("button", { name: `Selecionar save ${slot}`, exact: true }).click();
}
async function returnToTitle(page: Page) {
  // Close a currently open book before requesting the pause menu.
  for (let attempt = 0; attempt < 4; attempt++) {
    if (await page.getByRole("dialog", { name: "Menu de pausa", exact: true }).isVisible()) break;
    await page.keyboard.press("Escape");
  }
  await page.getByRole("dialog", { name: "Menu de pausa", exact: true })
    .getByRole("button", { name: "Tela de título", exact: true }).click();
  await expect(page.getByRole("navigation", { name: "Menu principal do jogo" })).toBeVisible();
}
async function leaveCampaign(page: Page) {
  await returnToTitle(page);
  await page.getByRole("button", { name: "Voltar para Ferramentas e Games", exact: true }).click();
}
async function readSave(page: Page, slot = 1): Promise<any> {
  return page.evaluate(
    (id) =>
      new Promise((resolve) => {
        const request = indexedDB.open("km-bible");
        request.onerror = () => resolve(null);
        request.onsuccess = () => {
          const db = request.result;
          const key = "chronicles:campaigns:v1" + (id === 1 ? "" : `:slot:${id}`);
          const read = db.transaction("meta", "readonly").objectStore("meta").get(key);
          read.onsuccess = () => { resolve(read.result?.state ?? null); db.close(); };
          read.onerror = () => { resolve(null); db.close(); };
        };
      }),
    slot,
  );
}
async function moveAxis(page: Page, axis: "x" | "y", target: number) {
  const canvas = page.getByRole("application", { name: /RPG pixel art/ });
  await canvas.focus();
  const attr = "data-player-" + axis;
  // Trace/screenshot capture can delay key-up. Approach in two stages and
  // correct overshoot with real keys instead of assuming a fixed event latency.
  for (let attempt = 0; attempt < 6; attempt++) {
    const start = Number(await canvas.getAttribute(attr));
    const delta = target - start;
    if (Math.abs(delta) <= 0.65) return;
    const positive = delta > 0,
      run = Math.abs(delta) > 4;
    const aim = run ? target - Math.sign(delta) * 2 : target;
    const key = axis === "x" ? (positive ? "d" : "a") : positive ? "s" : "w";
    if (run) await page.keyboard.down("Shift");
    await page.keyboard.down(key);
    try {
      await expect
        .poll(
          async () => {
            const value = Number(await canvas.getAttribute(attr));
            return positive ? value >= aim - 0.25 : value <= aim + 0.25;
          },
          { timeout: 12000, intervals: [20, 35, 50] },
        )
        .toBe(true);
    } finally {
      await page.keyboard.up(key);
      if (run) await page.keyboard.up("Shift");
    }
  }
  expect(
    Math.abs(Number(await canvas.getAttribute(attr)) - target),
    `Chegada ao eixo ${axis}=${target}`,
  ).toBeLessThanOrEqual(0.65);
}

async function visit(page: Page, index: number) {
  const targets = [
    [5, 6],
    [16.5, 4.7],
    [29, 7],
  ];
  await moveAxis(page, "x", targets[index][0]);
  await moveAxis(page, "y", targets[index][1]);
  const canvas = page.getByRole("application", { name: /RPG pixel art/ });
  const x = Number(await canvas.getAttribute("data-player-x")),
    y = Number(await canvas.getAttribute("data-player-y"));
  expect(
    Math.hypot(x - targets[index][0], y - targets[index][1]),
    `Proximidade real ao marco ${index + 1}`,
  ).toBeLessThan(2.6);
  await page.keyboard.press("e");
  const dialog = page.getByRole("dialog", {
    name: "Testemunho descoberto",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  await dialog
    .getByRole("button", { name: "Registrar e continuar", exact: true })
    .click();
}

test("todas as 36 aventuras: teclado real, três descobertas, erro/acerto, avanço e 36/36 offline", async ({
  page,
  context,
}) => {
  test.setTimeout(600000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await finishOnboarding(page);
  await waitForVerses(page);
  await openCampaigns(page);
  await expect(page.getByRole("navigation", {name: "Menu principal do jogo"})).toBeVisible();
  // The SW precaches every JS journey, including chapters not opened yet.
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBe(true);
  await context.setOffline(true);
  await page.reload();
  await openCampaigns(page);
  await startFirstAdventure(page);
  for (const episode of CAMPAIGN_EPISODES) {
    await test.step(`${episode.number}: ${episode.title}`, async () => {
      const intro = page.getByRole("dialog", {
        name: "Introdução da aventura",
        exact: true,
      });
      await expect(intro).toContainText(episode.title);
      await intro
        .getByRole("button", { name: "Iniciar exploração", exact: true })
        .click();
      const canvas = page.getByRole("application", { name: /RPG pixel art/ });
      await expect(canvas).toBeVisible();
      // A real painted scene, rather than a canvas placeholder.
      if (episode.number % 6 === 1)
        expect(
          await canvas.evaluate((element) => {
            const ctx = (element as HTMLCanvasElement).getContext("2d")!,
              pixels = ctx.getImageData(0, 0, 480, 270).data,
              colors = new Set<string>();
            for (let i = 0; i < pixels.length; i += 64)
              colors.add(`${pixels[i]},${pixels[i + 1]},${pixels[i + 2]}`);
            return colors.size;
          }),
        ).toBeGreaterThan(60);
      for (let i = 0; i < 3; i++) await visit(page, i);
      const challenge = page.getByRole("dialog", {
        name: "Desafio de conhecimento bíblico",
        exact: true,
      });
      await expect(challenge).toContainText(episode.trial.prompt);
      if (episode.number === 1) {
        await challenge
          .getByRole("button", { name: "Consultar passagem", exact: true })
          .click();
        const reader = page.getByRole("dialog").last();
        await expect(reader.getByText("1:31", { exact: true })).toBeVisible();
        await reader
          .getByRole("button", { name: "Fechar", exact: true })
          .last()
          .click();
        await expect(challenge).toBeVisible();
        await expect(page.getByRole("dialog", { name: "Menu de pausa", exact: true })).toHaveCount(0);
      }
      const wrong = (episode.trial.correct + 1) % 3;
      await challenge
        .getByRole("button", {
          name:
            String.fromCharCode(65 + wrong) +
            ". " +
            episode.trial.choices[wrong],
          exact: true,
        })
        .click();
      await expect(challenge.getByRole("status")).toContainText("Ainda não");
      await challenge
        .getByRole("button", { name: "Rever descobertas", exact: true })
        .click();
      await expect(
        page.getByRole("dialog", {
          name: "Códice de descobertas",
          exact: true,
        }),
      ).toContainText(episode.stations[0].discovery);
      await page
        .getByRole("button", { name: "Voltar ao cenário", exact: true })
        .click();
      await challenge
        .getByRole("button", {
          name:
            String.fromCharCode(65 + episode.trial.correct) +
            ". " +
            episode.trial.choices[episode.trial.correct],
          exact: true,
        })
        .click();
      const ending = page.getByRole("dialog", {
        name: "Conclusão da aventura",
        exact: true,
      });
      await expect(ending).toContainText(episode.ending);
      await expect
        .poll(async () => {
          const save = await readSave(page);
          return save?.episodes[episode.id]?.phase;
        })
        .toBe("complete");
      expect((await readSave(page)).completed).toHaveLength(episode.number);
      if (episode.number % 6 === 0)
        console.info(
          `Saga ${episode.saga + 1}: ${episode.number}/36 aventuras concluídas offline.`,
        );
      if (episode.number < 36)
        await ending
          .getByRole("button", { name: "Próximo capítulo", exact: true })
          .click();
      else
        await ending
          .getByRole("button", { name: "Voltar ao mapa", exact: true })
          .click();
    });
  }
  await expect(page.locator(".gf-progress")).toContainText("36/36");
  for (const saga of CAMPAIGN_SAGAS) {
    const region = page.getByRole("button", { name: "Escolher saga " + saga.title, exact: true });
    await expect(region).toContainText("6/6 testemunhos");
  }
  await page.reload();
  await openCampaigns(page);
  await expect(page.locator(".gf-progress")).toContainText("36/36");
  expect(errors).toEqual([]);
});

test("save exato, diálogo aberto, pausa, controles móveis e retomada após fechar a área", async ({
  page,
}) => {
  await finishOnboarding(page);
  await openCampaigns(page);
  await startFirstAdventure(page);
  await page
    .getByRole("button", { name: "Iniciar exploração", exact: true })
    .click();
  const canvas = page.getByRole("application", { name: /RPG pixel art/ });
  const right = page.getByRole("button", {
    name: "Caminhar para direita",
    exact: true,
  });
  await right.scrollIntoViewIfNeeded();
  const bounds = (await right.boundingBox())!;
  await page.mouse.move(
    bounds.x + bounds.width / 2,
    bounds.y + bounds.height / 2,
  );
  await page.mouse.down();
  await page.waitForTimeout(400);
  await page.mouse.up();
  await expect
    .poll(async () => Number(await canvas.getAttribute("data-player-x")))
    .toBeGreaterThan(18);
  const stopped = Number(await canvas.getAttribute("data-player-x"));
  await page.waitForTimeout(200);
  expect(Number(await canvas.getAttribute("data-player-x"))).toBe(stopped);
  await page.getByRole("button", { name: "Pausar", exact: true }).click();
  await canvas.focus();
  await page.keyboard.down("a");
  await page.waitForTimeout(200);
  await page.keyboard.up("a");
  expect(Number(await canvas.getAttribute("data-player-x"))).toBe(stopped);
  await page
    .getByRole("button", { name: "Retomar jornada", exact: true })
    .click();
  await moveAxis(page, "x", 5);
  await moveAxis(page, "y", 6);
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("dialog", { name: "Testemunho descoberto", exact: true }),
  ).toBeVisible();
  await expect
    .poll(async () => (await readSave(page))?.episodes.creation.dialogue)
    .toBe(0);
  const save = await readSave(page);
  await page.reload();
  await openCampaigns(page);
  await expect(page.getByRole("application", { name: /RPG pixel art/ })).toHaveCount(0);
  await continueAdventure(page);
  await expect(
    page.getByRole("dialog", { name: "Testemunho descoberto", exact: true }),
  ).toBeVisible();
  expect((await readSave(page)).episodes.creation).toEqual(
    save.episodes.creation,
  );
  await page
    .getByRole("button", { name: "Registrar e continuar", exact: true })
    .click();
  await leaveCampaign(page);
  await openCampaignsFromHome(page);
  await continueAdventure(page);
  await expect(canvas).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Códice 1/3", exact: true }),
  ).toBeVisible();
});
async function openCampaignsFromHome(page: Page) {
  await page
    .getByRole("button", { name: /RPG bíblico 2D.*Crônicas da Aliança/ })
    .click();
}

test("leitor e cartão usam a tradução instalada, com revisão preservada na Memorização", async ({
  page,
}) => {
  await finishOnboarding(page);
  // Onboarding may install another translation; find the actual selected label from the UI after opening the passage.
  await openCampaigns(page);
  await startFirstAdventure(page);
  await page
    .getByRole("button", { name: "Iniciar exploração", exact: true })
    .click();
  await page.getByRole("button", { name: "Abrir diário de missões", exact: true }).click();
  const journal = page.getByRole("dialog", { name: "Diário da jornada", exact: true });
  await page
    .getByRole("button", { name: "Ler Gênesis 1:1–31", exact: true })
    .click();
  const reader = page.getByRole("dialog").last();
  await expect(reader).toContainText("Gênesis");
  await expect.poll(() => reader.evaluate(element => element.contains(document.activeElement))).toBe(true);
  await reader.getByRole("button", { name: "Fechar", exact: true }).last().click();
  await expect.poll(() => journal.evaluate(element => element.contains(document.activeElement))).toBe(true);
  await page
    .getByRole("button", { name: "Criar cartão de memorização", exact: true })
    .click();
  await expect(page.locator("textarea")).toHaveCount(0);
  const create = page.locator("form").last();
  await expect(create).toContainText(/princípio|princípio|beginning/i);
  await expect.poll(() => page.getByRole("dialog").last().evaluate(element => element.contains(document.activeElement))).toBe(true);
  await create.getByRole("button", { name: /salvar|criar/i }).click();
  await expect.poll(() => journal.evaluate(element => element.contains(document.activeElement))).toBe(true);
  await leaveCampaign(page);
  await page
    .getByRole("button", { name: /^Memorização.*Abrir meus cartões/ })
    .click();
  await expect(
    page.getByText(/No princípio|In the beginning/i).first(),
  ).toBeVisible();
});

test("save danificado oferece recuperação sem apagar a cópia anterior", async ({
  page,
}) => {
  await finishOnboarding(page);
  await openCampaigns(page);
  await startFirstAdventure(page);
  await page
    .getByRole("button", { name: "Iniciar exploração", exact: true })
    .click();
  await moveAxis(page, "x", 19);
  await page.getByRole("button", { name: "Pausar", exact: true }).click();
  await expect
    .poll(async () => (await readSave(page))?.episodes.creation.x ?? 0)
    .toBeGreaterThan(18);
  const backup = await page.evaluate(
    () =>
      new Promise<any>((resolve) => {
        const request = indexedDB.open("km-bible");
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction("meta", "readwrite"),
            store = tx.objectStore("meta");
          const backup = store.get("chronicles:campaigns:v1:backup");
          let state: any;
          backup.onsuccess = () => {
            state = backup.result?.state;
            store.put({
              key: "chronicles:campaigns:v1",
              state: { version: 99 },
            });
          };
          tx.oncomplete = () => {
            db.close();
            resolve(state);
          };
        };
      }),
  );
  expect(backup).toBeTruthy();
  await page.reload();
  await openCampaigns(page, true);
  await expect(page.getByRole("alert")).toContainText(
    "Nenhum dado foi apagado",
  );
  await page
    .getByRole("button", { name: "Recuperar cópia de segurança", exact: true })
    .click();
  await expect.poll(() => readSave(page)).toEqual(backup);
  const preserved = await page.evaluate(
    () =>
      new Promise<any>((resolve) => {
        const request = indexedDB.open("km-bible");
        request.onsuccess = () => {
          const db = request.result;
          const read = db
            .transaction("meta", "readonly")
            .objectStore("meta")
            .get("chronicles:campaigns:v1:preserved");
          read.onsuccess = () => {
            db.close();
            resolve(read.result?.envelope?.state);
          };
        };
      }),
  );
  expect(preserved).toEqual({ version: 99 });
});

test("título, três saves independentes e sobrescrita com cópia preservada", async ({ page }) => {
  await finishOnboarding(page);
  await openCampaigns(page);
  const menu = page.getByRole("navigation", { name: "Menu principal do jogo" });
  for (const name of ["Continuar", "Novo jogo", "Aventuras", "Códice", "Configurações", "Voltar"])
    await expect(menu.getByRole("button", { name, exact: true })).toBeVisible();
  await expect(menu.getByRole("button", { name: "Continuar", exact: true })).toBeDisabled();
  await expect(page.getByRole("application", { name: /RPG pixel art/ })).toHaveCount(0);

  await startFirstAdventure(page);
  await page.getByRole("button", { name: "Iniciar exploração", exact: true }).click();
  await moveAxis(page, "x", 19);
  await returnToTitle(page);
  await expect.poll(async () => (await readSave(page))?.episodes.creation.x ?? 0).toBeGreaterThan(18);
  const first = await readSave(page);
  expect(first.episodes.creation.x).toBeGreaterThan(18);

  await page.getByRole("button", { name: "Novo jogo", exact: true }).click();
  await page.getByRole("button", { name: "Selecionar save 1", exact: true }).click();
  const confirmation = page.getByRole("alertdialog", { name: "Confirmar sobrescrita do save" });
  await expect(confirmation).toBeVisible();
  await confirmation.getByRole("button", { name: "Manter meu save", exact: true }).click();
  expect(await readSave(page)).toEqual(first);
  await page.getByRole("button", { name: "Selecionar save 2", exact: true }).click();
  await page.getByRole("button", { name: `Escolher saga ${CAMPAIGN_SAGAS[1].title}`, exact: true }).click();
  await page.getByRole("button", { name: "Entrar na aventura", exact: true }).click();
  await page.getByRole("button", { name: "Iniciar exploração", exact: true }).click();
  await returnToTitle(page);
  await expect.poll(async () => (await readSave(page, 2))?.activeEpisodeId).toBe(CAMPAIGN_EPISODES[6].id);
  const second = await readSave(page, 2);
  expect(second.activeEpisodeId).toBe(CAMPAIGN_EPISODES[6].id);
  expect(await readSave(page)).toEqual(first);
  expect(await readSave(page, 3)).toBeNull();

  await menu.getByRole("button", { name: "Continuar", exact: true }).click();
  const firstBook = page.getByRole("button", { name: "Selecionar save 1", exact: true });
  await expect(firstBook).toContainText(CAMPAIGN_EPISODES[0].title);
  await expect(firstBook).toContainText(CAMPAIGN_SAGAS[0].title);
  await expect(firstBook).toContainText("0/36");
  await expect(firstBook.locator("time")).toHaveAttribute("datetime", /\d{4}-\d{2}-\d{2}T/);
  await expect(page.getByRole("button", { name: "Selecionar save 3", exact: true })).toBeDisabled();
  await firstBook.click();
  const canvas = page.getByRole("application", { name: /RPG pixel art/ });
  await expect(canvas).toHaveAttribute("data-player-x", first.episodes.creation.x.toFixed(3));
  await returnToTitle(page);

  await menu.getByRole("button", { name: "Novo jogo", exact: true }).click();
  await page.getByRole("button", { name: "Selecionar save 1", exact: true }).click();
  await confirmation.getByRole("button", { name: "Confirmar sobrescrita", exact: true }).click();
  await expect(page.getByRole("button", { name: `Escolher saga ${CAMPAIGN_SAGAS[0].title}`, exact: true })).toBeVisible();
  expect((await readSave(page)).episodes).toEqual({});
  expect(await readSave(page, 2)).toEqual(second);
  const archived = await page.evaluate(() => new Promise<any[]>((resolve, reject) => {
    const request = indexedDB.open("km-bible");
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const read = db.transaction("meta", "readonly").objectStore("meta").getAll();
      read.onsuccess = () => { db.close(); resolve(read.result.filter(item => String(item.key).startsWith("chronicles:slots:v1:archive:1:"))); };
      read.onerror = () => { db.close(); reject(read.error); };
    };
  }));
  expect(archived).toHaveLength(1);
  expect(archived[0].entries.find((entry: any) => entry?.key === "chronicles:campaigns:v1").state).toEqual(first);
});

test("atalhos abrem overlays exclusivos, suspendem movimento e devolvem foco ao cenário", async ({ page }) => {
  await finishOnboarding(page);
  await openCampaigns(page);
  await startFirstAdventure(page);
  await page.getByRole("button", { name: "Iniciar exploração", exact: true }).click();
  const canvas = page.getByRole("application", { name: /RPG pixel art/ });
  const position = await canvas.getAttribute("data-player-x");
  await canvas.focus();
  for (const [key, name] of [["i", "Inventário da jornada"], ["j", "Diário da jornada"], ["m", "Mapa da aventura"], ["c", "Códice de descobertas"], ["Escape", "Menu de pausa"]]) {
    await page.keyboard.press(key);
    const overlay = page.getByRole("dialog", { name, exact: true });
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
    await expect(canvas).toHaveAttribute("data-player-x", position!);
    await page.keyboard.press("Escape");
    await expect(overlay).toHaveCount(0);
    await expect(canvas).toBeFocused();
  }
  await page.keyboard.press("i");
  await page.keyboard.press("j");
  await expect(page.getByRole("dialog", { name: "Inventário da jornada" })).toHaveCount(0);
  await expect(page.getByRole("dialog", { name: "Diário da jornada" })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await page.getByRole("dialog", { name: "Menu de pausa" })
    .getByRole("button", { name: "Voltar ao atlas", exact: true }).click();
  await expect(page.getByRole("button", { name: /^Escolher saga / })).toHaveCount(6);
  expect((await readSave(page)).activeEpisodeId).toBe("creation");
});

for (const viewport of [{ name: "retrato", width: 390, height: 844 }, { name: "paisagem", width: 844, height: 390 }, { name: "desktop", width: 1440, height: 900 }]) {
  test(`título, atlas e menus permanecem dentro da tela em ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await finishOnboarding(page);
    await openCampaigns(page);
    const stage = page.locator(".chronicles-viewport");
    const bounds = await stage.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(-1);
    expect(bounds!.y).toBeGreaterThanOrEqual(-1);
    expect(bounds!.width).toBeLessThanOrEqual(viewport.width + 1);
    expect(bounds!.height).toBeLessThanOrEqual(viewport.height + 1);
    await startFirstAdventure(page, 3);
    await page.getByRole("button", { name: "Iniciar exploração", exact: true }).click();
    await page.getByRole("button", { name: "Abrir diário de missões", exact: true }).click();
    const journal = page.getByRole("dialog", { name: "Diário da jornada", exact: true });
    await expect(journal).toBeVisible();
    const bookBounds = await journal.boundingBox();
    expect(bookBounds!.x).toBeGreaterThanOrEqual(-1);
    expect(bookBounds!.y).toBeGreaterThanOrEqual(-1);
    expect(bookBounds!.x + bookBounds!.width).toBeLessThanOrEqual(viewport.width + 1);
    expect(bookBounds!.y + bookBounds!.height).toBeLessThanOrEqual(viewport.height + 1);
    await journal.getByRole("button", { name: "Fechar diário de missões", exact: true }).click();
    await expect(page.getByRole("application", { name: /RPG pixel art/ })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}


test("consultar a passagem no desafio retorna à escolha sem abrir pausa", async ({ page }) => {
  await finishOnboarding(page);
  await waitForVerses(page);
  await openCampaigns(page);
  await startFirstAdventure(page);
  await page.getByRole("button", { name: "Iniciar exploração", exact: true }).click();
  for (let index = 0; index < 3; index++) await visit(page, index);
  const challenge = page.getByRole("dialog", { name: "Desafio de conhecimento bíblico", exact: true });
  await challenge.getByRole("button", { name: "Consultar passagem", exact: true }).click();
  const reader = page.getByRole("dialog").last();
  await expect(reader.getByText("1:31", { exact: true })).toBeVisible();
  await reader.getByRole("button", { name: "Fechar", exact: true }).last().click();
  await expect(challenge).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Menu de pausa", exact: true })).toHaveCount(0);
  await expect.poll(() => challenge.evaluate(element => element.contains(document.activeElement))).toBe(true);
  const episode = CAMPAIGN_EPISODES[0];
  await challenge.getByRole("button", { name: `${String.fromCharCode(65 + episode.trial.correct)}. ${episode.trial.choices[episode.trial.correct]}`, exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Conclusão da aventura", exact: true })).toBeVisible();
  await expect.poll(async () => (await readSave(page))?.episodes.creation.phase).toBe("complete");
});

test("tela cheia nativa preserva leitor e foco nas camadas do jogo", async ({ browser, baseURL }) => {
  // Native fullscreen is exercised in desktop Chromium rather than emulated mobile.
  const context = await browser.newContext({ baseURL, viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false, serviceWorkers: "allow" });
  const page = await context.newPage();
  try {
    await finishOnboarding(page);
    await waitForVerses(page);
    await openCampaigns(page);
    await page.getByRole("navigation", { name: "Menu principal do jogo" }).getByRole("button", { name: "Configurações", exact: true }).click();
    const fullscreenAvailable = await page.evaluate(() => document.fullscreenEnabled && typeof document.documentElement.requestFullscreen === "function");
    await page.getByRole("button", { name: "Tela cheia", exact: true }).click();
    if (fullscreenAvailable)
      await expect.poll(() => page.evaluate(() => document.fullscreenElement === document.documentElement)).toBe(true);
    await page.getByRole("button", { name: "Voltar ao menu", exact: true }).click();
    await startFirstAdventure(page);
    await page.getByRole("button", { name: "Iniciar exploração", exact: true }).click();
    await page.getByRole("button", { name: "Abrir diário de missões", exact: true }).click();
    const journal = page.getByRole("dialog", { name: "Diário da jornada", exact: true });
    await journal.getByRole("button", { name: "Ler Gênesis 1:1–31", exact: true }).click();
    const reader = page.getByRole("dialog").last();
    await expect(reader.getByText("1:31", { exact: true })).toBeVisible();
    await expect.poll(() => reader.evaluate(element => element.contains(document.activeElement))).toBe(true);
    for (let step = 0; step < 6; step++) {
      await page.keyboard.press("Tab");
      expect(await reader.evaluate(element => element.contains(document.activeElement))).toBe(true);
    }
    for (let step = 0; step < 6; step++) {
      await page.keyboard.press("Shift+Tab");
      expect(await reader.evaluate(element => element.contains(document.activeElement))).toBe(true);
    }
    if (fullscreenAvailable)
      expect(await page.evaluate(() => document.fullscreenElement === document.documentElement)).toBe(true);
    await reader.getByRole("button", { name: "Fechar", exact: true }).last().click();
    await expect(journal).toBeVisible();
    await expect.poll(() => journal.evaluate(element => element.contains(document.activeElement))).toBe(true);
    await journal.getByRole("button", { name: "Fechar diário de missões", exact: true }).click();
    await expect(page.getByRole("application", { name: /RPG pixel art/ })).toBeFocused();
    if (fullscreenAvailable) {
      await page.evaluate(() => document.exitFullscreen());
      await expect.poll(() => page.evaluate(() => document.fullscreenElement === null)).toBe(true);
    }
  } finally {
    await context.close();
  }
});
