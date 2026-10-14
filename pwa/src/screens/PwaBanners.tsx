import { useState } from 'react';
import { Download, RefreshCw } from 'lucide-react';
import { applyUpdate, browserName, checkForUpdate, isStandalone, platform, promptInstall, usePwa } from '../lib/pwa';
import { openInstallHelp } from './open';

export function UpdateBanner() {
  const state = usePwa();
  const [working, setWorking] = useState(false);
  if (!state.updateReady && !(state.remote?.force && state.remote.build)) return null;
  const update = async () => {
    setWorking(true);
    try { await applyUpdate(); } finally { setWorking(false); }
  };
  return <div className="fixed bottom-20 left-3 right-3 z-50 mx-auto max-w-xl rounded-xl border border-outline bg-surface-high p-4 shadow-xl" role="status">
    <p className="font-semibold">Uma atualização da Bíblia Reformada está disponível.</p>
    <p className="mb-3 text-sm text-muted">As anotações locais serão preservadas. Mantenha um backup atualizado.</p>
    <button type="button" disabled={working || state.updating} onClick={() => void update()}
      className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-on-primary disabled:opacity-60">
      <RefreshCw size={17} aria-hidden="true" /> {working || state.updating ? 'Atualizando…' : 'Atualizar agora'}
    </button>
  </div>;
}

export function InstallButton() {
  const pwa = usePwa();
  if (pwa.installed || pwa.standalone || isStandalone()) return null;
  const install = async () => {
    if (pwa.installAvailable) {
      const result = await promptInstall();
      if (result !== 'unavailable') return;
    }
    openInstallHelp();
  };
  return <button type="button" aria-label="Instalar aplicativo" title="Instalar aplicativo"
    onClick={() => void install()} className="rounded-lg p-2 hover:bg-surface-high">
    <Download size={21} aria-hidden="true" />
  </button>;
}

export function InstallHelp() {
  const os = platform();
  const browser = browserName();
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState('');
  const verify = async () => {
    setChecking(true);
    try {
      const status = await checkForUpdate(true);
      setResult(status === 'current' ? 'Você está usando a versão mais recente.' : status === 'offline' ? 'Não foi possível verificar sem conexão.' : 'Atualização encontrada.');
    } finally { setChecking(false); }
  };
  return <section className="mx-auto max-w-xl space-y-4 p-5">
    <h2 className="text-xl font-semibold">Instalar a Bíblia Reformada</h2>
    {os === 'ios' ? <p>No Safari, toque em Compartilhar e escolha “Adicionar à Tela de Início”. Abra o aplicativo pelo ícone criado.</p> :
      os === 'android' ? <p>No Chrome ou navegador compatível, abra o menu (⋮) e escolha “Instalar aplicativo” ou “Adicionar à tela inicial”.</p> :
      <p>Em navegadores Chromium, use o ícone de instalação na barra de endereços ou a opção “Instalar aplicativo” no menu.</p>}
    <p className="text-sm text-muted">Navegador detectado: {browser}. A disponibilidade da instalação depende do navegador. Para usar o acervo sem rede, abra Biblioteca → Offline após instalar.</p>
    <button type="button" onClick={() => void verify()} disabled={checking}
      className="rounded-lg border border-outline px-4 py-2">{checking ? 'Verificando…' : 'Verificar atualização'}</button>
    {result && <p role="status">{result}</p>}
  </section>;
}
