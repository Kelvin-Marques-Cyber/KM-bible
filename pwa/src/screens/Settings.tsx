import { useState } from 'react';
import { APP_VERSION, BUILD_DATE, checkForUpdate, formatBytes, requestPersistence, storageInfo } from '../lib/pwa';
import { modules } from '../lib/content';
import { pref, setPref } from '../lib/store';
import { openSheet, useApp } from '../lib/app';
import { readingThemes, themeName, readingFonts } from '../lib/themes';
import { Recovery } from './Recovery';
import { openInstallHelp, openOffline } from './open';

function Choice({ label, value, onChange, values }: { label: string; value: string; values: { id: string; label: string }[]; onChange: (x: string) => void }) {
  return <label className="flex flex-col gap-2 py-2">{label}
    <select className="rounded-lg border border-outline bg-surface p-3" value={value} onChange={(e) => onChange(e.target.value)}>
      {values.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
    </select>
  </label>;
}

export function AppearanceSettings() {
  useApp();
  return <section className="space-y-4">
    <h3 className="text-lg font-semibold">Aparência e leitura</h3>
    <Choice label="Tema" value={pref('theme', 'sepia')} onChange={(x) => void setPref('theme', x)}
      values={readingThemes.map((t) => ({ id: t.id, label: themeName(t, pref('language', 'pt')) }))} />
    <Choice label="Fonte de leitura" value={pref('font_family', 'EBGaramond')} onChange={(x) => void setPref('font_family', x)}
      values={Object.entries(readingFonts).map(([id, label]) => ({ id, label }))} />
    <Choice label="Idioma da interface" value={pref('language', 'pt')} onChange={(x) => void setPref('language', x)}
      values={[{ id: 'pt', label: 'Português' }, { id: 'en', label: 'English' }, { id: 'es', label: 'Español' }]} />
    {([['font_size', 'Tamanho da fonte', 14, 40], ['line_height', 'Espaçamento entre linhas', 1.1, 2.3]] as const).map(([key, label, min, max]) =>
      <label key={key} className="block py-2">{label}: {pref(key, min === 14 ? 23 : 1.6)}
        <input className="mt-2 w-full" type="range" min={min} max={max} step={min === 14 ? 1 : 0.1}
          value={pref(key, min === 14 ? 23 : 1.6)} onChange={(e) => void setPref(key, Number(e.target.value))} />
      </label>)}
    <label className="flex items-center gap-3 py-2">
      <input type="checkbox" checked={pref('reduced_motion', false)} onChange={(e) => void setPref('reduced_motion', e.target.checked)} />
      Reduzir animações
    </label>
  </section>;
}

export default function SettingsPage() {
  useApp();
  const [status, setStatus] = useState('');
  const [usage, setUsage] = useState('');
  const inspect = async () => {
    const s = await storageInfo();
    setUsage(`Ocupado: ${formatBytes(s.usage)} · Limite estimado: ${formatBytes(s.quota)} · Persistente: ${s.persisted ? 'sim' : 'não'}`);
  };
  const update = async () => {
    const state = await checkForUpdate(true);
    setStatus(state === 'current' ? 'Versão atualizada.' : state === 'offline' ? 'Sem conexão para verificar.' : 'Nova versão disponível.');
  };
  return <section className="mx-auto max-w-2xl space-y-6 p-5">
    <AppearanceSettings />
    <div className="border-t border-outline pt-5">
      <h3 className="mb-3 text-lg font-semibold">Tradução principal</h3>
      <Choice label="Bíblia" value={pref('translation', modules('bible', true)[0]?.id ?? 'BLN4')}
        onChange={(x) => { void setPref('translation', x); setStatus('A tradução será aplicada ao reiniciar a leitura.'); }}
        values={modules('bible', true).map((m) => ({ id: m.id, label: m.title }))} />
    </div>
    <div className="space-y-3 border-t border-outline pt-5">
      <h3 className="text-lg font-semibold">Instalação e armazenamento</h3>
      <button type="button" className="block underline" onClick={openOffline}>Gerenciar conteúdo offline</button>
      <button type="button" className="block underline" onClick={() => openSheet('Backup e restauração', () => <Recovery onContinue={() => { location.reload(); }} />)}>Exportar ou restaurar backup</button>
      <button type="button" className="block underline" onClick={openInstallHelp}>Como instalar no dispositivo</button>
      <button type="button" className="block underline" onClick={() => void inspect()}>Consultar espaço usado</button>
      <button type="button" className="block underline" onClick={() => void requestPersistence().then((ok) => setStatus(ok ? 'Armazenamento persistente autorizado.' : 'O navegador não concedeu armazenamento persistente.'))}>Proteger dados contra limpeza automática</button>
      {usage && <p className="text-sm text-muted">{usage}</p>}
    </div>
    <div className="space-y-3 border-t border-outline pt-5">
      <h3 className="text-lg font-semibold">Atualizações</h3>
      <p className="text-sm">Versão {APP_VERSION} · {BUILD_DATE}</p>
      <button type="button" className="rounded-lg bg-primary px-4 py-2 text-on-primary" onClick={() => void update()}>Verificar atualização</button>
      {status && <p role="status" className="text-sm">{status}</p>}
    </div>
  </section>;
}
