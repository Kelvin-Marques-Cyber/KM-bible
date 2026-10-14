import { expect, type Page } from '@playwright/test';

/** Primeira abertura: dedicatória → configuração inicial → leitor. */
export async function finishOnboarding(page: Page) {
  await page.goto('./');
  const dedication = page.getByText('Em presente dedicatória à Rebeca Teles');
  await expect(dedication).toBeVisible();
  await page.getByRole('button', { name: /continuar/i }).click();
  await page.getByRole('button', { name: /começar a ler/i }).click();
  await expect(page.getByRole('navigation', { name: 'Áreas' })).toBeVisible();
}

/** Espera o capítulo atual ser exibido (algum versículo renderizado). */
export async function waitForVerses(page: Page) {
  await expect(page.locator('[data-ref]').first()).toBeVisible();
}
