import { devices, expect, test, type Page } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { finishOnboarding } from './helpers';

const PORT = 8898;
const WS_URL = `ws://127.0.0.1:${PORT}`;
const HEALTH_URL = `http://127.0.0.1:${PORT}/health`;
const SERVER = fileURLToPath(new URL('../../../mezuzah-server/server.mjs', import.meta.url));
let service: ChildProcess | undefined;
let serverLog = '';

async function stopOwnServer() {
  const child = service;
  service = undefined;
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  const exited = once(child, 'exit');
  child.kill('SIGTERM');
  const forced = setTimeout(() => child.kill('SIGKILL'), 5000);
  try { await exited; } finally { clearTimeout(forced); }
}

test.beforeAll(async () => {
  // The process belongs exclusively to this file; never stop another local server.
  service = spawn(process.execPath, ['--experimental-strip-types', SERVER], {
    env: { ...process.env, PORT: String(PORT), ALLOWED_ORIGINS: 'http://localhost:4173,http://127.0.0.1:4173' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  service.stdout?.on('data', chunk => { serverLog += String(chunk); });
  service.stderr?.on('data', chunk => { serverLog += String(chunk); });
  service.on('error', error => { serverLog += error.message; });
  try {
    await expect.poll(async () => {
      if (service?.exitCode !== null && service?.exitCode !== undefined) throw new Error(`Servidor de teste encerrou: ${serverLog}`);
      if (!serverLog.includes('salas na porta ' + PORT)) return null;
      try {
        const response = await fetch(HEALTH_URL, { signal: AbortSignal.timeout(1000) });
        return response.ok ? (await response.json() as { rules?: string }).rules : null;
      } catch { return null; }
    }, { timeout: 15_000, message: 'Servidor WebSocket real deve responder /health' }).toBe('mezuzah-classic-v2');
  } catch (error) {
    await stopOwnServer();
    throw new Error(`${String(error)}\n${serverLog}`);
  }
});
test.afterAll(stopOwnServer);

async function openOnline(page: Page) {
  await page.getByRole('button', { name: 'Ferramentas e Games', exact: true }).first().click();
  await page.getByRole('button', { name: /Salas pela internet/ }).click();
  await expect(page.getByRole('heading', { name: 'Salas pela internet', exact: true })).toBeVisible();
}
function captureErrors(page: Page, label: string, errors: string[]) {
  page.on('pageerror', error => errors.push(`${label}: ${error.message}`));
  page.on('console', message => { if (message.type() === 'error') errors.push(`${label}: ${message.text()}`); });
  page.on('websocket', socket => socket.on('socketerror', error => errors.push(`${label}: ${error}`)));
}
async function expectRound(page: Page, round: number, team: string) {
  const turn = page.getByRole('region', { name: 'Turno do Mezuzá Clássico' });
  await expect(turn).toContainText(`Rodada ${round} · sentido horário`);
  await expect(turn.getByRole('heading', { name: `Vez de ${team}`, exact: true })).toBeVisible();
}
async function expectProgress(page: Page, team: string, steps: number) {
  const line = page.getByRole('listitem').filter({ has: page.locator('progress') }).filter({ hasText: team });
  await expect(line).toContainText(`${steps}/7`);
  await expect(line.locator('progress')).toHaveAttribute('value', String(steps));
}

test('duas equipes jogam em salas reais, respeitam papéis e retomam a sessão após recarregar', async ({ page: host, browser, baseURL }, testInfo) => {
  test.setTimeout(120_000);
  const guestContext = await browser.newContext({ ...devices['Pixel 7'], baseURL, serviceWorkers: 'allow' });
  const guest = await guestContext.newPage();
  const browserErrors: string[] = [];
  captureErrors(host, 'anfitrião', browserErrors);
  captureErrors(guest, 'convidado', browserErrors);
  try {
    await Promise.all([finishOnboarding(host), finishOnboarding(guest)]);
    await Promise.all([openOnline(host), openOnline(guest)]);
    await host.getByRole('textbox', { name: 'Endereço do servidor WebSocket', exact: true }).fill(WS_URL);
    await host.getByRole('textbox', { name: 'Nome da equipe', exact: true }).fill('Equipe 1');
    await host.getByRole('combobox', { name: 'Vagas', exact: true }).selectOption('2');
    await host.getByRole('button', { name: 'Criar sala', exact: true }).click();
    await expect(host.getByRole('heading', { name: 'Aguardando as equipes', exact: true })).toBeVisible();
    const code = (await host.locator('strong').filter({ hasText: /^[A-Z2-9]{6}$/ }).innerText()).trim();
    expect(code).toMatch(/^[A-Z2-9]{6}$/);
    await expect(host.getByRole('button', { name: 'Iniciar partida online', exact: true })).toBeDisabled();

    await guest.getByRole('textbox', { name: 'Endereço do servidor WebSocket', exact: true }).fill(WS_URL);
    await guest.getByRole('textbox', { name: 'Nome da equipe', exact: true }).fill('Equipe 2');
    await guest.getByRole('textbox', { name: 'Código de convite', exact: true }).fill(code);
    await guest.getByRole('button', { name: 'Entrar na sala', exact: true }).click();
    await expect(guest.getByText('Aguardando o anfitrião iniciar.', { exact: true })).toBeVisible();
    await expect(guest.getByRole('button', { name: 'Iniciar partida online', exact: true })).toHaveCount(0);
    await expect(host.getByRole('listitem').filter({ hasText: 'Equipe 2' })).toContainText('Online');
    await host.getByRole('spinbutton', { name: 'Passos até a estrela', exact: true }).fill('3');
    await host.getByRole('spinbutton', { name: 'Passos na volta da estrela', exact: true }).fill('3');
    await host.getByRole('button', { name: 'Iniciar partida online', exact: true }).click();
    await Promise.all([expectRound(host, 1, 'Equipe 1'), expectRound(guest, 1, 'Equipe 1')]);
    await expect(host.getByRole('button', { name: 'Comprar cartão', exact: true })).toBeDisabled();
    await expect(guest.getByRole('button', { name: 'Comprar cartão', exact: true })).toBeEnabled();
    await guest.getByRole('button', { name: 'Comprar cartão', exact: true }).click();
    await expect(host.getByRole('button', { name: '1', exact: true })).toBeEnabled();
    await expect(guest.getByRole('button', { name: '1', exact: true })).toBeDisabled();
    await host.getByRole('button', { name: '1', exact: true }).click();
    await expect(host.getByText('Desafio individual · sem repasse', { exact: true })).toBeVisible();
    await expect(host.getByRole('button', { name: 'Confirmar acerto de Equipe 1', exact: true })).toBeDisabled();
    await expect(host.getByRole('button', { name: 'Leitor: conferir orientação e resposta', exact: true })).toHaveCount(0);
    await guest.getByRole('button', { name: 'Leitor: conferir orientação e resposta', exact: true }).click();
    await expect(guest.getByText(/^Referência: /)).toBeVisible();
    await guest.getByRole('button', { name: 'Confirmar acerto de Equipe 1', exact: true }).click();
    await Promise.all([expectRound(host, 2, 'Equipe 2'), expectRound(guest, 2, 'Equipe 2')]);
    await Promise.all([expectProgress(host, 'Equipe 1', 1), expectProgress(guest, 'Equipe 1', 1)]);
    await expect(host.getByRole('button', { name: 'Comprar cartão', exact: true })).toBeEnabled();
    await expect(guest.getByRole('button', { name: 'Comprar cartão', exact: true })).toBeDisabled();
    await host.getByText('Histórico · 1 desafios', { exact: true }).click();
    await expect(host.getByText('Equipe 1: +1 passo', { exact: false })).toBeVisible();

    // Reload preserves the real tab's sessionStorage; no save/token is fabricated.
    await guest.reload();
    await openOnline(guest);
    await expect(guest.getByRole('button', { name: `Retomar sala ${code}`, exact: true })).toBeVisible();
    await guest.getByRole('button', { name: `Retomar sala ${code}`, exact: true }).click();
    await expectRound(guest, 2, 'Equipe 2');
    await expectProgress(guest, 'Equipe 1', 1);
    await expect(host.locator('ul').getByRole('listitem').filter({ hasText: 'Equipe 2' })).toContainText('Online');
    await expect(guest.getByRole('button', { name: 'Comprar cartão', exact: true })).toBeDisabled();

    await host.getByRole('button', { name: 'Comprar cartão', exact: true }).click();
    await expect(guest.getByRole('button', { name: '1', exact: true })).toBeEnabled();
    await expect(host.getByRole('button', { name: '1', exact: true })).toBeDisabled();
    await guest.getByRole('button', { name: '1', exact: true }).click();
    await expect(guest.getByRole('button', { name: 'Confirmar acerto de Equipe 2', exact: true })).toBeDisabled();
    await host.getByRole('button', { name: 'Confirmar acerto de Equipe 2', exact: true }).click();
    await Promise.all([expectRound(host, 3, 'Equipe 1'), expectRound(guest, 3, 'Equipe 1')]);
    await Promise.all([expectProgress(host, 'Equipe 2', 1), expectProgress(guest, 'Equipe 2', 1)]);
    await expect(host.getByRole('alert')).toHaveCount(0);
    await expect(guest.getByRole('alert')).toHaveCount(0);
    expect(browserErrors).toEqual([]);
  } finally {
    if (browserErrors.length) await testInfo.attach('erros-navegadores', { body: browserErrors.join('\n'), contentType: 'text/plain' });
    await testInfo.attach('servidor-websocket', { body: serverLog, contentType: 'text/plain' });
    await guestContext.close();
  }
});
