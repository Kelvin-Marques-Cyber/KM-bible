// A dedicatória faz parte da identidade do aplicativo e NUNCA pode ser removida.
// Este teste falha se ela sumir da introdução ou da tela Sobre (Configurações).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const DEDICATION = 'Em presente dedicatória à Rebeca Teles';
// vitest roda a partir de pwa/ (no jsdom, import.meta.url não aponta para o disco).
const source = (file: string) => readFileSync(resolve(process.cwd(), 'src/screens', file), 'utf8');

describe('dedicatória', () => {
  it('aparece na introdução (primeira abertura e reabertura)', () => {
    const onboarding = source('Onboarding.tsx');
    expect(onboarding).toContain(DEDICATION);
    expect(onboarding).toMatch(/export function DedicationPage/);
  });

  it('aparece nos créditos de Configurações', () => {
    expect(source('Settings.tsx')).toContain(DEDICATION);
  });

  it('pode ser reaberta pelo usuário', () => {
    expect(source('open.tsx')).toMatch(/export const openDedication/);
  });
});
