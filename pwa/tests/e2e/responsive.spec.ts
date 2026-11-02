// Responsividade real: menu de versões no desktop e barra inferior em telas de 320 px.
import { expect, test } from '@playwright/test';
import { finishOnboarding, waitForVerses } from './helpers';

const inside = async (page: import('@playwright/test').Page, selector: string) =>
  page.locator(selector).first().evaluate((el) => {
    const r = el.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + Math.min(40, r.width / 2), r.top + 12);
    return { left: r.left, right: r.right, bottom: r.bottom, vw: innerWidth, vh: innerHeight, visible: !!hit && el.contains(hit), inBody: el.parentElement === document.body };
  });

for (const viewport of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }]) {
  test.describe(`desktop ${viewport.width}px`, () => {
    test.use({ viewport, isMobile: false, hasTouch: false });
    test('menu de versões aparece inteiro, sem ser recortado pela barra', async ({ page }) => {
      await finishOnboarding(page);
      await waitForVerses(page);
      await page.locator('button[aria-haspopup="menu"]').click();
      await expect(page.getByRole('menu')).toBeVisible();
      const box = await inside(page, '[role=menu]');
      expect(box.inBody).toBe(true);
      expect(box.visible).toBe(true);
      expect(box.left).toBeGreaterThanOrEqual(0);
      expect(box.right).toBeLessThanOrEqual(box.vw);
      expect(box.bottom).toBeLessThanOrEqual(box.vh);
      const last = page.getByRole('menuitemradio').last();
      await last.scrollIntoViewIfNeeded();
      await expect(last).toBeInViewport();
      await page.keyboard.press('Escape');
      await expect(page.getByRole('menu')).toHaveCount(0);
    });
  });
}

test.describe('celular de 320 px', () => {
  test.use({ viewport: { width: 320, height: 640 } });
  test('barra de áreas cabe na tela, sem rolagem horizontal', async ({ page }) => {
    await finishOnboarding(page);
    await waitForVerses(page);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    const nav = await page.getByRole('navigation', { name: 'Áreas' }).evaluate((el) => {
      const items = [...el.querySelectorAll('button')].map((button) => button.getBoundingClientRect());
      return { right: Math.max(...items.map((r) => r.right)), vw: innerWidth };
    });
    expect(nav.right).toBeLessThanOrEqual(nav.vw);
  });
});
