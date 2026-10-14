// Textos de estudo da área "estudo conectado": StudyText e LongStudyText de
// lib/portuguese_resources.dart. Ficam numa biblioteca (e não numa tela) para que
// Temas e Documentos os usem sem importar uma tela a partir de outra.
import { useCallback, useMemo } from 'react';
import { Markdown } from '../components/Markdown';
import { Small } from '../components/ui';
import { fontSize, useApp } from './app';
import { t, tr } from './i18n';
import { estimateParagraphHeight, splitParagraphs } from './studycontext';
import { useParentVirtualizer } from './studycontext-hooks';
import { Disclosure } from './studycontext-ui';

/** Corpo dos textos de estudo: fonte de leitura, proporcional ao tamanho escolhido pelo leitor. */
export const studyFontSize = () => Math.round(Math.min(34, Math.max(15, fontSize() * 0.78)));

/** A partir deste tamanho o texto é desenhado por parágrafos virtualizados. */
export const LONG_TEXT = 12_000;

/**
 * LongStudyText: divide por linhas em branco e desenha somente os parágrafos
 * próximos da tela (textos de livros importados podem ser muito longos). Rola
 * junto com a folha que o contém, de modo que cabeçalhos acima dele acompanham a
 * rolagem. `embedded` omite o espaçamento próprio de página.
 */
export function LongStudyText({ text, embedded = false }: { text: string; embedded?: boolean }) {
  useApp();
  const paragraphs = useMemo(() => splitParagraphs(text), [text]);
  const size = studyFontSize();
  const estimateSize = useCallback((i: number) => estimateParagraphHeight(paragraphs[i] ?? '', size), [paragraphs, size]);
  // Nova lista de parágrafos: descarta as posições calculadas para o texto anterior.
  const getItemKey = useCallback((i: number) => i, [paragraphs]); // eslint-disable-line react-hooks/exhaustive-deps
  const { anchor, virtual, margin } = useParentVirtualizer({ count: paragraphs.length, estimateSize, getItemKey, overscan: 6 });
  const items = virtual.getVirtualItems();
  const offset = Math.max(0, (items[0]?.start ?? margin) - margin);
  // A âncora é sempre desenhada (mesmo vazia) para localizar a área de rolagem da folha.
  const list = (
    <div ref={anchor} className="relative w-full" style={{ height: virtual.getTotalSize(), fontSize: size }}>
      <div className="absolute left-0 top-0 w-full" style={{ transform: `translateY(${offset}px)` }}>
        {items.map((item) => (
          <div key={item.key} data-index={item.index} ref={virtual.measureElement} className="pb-3.5">
            <Markdown text={paragraphs[item.index]} className="select-text font-reading" />
          </div>
        ))}
      </div>
    </div>
  );
  if (embedded) return list;
  return (
    <div className="mx-auto max-w-reading p-5">
      {paragraphs.length === 0 && <p className="text-muted">{t('noContent')}</p>}
      {list}
    </div>
  );
}

/** Markdown curto direto; textos muito longos passam ao modo virtualizado. */
export function RichText({ text }: { text: string }) {
  useApp();
  if (text.length > LONG_TEXT) return <LongStudyText text={text} embedded />;
  return (
    <div style={{ fontSize: studyFontSize() }}>
      <Markdown text={text} className="select-text font-reading" />
    </div>
  );
}

export interface StudyTranslation {
  title?: string;
  body: string;
  status?: string;
}

/**
 * StudyText: mostra a versão em português (com a situação da revisão) e oferece o
 * original em inglês recolhido. `originalFirst` atende aos Padrões de Westminster,
 * cujo corpo original já traz o guia em português: a tradução automática da
 * redação histórica fica recolhida como apoio.
 */
export function StudyText({
  original,
  pt,
  originalFirst = false,
}: {
  original: string;
  pt?: StudyTranslation | null;
  originalFirst?: boolean;
}) {
  const translated = pt && pt.body?.trim() ? pt : null;
  if (!translated) return <RichText text={original} />;
  const status = translated.status?.trim() ? <Small className="mt-3">{translated.status}</Small> : null;
  if (originalFirst) {
    return (
      <>
        <RichText text={original} />
        <Disclosure
          title={tr(
            'Tradução de apoio da redação histórica (revisão pendente)',
            'Support translation of the historical wording (review pending)',
            'Traducción de apoyo de la redacción histórica (revisión pendiente)',
          )}
        >
          <RichText text={translated.body} />
          {status}
        </Disclosure>
      </>
    );
  }
  return (
    <>
      <RichText text={translated.body} />
      {status}
      <Disclosure title={tr('Consultar o original em inglês', 'View the English original', 'Consultar el original en inglés')}>
        <RichText text={original} />
      </Disclosure>
    </>
  );
}
