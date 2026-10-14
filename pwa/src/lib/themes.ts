// Temas e fontes de lib/appearance.dart, com o esquema de cores derivado em JS
// (equivalente simplificado ao ColorScheme.fromSeed do Material 3).

export interface ReadingTheme {
  id: string;
  names: [string, string, string];
  surface: number;
  accent: number;
  dark: boolean;
}

export const readingThemes: ReadingTheme[] = [
  { id: 'light', names: ['Papel claro', 'Light paper', 'Papel claro'], surface: 0xfaf9f6, accent: 0x466451, dark: false },
  { id: 'sepia', names: ['Sépia', 'Sepia', 'Sepia'], surface: 0xf4efdf, accent: 0x795839, dark: false },
  { id: 'dark', names: ['Grafite', 'Graphite', 'Grafito'], surface: 0x181f29, accent: 0x86b99c, dark: true },
  { id: 'midnight', names: ['Meia-noite', 'Midnight', 'Medianoche'], surface: 0x101827, accent: 0xa3b9df, dark: true },
  { id: 'forest', names: ['Floresta', 'Forest', 'Bosque'], surface: 0x14211a, accent: 0x91cba2, dark: true },
  { id: 'oled', names: ['Preto profundo', 'Deep black', 'Negro profundo'], surface: 0x000000, accent: 0xddddce, dark: true },
  { id: 'coffee', names: ['Café', 'Coffee', 'Café'], surface: 0x241c17, accent: 0xd5b58d, dark: true },
  { id: 'ocean', names: ['Oceano', 'Ocean', 'Océano'], surface: 0x102327, accent: 0x8ececb, dark: true },
  { id: 'wine', names: ['Vinho', 'Wine', 'Vino'], surface: 0x281820, accent: 0xe8b0c2, dark: true },
  { id: 'parchment', names: ['Pergaminho', 'Parchment', 'Pergamino'], surface: 0xeee0c9, accent: 0x785232, dark: false },
  { id: 'ivory', names: ['Marfim', 'Ivory', 'Marfil'], surface: 0xfff8eb, accent: 0x5d6540, dark: false },
  { id: 'lavender', names: ['Lavanda', 'Lavender', 'Lavanda'], surface: 0xf4f0fa, accent: 0x725989, dark: false },
  { id: 'mist', names: ['Névoa', 'Mist', 'Niebla'], surface: 0xedf0f2, accent: 0x496375, dark: false },
  { id: 'rose', names: ['Rosa antigo', 'Old rose', 'Rosa antiguo'], surface: 0xfbefee, accent: 0x8a5658, dark: false },
];

export const themeName = (t: ReadingTheme, language: string) => t.names[language === 'en' ? 1 : language === 'es' ? 2 : 0];
export const selectedTheme = (id: string) => readingThemes.find((t) => t.id === id) ?? readingThemes[1];

export const readingFonts: Record<string, string> = {
  EBGaramond: 'EB Garamond',
  UiSans: 'Roboto',
  Lora: 'Lora',
  SourceSerif4: 'Source Serif 4',
  NotoSerif: 'Noto Serif',
  LibreBaskerville: 'Libre Baskerville',
  CrimsonPro: 'Crimson Pro',
  Merriweather: 'Merriweather',
  CormorantGaramond: 'Cormorant Garamond',
  Spectral: 'Spectral',
  Bitter: 'Bitter',
  AtkinsonHyperlegible: 'Atkinson Hyperlegible',
  Lexend: 'Lexend',
  NotoSans: 'Noto Sans',
  system: 'Sistema / System',
};

type RGB = [number, number, number];
const rgb = (n: number): RGB => [(n >> 16) & 255, (n >> 8) & 255, n & 255];
const mix = (a: RGB, b: RGB, t: number): RGB => [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * t)) as RGB;
const css = (c: RGB) => c.join(' ');
const luminance = (c: RGB) => {
  const f = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
};
const contrast = (a: RGB, b: RGB) => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

/** Ajusta a cor até atingir o contraste mínimo sobre a superfície (WCAG AA). */
function readable(color: RGB, surface: RGB, dark: boolean, minimum: number): RGB {
  let c = color;
  const target: RGB = dark ? [255, 255, 255] : [0, 0, 0];
  for (let i = 0; i < 20 && contrast(c, surface) < minimum; i++) c = mix(c, target, 0.12);
  return c;
}

export function themeVariables(theme: ReadingTheme, highContrast: boolean): Record<string, string> {
  const surface = rgb(theme.surface);
  const accent = rgb(theme.accent);
  const ink: RGB = theme.dark ? [235, 233, 226] : [33, 28, 22];
  const onSurface = highContrast ? (theme.dark ? [255, 255, 255] as RGB : [0, 0, 0] as RGB) : ink;
  const primary = readable(accent, surface, theme.dark, highContrast ? 7 : 4.5);
  const onPrimary: RGB = contrast(primary, [255, 255, 255]) >= contrast(primary, [0, 0, 0]) ? [255, 255, 255] : [0, 0, 0];
  const primaryContainer = mix(surface, accent, theme.dark ? 0.32 : 0.2);
  const secondary = mix(primary, theme.dark ? [200, 200, 200] : [90, 90, 90], 0.35);
  return {
    '--surface': css(surface),
    '--surface-low': css(mix(surface, theme.dark ? [255, 255, 255] : [0, 0, 0], theme.dark ? 0.05 : 0.03)),
    '--surface-high': css(mix(surface, theme.dark ? [255, 255, 255] : [0, 0, 0], theme.dark ? 0.1 : 0.07)),
    '--on-surface': css(onSurface),
    '--muted': css(mix(onSurface, surface, highContrast ? 0.15 : 0.32)),
    '--outline': css(mix(onSurface, surface, 0.7)),
    '--primary': css(primary),
    '--on-primary': css(onPrimary),
    '--primary-container': css(primaryContainer),
    '--on-primary-container': css(readable(mix(onSurface, accent, 0.25), primaryContainer, theme.dark, 4.5)),
    '--secondary': css(secondary),
    '--secondary-container': css(mix(surface, secondary, theme.dark ? 0.28 : 0.16)),
    '--tertiary': css(readable(mix(accent, [120, 80, 160], 0.5), surface, theme.dark, 4.5)),
    '--danger': css(theme.dark ? [255, 153, 143] : [162, 35, 33]),
  };
}

export const themeColorHex = (theme: ReadingTheme) => `#${theme.surface.toString(16).padStart(6, '0')}`;

export function fontStack(id: string): string {
  if (id === 'system') return 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  if (id === 'UiSans') return 'Roboto, system-ui, sans-serif';
  const family = readingFonts[id] ? id : 'EBGaramond';
  return `"KM ${family}", Georgia, "Noto Serif", serif`;
}

const loaded = new Set<string>();
/** Registra a fonte de leitura somente quando escolhida (economiza tráfego). */
export function ensureFont(id: string, base: string, format: string): void {
  if (id === 'system' || id === 'UiSans' || loaded.has(id) || !readingFonts[id]) return;
  loaded.add(id);
  const style = document.createElement('style');
  const ext = format === 'ttf' ? 'ttf' : 'woff2';
  const kind = format === 'ttf' ? 'truetype' : 'woff2';
  style.textContent = `@font-face{font-family:"KM ${id}";src:url("${base}fonts/${id}.${ext}") format("${kind}");font-weight:100 900;font-display:swap}`;
  document.head.appendChild(style);
}
