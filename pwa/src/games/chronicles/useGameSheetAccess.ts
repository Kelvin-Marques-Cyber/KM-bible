import { useEffect } from 'react';

/** Existing reader/card sheets live outside the game. Give their keyboard
 * navigation the same modal boundary as the game's own overlays. */
export function useGameSheetAccess(count: number, active = true) {
  useEffect(() => {
    if (!count || !active) return;
    const top = () => [...document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"]')]
      .filter(element => !element.closest('.ca-root, .pc-root')).at(-1);
    const focus = () => {
      const dialog = top();
      if (!dialog) return;
      dialog.tabIndex = -1;
      const control = dialog.querySelector<HTMLElement>('.sheet-enter button:not(:disabled)');
      (control ?? dialog).focus({preventScroll:true});
    };
    const frame = requestAnimationFrame(focus);
    const key = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || event.defaultPrevented) return;
      const dialog = top();
      if (!dialog) return;
      const targets = [...dialog.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),textarea:not(:disabled),select:not(:disabled),[tabindex="0"]')]
        .filter(element => element.getClientRects().length > 0);
      const first = targets[0], last = targets.at(-1);
      if (!first) {event.preventDefault();dialog.focus();return;}
      if (!dialog.contains(document.activeElement) || document.activeElement === dialog || event.shiftKey && document.activeElement === first) {
        event.preventDefault();(event.shiftKey ? last : first)?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();first.focus();
      }
    };
    document.addEventListener('keydown',key,true);
    return () => {cancelAnimationFrame(frame);document.removeEventListener('keydown',key,true);};
  }, [count,active]);
}
