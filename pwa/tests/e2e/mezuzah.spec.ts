import { expect, test } from '@playwright/test';
import { finishOnboarding } from './helpers';

test('Ferramentas e Games preserva a memorização e abre o Mezuzá 3D local', async ({ page }) => {
  await finishOnboarding(page);
  await page.getByRole('button', { name: 'Ferramentas e Games' }).click();
  await expect(page.getByRole('heading', { name: 'Ferramentas e Games', level: 2 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Memorização' })).toBeVisible();
  await page.getByRole('button', { name: /Mezuzá 3D/ }).click();
  await expect(page.getByRole('heading', { name: 'Nova partida' })).toBeVisible();
  await expect(page.locator('#mezuzah-players')).toHaveValue('2');
  await page.getByRole('button', { name: 'Iniciar jornada' }).click();
  await expect(page.getByText('Classificação')).toBeVisible();
  await page.getByRole('button', { name: 'Lançar dado' }).click();
  await expect(page.getByRole('button', { name: 'Lançando dado…' })).toHaveCount(0, { timeout: 8_000 });
  await expect(page.getByText('Casa', { exact: false }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Ferramentas e Games' }).first().click();
  await expect(page.getByRole('heading', { name: 'Memorização' })).toBeVisible();
});

test('fluxo online informa que depende de um serviço e oferece sala por código', async ({ page }) => {
  await finishOnboarding(page);
  await page.getByRole('button', { name: 'Ferramentas e Games' }).click();
  await page.getByRole('button', { name: /Salas pela internet/ }).click();
  await expect(page.getByRole('heading', { name: 'Conectar ao servidor' })).toBeVisible();
  await expect(page.getByPlaceholder('wss://seu-servidor.example')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Criar sala' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Entrar na sala' })).toBeVisible();
});
