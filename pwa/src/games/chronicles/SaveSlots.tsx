import { ArrowLeft, BookOpen, ChevronRight } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { CAMPAIGN_SAGAS } from './campaign-content';
import { SAVE_SLOTS, type SaveSlot } from './save-slot-key';
import type { SaveSlotSummary } from './save-slots';

type Props = {
  mode: 'new' | 'continue';
  slots: SaveSlotSummary[];
  busy: boolean;
  onBack: () => void;
  onChoose: (slot: SaveSlot, overwrite: boolean, resume: boolean) => Promise<boolean>;
};
export default function SaveSlots({ mode, slots, busy, onBack, onChoose }: Props) {
  const [confirm, setConfirm] = useState<SaveSlot | null>(null);
  const [error, setError] = useState('');
  const screen = useRef<HTMLElement>(null);
  const choosing = useRef(false);
  const previousConfirmation = useRef<SaveSlot | null>(null);
  useEffect(() => {
    const before = previousConfirmation.current;
    const target = confirm
      ? screen.current?.querySelector<HTMLButtonElement>('.gf-save-confirm button:last-child')
      : before ? screen.current?.querySelector<HTMLButtonElement>(`[aria-label="Selecionar save ${before}"]`)
        : screen.current?.querySelector<HTMLButtonElement>('.gf-save-book:not(:disabled)');
    target?.focus({preventScroll:true});
    previousConfirmation.current = confirm;
  }, [confirm]);
  const choose = async (id: SaveSlot, overwrite = false) => {
    if (busy || choosing.current) return;
    choosing.current = true;
    setError('');
    try {
      if (!await onChoose(id, overwrite, mode === 'continue')) setError('Não foi possível abrir este save. Seus dados foram preservados.');
    } catch {
      setError('Não foi possível abrir o armazenamento. Tente novamente.');
    } finally { choosing.current = false; }
  };
  return <section ref={screen} className="gf-save-screen" aria-label="Espaços de save" onKeyDown={event => {
    if (!confirm) return;
    if (event.key === 'Escape') {
      event.preventDefault();event.stopPropagation();
      if (!busy) setConfirm(null);
    } else if (event.key === 'Tab') {
      const buttons = [...(screen.current?.querySelectorAll<HTMLButtonElement>('.gf-save-confirm button:not(:disabled)') ?? [])];
      const first = buttons[0], last = buttons.at(-1);
      if (event.shiftKey && document.activeElement === first) {event.preventDefault();last?.focus();}
      else if (!event.shiftKey && document.activeElement === last) {event.preventDefault();first?.focus();}
    }
  }}>
    <button className="gf-back" disabled={busy} onClick={confirm ? () => setConfirm(null) : onBack}><ArrowLeft size={17}/>{confirm ? 'Cancelar sobrescrita' : 'Menu principal'}</button>
    <span className="gf-kicker">O LIVRO DA SUA JORNADA</span>
    <h2>{mode === 'new' ? 'Novo jogo' : 'Continuar jornada'}</h2>
    <p className="gf-save-hint">{mode === 'new' ? 'Escolha um dos três espaços para esta jornada.' : 'Cada livro guarda uma jornada independente neste aparelho.'}</p>
    {error && <p role="alert">{error}</p>}
    {confirm ? <div className="gf-save-confirm" role="alertdialog" aria-modal="true" aria-label="Confirmar sobrescrita do save">
      <BookOpen size={36} aria-hidden="true"/>
      <h3>Recomeçar no espaço {confirm}?</h3>
      <p>As aventuras e o piloto deste espaço serão reiniciados. Uma cópia do save atual será arquivada antes da troca. Os outros dois espaços continuam como estão.</p>
      <button className="gf-menu-action gf-menu-primary" disabled={busy} onClick={() => void choose(confirm, true)}>{busy ? 'Preparando jornada…' : 'Confirmar sobrescrita'}<ChevronRight size={18}/></button>
      <button className="gf-menu-action" disabled={busy} onClick={() => setConfirm(null)}>Manter meu save</button>
    </div> : <div className="gf-save-books">
      {SAVE_SLOTS.map(id => {
        const slot = slots.find(s => s.id === id);
        const empty = !slot || slot.status === 'empty';
        const date = slot?.savedAt ? new Date(slot.savedAt) : null;
        return <button key={id} className={'gf-save-book' + (empty ? ' gf-save-empty' : '')}
          aria-label={`Selecionar save ${id}`} disabled={busy || mode === 'continue' && empty}
          onClick={() => mode === 'new' && !empty ? setConfirm(id) : void choose(id)}>
          <span className="gf-save-number" aria-hidden="true">{String(id).padStart(2, '0')}</span>
          <span className="gf-save-details">
            <strong>Espaço {id} <small>{empty ? 'LIVRE' : slot.status === 'damaged' ? 'RECUPERAÇÃO' : 'JORNADA SALVA'}</small></strong>
            <span>{empty ? 'Uma nova história espera por você' : slot.chapter}</span>
            {!empty && <small>{slot.kind === 'pilot' ? 'Campanha ampliada · 1 Samuel 16–17' : CAMPAIGN_SAGAS[slot.saga ?? 0].title} · {slot.completed}/36</small>}
            {!empty && <span className="gf-save-meter" aria-hidden="true"><i style={{width: `${slot.completed / 36 * 100}%`}}/></span>}
            {date && Number.isFinite(date.getTime()) && <time dateTime={slot!.savedAt}>{date.toLocaleString('pt-BR', {day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})}</time>}
          </span>
          <ChevronRight size={21}/>
        </button>;
      })}
    </div>}
    {busy && <p role="status">Abrindo o livro da jornada…</p>}
    <small className="gf-save-foot">Saves anteriores aparecem no espaço 1. Salvamento automático durante o jogo.</small>
  </section>;
}
