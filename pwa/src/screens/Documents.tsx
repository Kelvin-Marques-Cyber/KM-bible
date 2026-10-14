// DocumentPage (lib/common.dart), StudyText e LongStudyText (lib/portuguese_resources.dart):
// confissões, catecismos, introduções aos livros e textos de módulos importados.
import { Copy, NotebookPen } from 'lucide-react';
import { useMemo } from 'react';
import { useApp } from '../lib/app';
import { module, type DocumentRow } from '../lib/content';
import { t } from '../lib/i18n';
import { authorLine, documentCitation, documentReferences, isConfessionModule, metadataLines } from '../lib/studycontext';
import { StudyText } from '../lib/studycontext-text';
import { RefChips, SourceLinks } from '../lib/studycontext-ui';
import { Action, Small, Wrap, copyText, message } from '../components/ui';
import { openNewNote } from './open';

// Reexportados para open.tsx (openLongText) e para reutilização por outras telas.
export { LongStudyText, StudyText, studyFontSize } from '../lib/studycontext-text';

export function DocumentPage({ document: doc }: { document: DocumentRow }) {
  useApp();
  const m = module(doc.module_id);
  const refs = useMemo(() => documentReferences(doc), [doc]);
  const legal = [m?.license ?? '', metadataLines(m?.metadata)].filter((s) => s.trim()).join('\n');

  const copy = async () => {
    const ok = await copyText(documentCitation(doc, m));
    message(ok ? t('copy') : t('error'));
  };

  return (
    <article className="mx-auto max-w-reading p-5" aria-label={doc.title}>
      <p className="text-sm font-medium text-muted">{authorLine(m)}</p>
      <div className="mt-3.5">
        <StudyText original={doc.body} pt={doc.pt} originalFirst={isConfessionModule(doc.module_id)} />
      </div>
      <RefChips refs={refs} initial={40} step={40} className="mt-5" />
      <SourceLinks sources={[m?.source ?? '']} />
      {legal && <Small className="mt-3 select-text whitespace-pre-line [overflow-wrap:anywhere]">{legal}</Small>}
      <Wrap className="mt-3">
        <Action
          label={t('note')}
          icon={NotebookPen}
          onClick={() => void openNewNote({ title: doc.title, body: `[[${doc.id}]]\n\n`, reference: doc.id })}
        />
        <Action label={t('copy')} icon={Copy} onClick={() => void copy()} />
      </Wrap>
    </article>
  );
}
