// Ligações dentro de textos Markdown: biblia:..., confession:CODE:N.
import { document as findDocument, documents } from '../lib/content';
import { parseRef } from '../lib/domain';
import { t } from '../lib/i18n';
import { note } from '../lib/store';
import { message } from '../components/ui';
import { openDocument, openNote, showPassage } from './open';

export async function openLink(href: string): Promise<void> {
  if (href.startsWith('biblia:')) {
    const target = decodeURIComponent(href.slice('biblia:'.length));
    const parts = target.split('..');
    const r = parseRef(parts[0]);
    if (r) {
      showPassage(r, { end: parts.length > 1 ? parseRef(parts[parts.length - 1]) ?? undefined : undefined });
      return;
    }
    const id = target.startsWith('note:') ? target.slice(5) : target;
    const found = await note(id);
    if (found) {
      openNote(found);
      return;
    }
    const doc = await findDocument(target).catch(() => null);
    if (doc) {
      openDocument(doc);
      return;
    }
    message(t('noContent'));
  } else if (href.startsWith('confession:')) {
    const [code, number] = href.slice('confession:'.length).split(':');
    const doc = (await documents({ moduleId: code }).catch(() => [])).find((d) => String(d.metadata.number) === number);
    if (doc) openDocument(doc);
    else message(t('noContent'));
  }
}
