import { expect, test } from '@playwright/test';
import { finishOnboarding } from './helpers';

test('Ferramentas e Games preserva a memorização e abre o Mezuzá 3D local', async ({ page }) => {
  await finishOnboarding(page);
  await page.getByRole('button', { name: 'Ferramentas e Games' }).click();
  await expect(page.getByRole('heading', { name: 'Ferramentas e Games', level: 2 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Memorização' })).toBeVisible();
  await page.getByRole('button', { name: /Mezuzá 3D/ }).click();
  await expect(page.getByRole('heading', { name: 'Nova partida' })).toBeVisible();
  await expect(page.locator('#mezuzah-classic-players')).toHaveValue('2');
  await expect(page.getByRole('button', { name: 'Iniciar partida clássica' })).toBeEnabled();
  await expect(page.getByRole('spinbutton', { name: 'Passos até a estrela', exact: true })).toHaveValue('12');
  await expect(page.getByRole('spinbutton', { name: 'Passos na volta da estrela', exact: true })).toHaveValue('12');
  await page.getByRole('spinbutton', { name: 'Passos até a estrela', exact: true }).fill('');
  await expect(page.getByRole('button', { name: 'Iniciar partida clássica' })).toBeDisabled();
  await page.getByRole('spinbutton', { name: 'Passos até a estrela', exact: true }).fill('3');
  await page.getByRole('spinbutton', { name: 'Passos na volta da estrela', exact: true }).fill('3');
  await page.getByRole('button', { name: 'Iniciar partida clássica' }).click();
  await expect(page.getByRole('heading', { name: 'Vez de Equipe 1' })).toBeVisible();
  await expect(page.getByText('Leitor à direita:', { exact: false })).toContainText('Equipe 2');
  await page.getByRole('button', { name: 'Comprar cartão', exact: true }).click();
  await expect(page.getByText('Equipe 1, escolha um número de 1 a 10.')).toBeVisible();
  await page.getByRole('button', { name: '1', exact: true }).click();
  await expect(page.getByText('Desafio individual · sem repasse', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Confirmar acerto de Equipe 1', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Vez de Equipe 2' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Lançar dado/ })).toHaveCount(0);
  await page.reload();
  await page.getByRole('button', { name: 'Ferramentas e Games' }).click();
  await page.getByRole('button', { name: /Mezuzá 3D/ }).click();
  await expect(page.getByRole('heading', { name: 'Vez de Equipe 2' })).toBeVisible();
  await expect(page.getByText('Equipe 1: +1 passo', { exact: false })).toHaveCount(1);
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
