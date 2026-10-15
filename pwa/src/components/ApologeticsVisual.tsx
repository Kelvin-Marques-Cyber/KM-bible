// Imagens de apoio à apologética. A ilustração faz parte do pacote offline;
// fotografia externa só para arquivo com licença e proveniência verificadas.
import { Image as ImageIcon, ExternalLink } from 'lucide-react';
import { useEffect, useState } from 'react';
import { catalog, packUrl } from '../lib/catalog';
import { tr } from '../lib/i18n';

export default function ApologeticsVisual({ target }: { target: string }) {
  const pack = catalog.apologetica;
  const item = pack?.visuals?.[target];
  const [photoFailed, setPhotoFailed] = useState(false);
  useEffect(() => setPhotoFailed(false), [target]);
  if (!pack || !item) return null;
  const local = packUrl(pack, item.path);
  const online = typeof navigator !== 'undefined' && navigator.onLine;
  const photo = online && !photoFailed ? item.photo : undefined;
  return (
    <figure className="my-5 overflow-hidden rounded-2xl border border-outline/40 bg-surface-low">
      <div className="relative aspect-[16/9] w-full bg-secondary-container">
        <img
          src={photo?.src ?? local}
          alt={photo?.alt ?? item.alt}
          loading="lazy"
          decoding="async"
          onError={() => photo && setPhotoFailed(true)}
          className="h-full w-full object-cover"
        />
        <span className="absolute bottom-3 left-3 rounded-full bg-surface/90 px-3 py-1.5 text-xs font-medium text-on-surface backdrop-blur-sm">
          <ImageIcon aria-hidden className="mr-1 inline-block" size={14} />
          {photo ? tr('Fotografia documental', 'Documentary photograph', 'Fotografía documental') : tr('Ilustração editorial', 'Editorial illustration', 'Ilustración editorial')}
        </span>
      </div>
      <figcaption className="flex flex-col gap-1.5 px-4 py-3 text-sm">
        <strong className="font-medium">{item.title}</strong>
        <span>{photo?.caption ?? item.caption}</span>
        <span className="text-xs text-muted">
          {photo?.credit ?? item.credit}
          {photo?.source && (
            <>
              {' · '}
              <a className="inline-flex items-center gap-1 underline underline-offset-2" href={photo.source} target="_blank" rel="noopener noreferrer">
                {tr('Créditos e licença', 'Credits and license', 'Créditos y licencia')}
                <ExternalLink size={12} aria-hidden />
              </a>
            </>
          )}
        </span>
      </figcaption>
    </figure>
  );
}
