import { expect, test, type Page } from '@playwright/test';
import { finishOnboarding } from './helpers';

type SavedEpisode = { x: number; y: number; mapId: string; flags: string[]; dialogue: { id: string } | null };

async function savedEpisode(page: Page): Promise<SavedEpisode | null> {
  return page.evaluate(() => new Promise(resolve => {
    const request = indexedDB.open('km-bible');
    request.onerror = () => resolve(null);
    request.onsuccess = () => {
      const db = request.result;
      const read = db.transaction('meta', 'readonly').objectStore('meta').get('chronicles:vale-coragem:v1');
      read.onsuccess = () => { resolve(read.result?.state ?? null); db.close(); };
      read.onerror = () => { resolve(null); db.close(); };
    };
  }));
}

async function openEpisode(page: Page) {
  await page.getByRole('button', { name: 'Ferramentas e Games', exact: true }).click();
  await page.getByRole('button', { name: /RPG bíblico 2D.*Crônicas da Aliança/ }).click();
  await expect(page.getByRole('heading', { name: 'Crônicas da Aliança', exact: true })).toBeVisible();
}

test('piloto renderiza, conversa, pausa, salva e retoma offline sem afetar Memorização', async ({ page, context }) => {
  const browserErrors: string[] = [];
  page.on('pageerror', error => browserErrors.push(error.message));
  await finishOnboarding(page);
  await openEpisode(page);
  await expect(page.getByText('Escritura e ficção complementar', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Começar episódio', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Conversa com Crônicas da Aliança' })).toContainText('testemunha fictícia');
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  const canvas = page.getByRole('application', { name: /Crônicas da Aliança — Povoado das oliveiras/ });
  await expect(canvas).toBeVisible();
  await expect.poll(() => canvas.evaluate(element => {
    const context = (element as HTMLCanvasElement).getContext('2d')!;
    const data = context.getImageData(0, 0, context.canvas.width, context.canvas.height).data;
    const colors = new Set<string>();
    for (let i = 0; i < data.length; i += 128) colors.add(`${data[i]},${data[i + 1]},${data[i + 2]}`);
    return colors.size;
  })).toBeGreaterThan(40);

  await canvas.focus();
  await page.keyboard.down('d');
  await page.waitForTimeout(1050);
  await page.keyboard.up('d');
  await expect.poll(async () => (await savedEpisode(page))?.x ?? 0).toBeGreaterThan(8.5);
  await page.keyboard.press('e');
  await expect(page.getByRole('dialog', { name: /Conversa com Tirza/ })).toBeVisible();
  await page.getByRole('button', { name: 'Ajudar com a entrega', exact: true }).click();
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await expect.poll(async () => (await savedEpisode(page))?.flags.includes('mission-accepted') ?? false).toBe(true);
  const beforePause = (await savedEpisode(page))!;
  await page.getByRole('button', { name: 'Pausar', exact: true }).click();
  await canvas.focus();
  await page.keyboard.down('a'); await page.waitForTimeout(350); await page.keyboard.up('a');
  expect((await savedEpisode(page))?.x).toBe(beforePause.x);
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();

  await page.getByRole('button', { name: 'Inventário', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Bolsa de Neri' })).toContainText('Mapa do caminho');
  await page.getByRole('button', { name: 'Códice', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Códice dos Testemunhos' })).toContainText('Ficção complementar');
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

  await context.setOffline(true);
  await page.reload();
  await openEpisode(page);
  await expect(page.getByRole('button', { name: 'Começar episódio', exact: true })).toHaveCount(0);
  await expect(canvas).toBeVisible();
  expect((await savedEpisode(page))?.flags).toContain('mission-accepted');
  await page.getByRole('button', { name: 'Ferramentas e Games', exact: true }).first().click();
  await expect(page.getByRole('heading', { name: 'Memorização', exact: true })).toBeVisible();
  expect(browserErrors).toEqual([]);
});

test('controle por toque desloca Neri e solta a direção ao finalizar o gesto', async ({ page }) => {
  await finishOnboarding(page);
  await openEpisode(page);
  await page.getByRole('button', { name: 'Começar episódio', exact: true }).click();
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await expect.poll(async () => (await savedEpisode(page))?.x ?? 0).toBe(6.5);
  const right = page.getByRole('button', { name: 'Caminhar para direita', exact: true });
  await right.scrollIntoViewIfNeeded();
  const bounds = await right.boundingBox();
  expect(bounds).not.toBeNull();
  await page.mouse.move(bounds!.x + bounds!.width / 2, bounds!.y + bounds!.height / 2);
  await page.mouse.down(); await page.waitForTimeout(450); await page.mouse.up();
  await expect.poll(async () => (await savedEpisode(page))?.x ?? 0).toBeGreaterThan(7.1);
  const afterRelease = (await savedEpisode(page))!.x;
  await page.waitForTimeout(500);
  expect((await savedEpisode(page))!.x).toBe(afterRelease);
});
