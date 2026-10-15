// A nova quinta área preserva integralmente Memorização e acrescenta jogos.
import { ArrowRight, BookOpen, Brain, Dices, Gamepad2, Sparkles, WifiOff } from 'lucide-react';
import { lazy, Suspense, useState } from 'react';
import { Spinner } from '../components/ui';
import { tr } from '../lib/i18n';

const Memory = lazy(() => import('./Memory'));
const Mezuzah = lazy(() => import('./Mezuzah'));

type Tab = 'home' | 'flashcards' | 'mezuzah';
export default function ToolsAndGames() {
  const [tab,setTab]=useState<Tab>('home');
  if(tab==='flashcards')return (
    <div className="scroll-area h-full">
      <div className="mx-auto max-w-3xl px-4 pt-3">
        <button onClick={()=>setTab('home')} type="button" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-outline/50 px-4 text-sm">← {tr('Ferramentas e Games','Tools and Games','Herramientas y juegos')}</button>
      </div>
      <Suspense fallback={<Spinner/>}><Memory /></Suspense>
    </div>
  );
  if(tab==='mezuzah')return <Suspense fallback={<Spinner/>}><Mezuzah onBack={()=>setTab('home')}/></Suspense>;
  return (
    <div className="scroll-area h-full">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-[.2em] text-primary">{tr('Aprender · praticar · compartilhar','Learn · practice · share','Aprender · practicar · compartir')}</p>
          <h2 className="mt-2 font-reading text-3xl sm:text-4xl">{tr('Ferramentas e Games','Tools and Games','Herramientas y juegos')}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">{tr(
            'Seu espaço de estudo e diversão bíblica. Todos os cartões de memorização anteriores estão aqui, sem perder seu histórico.',
            'Your place for biblical study and play. Your existing flashcards and review history are still here.',
            'Su espacio para estudiar y jugar. Sus tarjetas y su historial de repaso siguen aquí.',
          )}</p>
        </div>
        <div className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
          <button type="button" onClick={()=>setTab('mezuzah')} className="group relative min-h-[280px] overflow-hidden rounded-[25px] border border-[#a98350]/40 bg-gradient-to-br from-[#141f23] via-[#33302e] to-[#633b2c] p-6 text-left text-[#faefd8] shadow-xl transition hover:-translate-y-1 hover:shadow-2xl sm:p-8">
            <div className="absolute -right-10 -top-16 h-56 w-56 rotate-[35deg] rounded-3xl border-[19px] border-[#bb8961] bg-[conic-gradient(#f5ead8_25%,#a34c35_0_50%,#f5ead8_0_75%,#a34c35_0)] bg-[length:60px_60px] opacity-35 shadow-2xl transition-transform group-hover:rotate-[25deg]"/>
            <span className="relative inline-flex items-center gap-2 rounded-full border border-[#e7c28a]/40 bg-black/30 px-3 py-1 text-xs text-[#f1d29b]"><Sparkles size={14}/> {tr('Novo · Tabuleiro 3D','New · 3D board','Nuevo · Tablero 3D')}</span>
            <h3 className="relative mt-8 font-reading text-4xl font-semibold">Mezuzá 3D</h3>
            <p className="relative mt-3 max-w-[290px] text-sm leading-relaxed text-[#e9e3d6]">Uma aventura bíblica sobre madeira esculpida. Desafie amigos e descubra as Escrituras a cada jogada.</p>
            <span className="relative mt-5 inline-flex items-center gap-2 rounded-full bg-[#e8ce98] px-5 py-3 text-sm font-semibold text-[#29201b]">{tr('Jogar agora','Play now','Jugar ahora')} <ArrowRight size={16}/></span>
          </button>
          <button type="button" onClick={()=>setTab('flashcards')} className="group rounded-[25px] border border-outline/50 bg-surface-low p-6 text-left shadow-md transition hover:-translate-y-1 hover:shadow-lg sm:p-8">
            <span className="inline-flex rounded-2xl bg-secondary-container p-3 text-primary"><Brain size={28}/></span>
            <h3 className="mt-5 text-2xl font-semibold">{tr('Memorização','Memorization','Memorización')}</h3>
            <p className="mt-3 text-sm leading-relaxed text-muted">{tr('Cartões, revisões espaçadas, lembretes diários e seu progresso preservado.','Flashcards, spaced repetition, daily reminders and saved progress.','Tarjetas, repaso espaciado, recordatorios diarios y progreso guardado.')}</p>
            <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-primary">{tr('Abrir meus cartões','Open my cards','Abrir mis tarjetas')} <ArrowRight size={17}/></span>
          </button>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-outline/30 bg-surface p-4">
            <div className="flex items-center gap-2 font-semibold"><Gamepad2 size={20} className="text-primary"/> {tr('Jogo local','Local play','Juego local')}</div>
            <p className="mt-2 text-sm text-muted">{tr('A partida funciona sem rede para 2 a 4 jogadores no mesmo dispositivo.','Play offline with 2–4 players sharing one device.','Juegue sin conexión con 2–4 jugadores en un dispositivo.')}</p>
          </div>
          <div className="rounded-2xl border border-outline/30 bg-surface p-4">
            <div className="flex items-center gap-2 font-semibold"><WifiOff size={20} className="text-primary"/> {tr('Salas pela internet','Internet rooms','Salas por internet')}</div>
            <p className="mt-2 text-sm text-muted">{tr('A conexão multiplayer necessita de um servidor para salas e sincronização. Não está ativa nesta publicação.','Multiplayer requires a room server and synchronization. It is not active in this release.','El multijugador requiere servidor y sincronización. No está activo en esta versión.')}</p>
          </div>
        </div>
        <p className="mt-5 flex items-center gap-2 text-xs text-muted"><BookOpen size={15}/>{tr('O jogo é uma criação educativa original, não uma representação de rito religioso.','This is an original educational game, not a depiction of a religious rite.','Este es un juego educativo original, no una representación ritual.')}</p>
      </div>
    </div>
  );
}
