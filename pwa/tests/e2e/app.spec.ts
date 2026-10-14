// Fluxo principal no build de produção: dedicatória → configuração inicial → leitor.
import { expect, test } from '@playwright/test';
import { finishOnboarding, waitForVerses } from './helpers';

const DEDICATION = 'Em presente dedicatória à Rebeca Teles';

test('primeira abertura mostra a dedicatória e leva ao leitor', async ({ page }) => {
  await finishOnboarding(page);
  await waitForVerses(page);
  // Abertura seguinte vai direto ao leitor, sem repetir a introdução.
  await page.reload();
  await waitForVerses(page);
  await expect(page.getByText(DEDICATION)).toHaveCount(0);
});

test('dedicatória também em Configurações e pode ser reaberta', async ({ page }) => {
  await finishOnboarding(page);
  await page.getByRole('button', { name: 'Configurações', exact: true }).first().click();
  const settings = page.getByRole('dialog').last();
  await expect(settings.getByText(DEDICATION).first()).toBeAttached();
  await settings.getByText('Revisitar dedicatória', { exact: true }).first().click();
  await expect(page.getByText(DEDICATION).last()).toBeVisible();
});

test('pesquisa abre e encontra resultados', async ({ page }) => {
  await finishOnboarding(page);
  await page.getByRole('button', { name: 'Pesquisar', exact: true }).first().click();
  const box = page.getByRole('dialog').last().locator('input').first();
  await box.fill('graça');
  await expect(page.getByRole('dialog').last().locator('button, a, li').filter({ hasText: /gra[cç]a/i }).first()).toBeVisible({ timeout: 30_000 });
});
