import { expect, test, type Page } from "@playwright/test";
import {
  CAMPAIGN_EPISODES,
  CAMPAIGN_SAGAS,
} from "../../src/games/chronicles/campaign-content";
import { finishOnboarding, waitForVerses } from "./helpers";

async function openCampaigns(page: Page) {
  await page
    .getByRole("button", { name: "Ferramentas e Games", exact: true })
    .first()
    .click();
  await page
    .getByRole("button", { name: /RPG bíblico 2D.*Crônicas da Aliança/ })
    .click();
  await expect(
    page.getByRole("heading", { name: "Crônicas da Aliança", exact: true }),
  ).toBeVisible();
}
async function readSave(page: Page): Promise<any> {
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
            .get("chronicles:campaigns:v1");
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
async function moveAxis(page: Page, axis: "x" | "y", target: number) {
  const canvas = page.getByRole("application", { name: /RPG pixel art/ });
  await canvas.focus();
  const attr = "data-player-" + axis;
  const start = Number(await canvas.getAttribute(attr));
  if (Math.abs(start - target) < 0.25) return;
  const positive = target > start,
    key = axis === "x" ? (positive ? "d" : "a") : positive ? "s" : "w";
  await page.keyboard.down("Shift");
  await page.keyboard.down(key);
  try {
    await expect
      .poll(
        async () => {
          const value = Number(await canvas.getAttribute(attr));
          return positive ? value >= target - 0.35 : value <= target + 0.35;
        },
        { timeout: 12000, intervals: [20, 35, 50] },
      )
      .toBe(true);
  } finally {
    await page.keyboard.up(key);
    await page.keyboard.up("Shift");
  }
}
async function visit(page: Page, index: number) {
  const targets = [
    [5, 6],
    [16.5, 4.7],
    [29, 7],
  ];
  await moveAxis(page, "x", targets[index][0]);
  await moveAxis(page, "y", targets[index][1]);
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
  await expect(page.locator(".ca-saga")).toHaveCount(6);
  await expect(page.locator(".ca-chapter")).toHaveCount(6);
  // The SW precaches every JS journey, including chapters not opened yet.
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBe(true);
  await context.setOffline(true);
  await page.reload();
  await openCampaigns(page);
  await page
    .getByRole("button", { name: "Explorar O Primeiro Alvorecer", exact: true })
    .click();
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
        page.getByRole("region", {
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
  await expect(page.locator(".ca-total strong")).toHaveText("36/36");
  for (const saga of CAMPAIGN_SAGAS)
    await expect(
      page.getByRole("progressbar", {
        name: "Progresso de " + saga.title,
        exact: true,
      }),
    ).toHaveAttribute("value", "6");
  await page.reload();
  await openCampaigns(page);
  await expect(page.locator(".ca-total strong")).toHaveText("36/36");
  expect(errors).toEqual([]);
});

test("save exato, diálogo aberto, pausa, controles móveis e retomada após fechar a área", async ({
  page,
}) => {
  await finishOnboarding(page);
  await openCampaigns(page);
  await page
    .getByRole("button", { name: "Explorar O Primeiro Alvorecer", exact: true })
    .click();
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
  await expect(
    page.getByRole("dialog", { name: "Testemunho descoberto", exact: true }),
  ).toBeVisible();
  expect((await readSave(page)).episodes.creation).toEqual(
    save.episodes.creation,
  );
  await page
    .getByRole("button", { name: "Registrar e continuar", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Ferramentas e Games", exact: true })
    .first()
    .click();
  await openCampaignsFromHome(page);
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
  await page
    .getByRole("button", { name: "Explorar O Primeiro Alvorecer", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Iniciar exploração", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Ler Gênesis 1:1–31", exact: true })
    .click();
  await expect(page.locator("[role=dialog]").last()).toContainText("Gênesis");
  await page
    .getByRole("button", { name: /fechar|voltar/i })
    .last()
    .click();
  await page
    .getByRole("button", { name: "Criar cartão de memorização", exact: true })
    .click();
  await expect(page.locator("textarea")).toHaveCount(0);
  const create = page.locator("form").last();
  await expect(create).toContainText(/princípio|princípio|beginning/i);
  await create.getByRole("button", { name: /salvar|criar/i }).click();
  await page
    .getByRole("button", { name: "Ferramentas e Games", exact: true })
    .first()
    .click();
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
  await page
    .getByRole("button", { name: "Explorar O Primeiro Alvorecer", exact: true })
    .click();
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
  await openCampaigns(page);
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
