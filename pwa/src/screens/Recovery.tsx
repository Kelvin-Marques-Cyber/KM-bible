import { useState } from 'react';
import { backupFileName, exportBackup, restoreBackup } from '../lib/backup';

export function Recovery({ onContinue }: { onContinue: () => void }) {
  const [password, setPassword] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const exportData = async () => {
    setBusy(true);
    try {
      const blob = await exportBackup(password || undefined);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = backupFileName(Boolean(password));
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setStatus('Backup preparado. Guarde-o em um local seguro.');
    } catch (e) { setStatus(`Falha ao gerar backup: ${String(e)}`); }
    finally { setBusy(false); }
  };
  const importData = async () => {
    if (!file || !accepted) return;
    setBusy(true);
    try {
      const count = await restoreBackup(file, password || undefined);
      setStatus(`Restauração concluída: ${count} registros. Reabra o aplicativo para conferir seus dados.`);
    } catch (e) { setStatus(`Falha na restauração: ${String(e)}`); }
    finally { setBusy(false); }
  };
  return <section className="mx-auto max-w-2xl space-y-5 p-5">
    <h2 className="text-xl font-semibold">Backup e recuperação</h2>
    <p>Os dados pessoais ficam no navegador. Antes de limpar o cache, trocar de dispositivo ou reinstalar, faça um backup.</p>
    <label className="block">Senha opcional do backup criptografado
      <input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)}
        className="mt-2 w-full rounded-lg border border-outline bg-surface p-3" />
    </label>
    <button type="button" disabled={busy} onClick={() => void exportData()} className="rounded-lg bg-primary px-4 py-2 text-on-primary">Exportar meus dados</button>
    <div className="space-y-3 border-t border-outline pt-5">
      <h3 className="text-lg font-semibold">Restaurar arquivo</h3>
      <input type="file" accept=".zip,.bibliaenc" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setAccepted(false); }}
        className="block w-full text-sm" />
      <label className="flex items-start gap-2"><input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
        Entendo que a restauração modifica meus dados locais. Já salvei uma cópia dos dados atuais.
      </label>
      <button type="button" disabled={busy || !file || !accepted} onClick={() => void importData()}
        className="rounded-lg border border-outline px-4 py-2 disabled:opacity-50">Restaurar backup</button>
    </div>
    {status && <p role="status" className="text-sm">{status}</p>}
    <button type="button" onClick={onContinue} className="block underline">Voltar ao aplicativo</button>
  </section>;
}
