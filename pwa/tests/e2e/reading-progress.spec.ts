import { expect, test } from '@playwright/test';
import { finishOnboarding, waitForVerses } from './helpers';

test('marca capítulo e livro, retoma e conserva o progresso após abrir offline', async ({ page, context }) => {
  await finishOnboarding(page);
  await waitForVerses(page);
  const mark = page.getByRole('button', { name: 'Marcar capítulo como lido', exact: true });
  await mark.click();
  await expect(page.getByRole('button', { name: 'Capítulo lido', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Ver progresso na Bíblia', exact: true }).click();
  const sheet = page.getByRole('dialog').last();
  await expect(sheet.getByRole('progressbar', { name: 'Progresso da Bíblia', exact: true })).toHaveAttribute('value', '1');
  await sheet.getByRole('button', { name: 'Marcar livro como lido', exact: true }).click();
  await expect(sheet.getByRole('progressbar', { name: 'Progresso da Bíblia', exact: true })).toHaveAttribute('value', '21');
  await expect(sheet.getByRole('button', { name: 'Marcar como não lido: João 3', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await page.getByRole('button', { name: 'Ver progresso na Bíblia', exact: true }).click();
  const restored = page.getByRole('dialog').last();
  await expect(restored.getByRole('progressbar', { name: 'Progresso da Bíblia', exact: true })).toHaveAttribute('value', '21');
  await restored.getByRole('button', { name: 'Marcar como não lido: João 3', exact: true }).click();
  await expect(restored.getByRole('progressbar', { name: 'Progresso da Bíblia', exact: true })).toHaveAttribute('value', '20');
  await restored.getByRole('button', { name: 'Continuar leitura', exact: true }).click();
  await expect(page.getByRole('button', { name: 'João 3', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Marcar capítulo como lido', exact: true })).toBeVisible();
});
