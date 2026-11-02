import { describe, expect, it } from 'vitest';
import { versionMenuPosition } from '../../src/screens/Reader';

describe('menu de versões', () => {
  it('no desktop fica ancorado ao botão e dentro da janela', () => {
    const p = versionMenuPosition({ left: 315, bottom: 96 }, { width: 1440, height: 900 });
    expect(p).toMatchObject({ left: 315, top: 100, width: 360 });
    expect(p.maxHeight).toBeLessThanOrEqual(900 - 100 - 8);
  });
  it('nunca passa da borda direita', () => {
    const p = versionMenuPosition({ left: 900, bottom: 96 }, { width: 1024, height: 768 });
    expect(p.left + p.width).toBeLessThanOrEqual(1024 - 8);
  });
  it('no celular ocupa a largura útil com margens', () => {
    expect(versionMenuPosition({ left: 200, bottom: 96 }, { width: 320, height: 640 })).toMatchObject({ left: 8, width: 304 });
  });
  it('em janelas baixas mantém altura mínima legível', () => {
    const p = versionMenuPosition({ left: 10, bottom: 380 }, { width: 1200, height: 400 });
    expect(p.top).toBeLessThanOrEqual(400 - 160);
    expect(p.maxHeight).toBeGreaterThanOrEqual(160);
  });
});
