// MarkdownText do original: Markdown seguro, citações bíblicas clicáveis,
// [[ligações]] para passagens/notas/documentos e imagens anexadas locais.
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import { memo, useEffect, useMemo, useRef } from 'react';
import { linkScriptureReferences } from '../lib/scripture';
import { attachmentUrl } from '../lib/store';
import { openLink } from '../screens/links';

marked.setOptions({ gfm: true, breaks: false });

const ALLOWED = /^(?:(?:https?|mailto|biblia|confession|attachment):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i;

export function renderMarkdown(text: string): string {
  const transformed = linkScriptureReferences(text).replace(
    /\[\[([^\]]+)\]\]/g,
    (_, inner: string) => `[${inner}](biblia:${encodeURIComponent(inner)})`,
  );
  const html = marked.parse(transformed, { async: false }) as string;
  const clean = DOMPurify.sanitize(html, {
    ALLOWED_URI_REGEXP: ALLOWED,
    FORBID_TAGS: ['style', 'iframe', 'form', 'input', 'video', 'audio', 'object', 'embed'],
    FORBID_ATTR: ['style'],
  });
  // Imagens remotas não são carregadas (privacidade/offline); anexos locais sim.
  return clean.replace(/<img\b([^>]*?)src="([^"]*)"([^>]*)>/gi, (whole, before: string, src: string, after: string) => {
    if (src.startsWith('attachment:')) {
      return `<img${before}data-attachment="${src.slice('attachment:'.length)}"${after}>`;
    }
    const alt = /alt="([^"]*)"/i.exec(whole)?.[1];
    return `<span class="text-muted">[${alt || 'Imagem'}]</span>`;
  });
}

export const Markdown = memo(function Markdown({ text, className }: { text: string; className?: string }) {
  const html = useMemo(() => renderMarkdown(text), [text]);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    element.querySelectorAll<HTMLImageElement>('img[data-attachment]').forEach(async (img) => {
      const url = await attachmentUrl(img.dataset.attachment!);
      if (url) img.src = url;
      else img.replaceWith(document.createTextNode(img.alt || 'Imagem indisponível'));
    });
  }, [html]);
  return (
    <div
      ref={root}
      className={`md ${className ?? ''}`}
      dangerouslySetInnerHTML={{ __html: html }}
      onClick={(event) => {
        const anchor = (event.target as HTMLElement).closest('a');
        if (!anchor) return;
        const href = anchor.getAttribute('href') ?? '';
        if (/^(biblia|confession|attachment):/i.test(href)) {
          event.preventDefault();
          void openLink(href);
        } else if (/^https?:/i.test(href)) {
          event.preventDefault();
          window.open(href, '_blank', 'noopener,noreferrer');
        }
      }}
    />
  );
});
