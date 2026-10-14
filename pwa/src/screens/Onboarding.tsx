import { useState } from 'react';
import { BookOpen, Library, NotebookPen, WifiOff } from 'lucide-react';
import { setPref } from '../lib/store';

const slides = [
  { title: 'Bíblia Reformada', body: 'Leia as Escrituras, consulte comentários e estude a fé reformada em um só lugar.', icon: BookOpen },
  { title: 'Seu acervo de estudos', body: 'Explore confissões, catecismos, devocionais e materiais de estudo. Alguns conteúdos exigem uma conexão inicial.', icon: Library },
  { title: 'Suas anotações, no seu dispositivo', body: 'Notas e favoritos são guardados localmente. Faça backups regularmente antes de limpar dados do navegador.', icon: NotebookPen },
  { title: 'Também funciona sem internet', body: 'Na Biblioteca, escolha os materiais que deseja baixar. O espaço disponível varia conforme o dispositivo.', icon: WifiOff },
];

export default function Onboarding() {
  const [page, setPage] = useState(0);
  const slide = slides[page];
  const Icon = slide.icon;
  const finish = async () => {
    await setPref('dedication_seen', true, false);
    await setPref('onboarding_done', true);
  };
  return (
    <main className="flex min-h-full flex-col items-center justify-center bg-surface px-6 py-12 text-on-surface">
      <div className="w-full max-w-md rounded-3xl bg-surface-low p-7 shadow-lg">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-container">
          <Icon size={36} aria-hidden="true" />
        </div>
        <p className="mb-2 text-sm text-muted">Introdução {page + 1} de {slides.length}</p>
        <h1 className="mb-4 text-3xl font-semibold">{slide.title}</h1>
        <p className="mb-8 leading-7">{slide.body}</p>
        <div className="flex justify-between gap-3">
          <button type="button" className="rounded-xl border border-outline px-4 py-3" onClick={() => void finish()}>
            Pular
          </button>
          <button type="button" className="rounded-xl bg-primary px-6 py-3 font-semibold text-on-primary"
            onClick={() => page < slides.length - 1 ? setPage(page + 1) : void finish()}>
            {page === slides.length - 1 ? 'Começar a leitura' : 'Continuar'}
          </button>
        </div>
      </div>
    </main>
  );
}

export function DedicationPage() {
  return <article className="mx-auto max-w-xl p-6 leading-7">
    <h2 className="mb-4 text-2xl font-semibold">Dedicatória</h2>
    <p>Àqueles que desejam conhecer melhor as Escrituras e aprofundar seus estudos na tradição cristã reformada.</p>
    <p className="mt-4 text-sm text-muted">O aplicativo não substitui a leitura cuidadosa da Bíblia nem o acompanhamento pastoral.</p>
  </article>;
}
