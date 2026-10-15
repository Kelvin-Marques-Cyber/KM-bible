import {
  ArrowLeft,
  BookOpen,
  Check,
  ChevronRight,
  Compass,
  Pause,
  Play,
  RotateCcw,
  ScrollText,
  Volume2,
  VolumeX,
} from "lucide-react";
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { message, Spinner } from "../../components/ui";
import { app } from "../../lib/app";
import { verse } from "../../lib/content";
import { createCard, showPassage } from "../../screens/open";
import CampaignCanvas from "./CampaignCanvas";
import CampaignPortrait from "./CampaignPortrait";
import { CampaignAudio } from "./campaign-audio";
import { episodePassage, memoryReference } from "./campaign-bible";
import {
  CAMPAIGN_EPISODES,
  CAMPAIGN_SAGAS,
  type ChronicleEpisode,
} from "./campaign-content";
import {
  answerJourney,
  beginOrResume,
  closeJourneyDialogue,
  emptyProgress,
  interactJourney,
  moveJourney,
  nearestStation,
  newJourney,
  progressWithJourney,
  type CampaignProgress,
  type JourneyState,
} from "./campaign-engine";
import {
  CampaignSaveError,
  exportCampaignArchive,
  loadCampaign,
  preserveAndRestartCampaign,
  recoverCampaign,
  saveCampaign,
} from "./campaign-persistence";
import "./campaign.css";

const Pilot = lazy(() => import("../../screens/Chronicles"));
const idle = { dx: 0, dy: 0, run: false };
const noop = () => {};

/** The compact journeys and the extended pilot deliberately keep separate saves. */
export default function CampaignChronicles({ onBack }: { onBack: () => void }) {
  const [progress, setProgress] = useState<CampaignProgress>(emptyProgress);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [recoverable, setRecoverable] = useState(false);
  const [recoveryBusy, setRecoveryBusy] = useState(false);
  const [confirmRecoveryReset, setConfirmRecoveryReset] = useState(false);
  const [saved, setSaved] = useState("");
  const [saga, setSaga] = useState(0);
  const [pilot, setPilot] = useState(false);
  const [paused, setPaused] = useState(false);
  const [hidden, setHidden] = useState(document.hidden);
  const [codex, setCodex] = useState(false);
  const [journalOpen, setJournalOpen] = useState(false);
  const [restart, setRestart] = useState(false);
  const [touch, setTouch] = useState(idle);
  const [music, setMusic] = useState(false);
  const audio = useRef<CampaignAudio | null>(null);
  const previousSound = useRef<JourneyState | undefined>();
  const [busyMemory, setBusyMemory] = useState(false);
  const latest = useRef(progress);
  const ready = useRef(false);
  const lastSaved = useRef<CampaignProgress | null>(null);
  const saving = useRef<Promise<void> | null>(null);
  const mounted = useRef(false);
  const memoryLock = useRef(false);
  const audioBusy = useRef(false);
  const scene = useRef<HTMLDivElement>(null);
  latest.current = progress;
  const activeId = progress.activeEpisodeId;
  const game = activeId ? progress.episodes[activeId] : undefined;
  const episode = CAMPAIGN_EPISODES.find((e) => e.id === activeId);
  const intro = game?.introduced === false;
  useEffect(() => {
    audio.current?.setActive(
      music && !hidden && !paused && !intro && !codex && !journalOpen && !pilot && !!episode,
      episode?.saga ?? 0,
    );
  }, [music, hidden, paused, intro, codex, journalOpen, pilot, episode]);
  useEffect(() => {
    const before = previousSound.current;
    if (music && game && before?.episodeId === game.episodeId) {
      if (game.phase === "complete" && before.phase !== "complete")
        audio.current?.cue("victory");
      else if (game.visited.length > before.visited.length)
        audio.current?.cue("discovery");
      else if (game.attempts > before.attempts) audio.current?.cue("wrong");
    }
    previousSound.current = game;
  }, [game, music]);
  useEffect(
    () => () => {
      audio.current?.close();
      audio.current = null;
    },
    [],
  );
  const toggleAudio = async () => {
    if (audioBusy.current) return;
    if (music) {
      audio.current?.close();
      audio.current = null;
      setMusic(false);
      return;
    }
    audioBusy.current = true;
    const sound = new CampaignAudio();
    const enabled = await sound.enable();
    audioBusy.current = false;
    if (!mounted.current) {
      sound.close();
      return;
    }
    if (enabled) {
      audio.current = sound;
      setMusic(true);
    } else {
      sound.close();
      message(
        "Áudio indisponível neste navegador. A aventura continua normalmente.",
      );
    }
  };

  const flush = useCallback(async () => {
    if (!ready.current || latest.current === lastSaved.current) return;
    const snapshot = latest.current;
    if (saving.current) {
      await saving.current;
      if (snapshot === lastSaved.current) return;
    }
    try {
      const task = saveCampaign(snapshot);
      saving.current = task.catch(() => {});
      await task;
      lastSaved.current = snapshot;
      if (mounted.current) {
        setSaved("Progresso salvo neste aparelho");
        setError("");
      }
    } catch {
      if (mounted.current) {
        setSaved("Falha ao salvar");
        setError(
          "Não foi possível salvar. Mantenha esta sessão aberta e tente salvar novamente.",
        );
      }
    }
  }, []);
  useEffect(() => {
    mounted.current = true;
    let cancelled = false;
    void loadCampaign()
      .then((value) => {
        if (cancelled) return;
        latest.current = value;
        lastSaved.current = value;
        setProgress(value);
        setSaga(value.selectedSaga ?? 0);
        ready.current = true;
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
          setRecoverable(e instanceof CampaignSaveError && e.recoverable);
        }
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
      mounted.current = false;
      void flush();
    };
  }, [flush]);
  const checkpoint = game
    ? `${game.episodeId}:${game.visited.join(",")}:${game.phase}:${game.dialogue}:${game.attempts}:${game.introduced}`
    : "map";
  useEffect(() => {
    if (loaded && ready.current) void flush();
  }, [checkpoint, loaded, flush]);
  useEffect(() => {
    if (!loaded || !ready.current) return;
    const timer = setTimeout(() => void flush(), 450);
    return () => clearTimeout(timer);
  }, [progress, loaded, flush]);
  useEffect(() => {
    const timer = setInterval(() => void flush(), 5000);
    const stop = () => setTouch(idle);
    const visibility = () => {
      setHidden(document.hidden);
      stop();
      if (document.hidden) void flush();
    };
    const leave = () => {
      stop();
      void flush();
    };
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
    window.addEventListener("blur", leave);
    window.addEventListener("pagehide", leave);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      clearInterval(timer);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
      window.removeEventListener("blur", leave);
      window.removeEventListener("pagehide", leave);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [flush]);
  const change = useCallback((fn: (state: JourneyState) => JourneyState) => {
    setProgress((previous) => {
      const id = previous.activeEpisodeId;
      if (!id || !previous.episodes[id]) return previous;
      const before = previous.episodes[id],
        next = fn(before);
      if (next === before) return previous;
      const result = progressWithJourney(previous, next);
      latest.current = result;
      return result;
    });
  }, []);
  const move = useCallback(
    (dx: number, dy: number, dt: number, run: boolean) =>
      change((g) => moveJourney(g, dx, dy, dt, run)),
    [change],
  );
  const focusScene = () =>
    requestAnimationFrame(() =>
      scene.current?.querySelector("canvas")?.focus({ preventScroll: true }),
    );
  const interact = useCallback(
    () => change((g) => interactJourney(g)),
    [change],
  );
  const begin = (id: string, reset = false) => {
    const state = reset ? newJourney(id) : beginOrResume(latest.current, id);
    const next = {
      ...progressWithJourney(latest.current, state),
      activeEpisodeId: id,
      selectedSaga: CAMPAIGN_EPISODES.find((e) => e.id === id)!.saga,
    };
    latest.current = next;
    setProgress(next);
    setPaused(false);
    setCodex(false);
    setJournalOpen(false);
    setRestart(false);
    setTouch(idle);
    focusScene();
  };
  const select = () => {
    const next = { ...latest.current, activeEpisodeId: null };
    latest.current = next;
    setProgress(next);
    setPaused(false);
    setCodex(false);
    setJournalOpen(false);
    setTouch(idle);
    void flush();
  };
  const openRef = (e: ChronicleEpisode) => {
    setPaused(true);
    setTouch(idle);
    void flush();
    const passage = episodePassage(e);
    showPassage(passage.start, { end: passage.end });
  };
  const memorize = async (e: ChronicleEpisode) => {
    if (memoryLock.current) return;
    memoryLock.current = true;
    setBusyMemory(true);
    setPaused(true);
    setTouch(idle);
    void flush();
    try {
      const text = await verse(app.translation, memoryReference(e));
      if (!text) {
        message(
          "Baixe esta passagem na Biblioteca para criar um cartão com o texto da sua tradução instalada.",
        );
        return;
      }
      createCard(memoryReference(e), text.text);
    } catch {
      message(
        "A passagem precisa estar disponível na Biblioteca. Baixe o livro correspondente e tente novamente.",
      );
    } finally {
      memoryLock.current = false;
      if (mounted.current) setBusyMemory(false);
    }
  };
  const recover = async (reset = false) => {
    if (recoveryBusy) return;
    setRecoveryBusy(true);
    try {
      const next = reset
        ? await preserveAndRestartCampaign()
        : await recoverCampaign();
      latest.current = next;
      setProgress(next);
      setSaga(next.selectedSaga ?? 0);
      ready.current = true;
      setError("");
      setRecoverable(false);
      setConfirmRecoveryReset(false);
      setSaved(
        reset
          ? "Cópia anterior preservada; nova jornada criada"
          : "Cópia de segurança recuperada",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (mounted.current) setRecoveryBusy(false);
    }
  };
  const exportSave = async () => {
    try {
      if (ready.current) await flush();
      const archive = await exportCampaignArchive(
        ready.current ? latest.current : undefined,
      );
      const url = URL.createObjectURL(
        new Blob([archive], { type: "application/json" }),
      );
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "cronicas-da-alianca-aventuras.json";
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      message("Não foi possível exportar o progresso deste aparelho.");
    }
  };
  if (!loaded) return <Spinner />;
  if (pilot)
    return (
      <Suspense fallback={<Spinner />}>
        <Pilot onBack={() => setPilot(false)} backLabel="Mapa de aventuras" />
      </Suspense>
    );
  const near = game ? nearestStation(game) : null;
  const nextEpisode = episode && CAMPAIGN_EPISODES[episode.number];
  const refButtons = episode && (
    <div className="ca-actions">
      <button className="ca-button" onClick={() => openRef(episode)}>
        <BookOpen size={16} />
        Ler {episode.reference.label}
      </button>
      {episode.id === "resurrection" && (
        <button
          className="ca-button"
          onClick={() => {
            setPaused(true);
            void flush();
            showPassage(
              { book: 43, chapter: 19, verse: 16 },
              { end: { book: 43, chapter: 19, verse: 42 } },
            );
          }}
        >
          Ler crucificação e sepultamento · João 19:16–42
        </button>
      )}
      <button
        className="ca-button"
        disabled={busyMemory}
        onClick={() => void memorize(episode)}
      >
        Criar cartão de memorização
      </button>
    </div>
  );
  return (
    <div
      className={"ca-root scroll-area h-full" + (episode && game ? " ca-playing" : "")}
      onKeyDown={(event) => {
        if (
          event.key === "Escape" &&
          game?.phase === "explore" &&
          game.dialogue === null &&
          !intro &&
          !restart
        ) {
          event.stopPropagation();
          setTouch(idle);
          if (codex) setCodex(false);
          else if (journalOpen) setJournalOpen(false);
          else setPaused((value) => !value);
          void flush();
          focusScene();
        }
      }}
    >
      <main className="ca-shell">
        <header className="ca-header">
          <button
            className="ca-button"
            onClick={() => {
              void flush();
              onBack();
            }}
          >
            <ArrowLeft size={16} />
            Ferramentas e Games
          </button>
          <div>
            <span className="ca-eyebrow">KM-BIBLE · RPG BÍBLICO 2D</span>
            <h2>Crônicas da Aliança</h2>
          </div>
          <div className="ca-total">
            <strong>{progress.completed.length}/36</strong>
            <span>aventuras concluídas</span>
          </div>
        </header>
        {error && (
          <div role="alert" className="ca-error">
            {error}
            {ready.current && (
              <button className="ca-button" onClick={() => void flush()}>
                Tentar salvar novamente
              </button>
            )}
          </div>
        )}
        {!ready.current ? (
          <section className="ca-codex">
            <p>
              O save anterior foi preservado. Você pode exportar uma cópia antes
              de recuperar ou recomeçar.
            </p>
            <div className="ca-actions">
              {recoverable && (
                <button
                  className="ca-button ca-primary"
                  disabled={recoveryBusy}
                  onClick={() => void recover()}
                >
                  Recuperar cópia de segurança
                </button>
              )}
              <button className="ca-button" onClick={() => void exportSave()}>
                Exportar progresso
              </button>
              <button
                className="ca-button"
                onClick={() => setConfirmRecoveryReset(true)}
              >
                Preservar cópia e recomeçar
              </button>
            </div>
            {confirmRecoveryReset && (
              <div>
                <p>
                  O progresso atual será arquivado neste aparelho e as 36
                  aventuras serão reiniciadas. O piloto e os outros jogos
                  continuam preservados.
                </p>
                <div className="ca-actions">
                  <button
                    className="ca-button"
                    disabled={recoveryBusy}
                    onClick={() => void recover(true)}
                  >
                    Confirmar nova jornada
                  </button>
                  <button
                    className="ca-button"
                    onClick={() => setConfirmRecoveryReset(false)}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </section>
        ) : episode && game ? (
          <>
            <div className="ca-episode-header">
              <button className="ca-button" onClick={select}>
                <ArrowLeft size={16} />
                Mapa de aventuras
              </button>
              <div>
                <span className="ca-eyebrow">
                  {CAMPAIGN_SAGAS[episode.saga].title} · {episode.number}/36
                </span>
                <h3>{episode.title}</h3>
              </div>
              <button
                className="ca-button"
                aria-pressed={codex}
                onClick={() => {
                  setTouch(idle);
                  setCodex(!codex);
                  setJournalOpen(false);
                }}
              >
                <ScrollText size={16} />
                Códice {game.visited.length}/3
              </button>
              <button type="button" className="ca-button" aria-label="Abrir diário de missões"
                aria-pressed={journalOpen}
                onClick={() => { setTouch(idle); setJournalOpen(!journalOpen); setCodex(false); }}>
                <Compass size={16} /> Missões
              </button>
              <button
                className="ca-button"
                onClick={() => {
                  setPaused(!paused);
                  setTouch(idle);
                  void flush();
                  focusScene();
                }}
              >
                {paused ? <Play size={16} /> : <Pause size={16} />}
                {paused ? "Continuar exploração" : "Pausar"}
              </button>
              <button
                className="ca-button"
                aria-pressed={music}
                onClick={() => void toggleAudio()}
              >
                {music ? <Volume2 size={16} /> : <VolumeX size={16} />}
                {music ? "Som ligado" : "Ativar som"}
              </button>
            </div>
            <div className="ca-game-layout">
              <section className="ca-stage" aria-label="Cenário da aventura">
                <div
                  className={"ca-canvas ca-scene-enter" + ((intro || restart || game.dialogue !== null || ((game.phase === "trial" || game.phase === "complete") && !codex)) ? " ca-has-dialog" : "")}
                  key={episode.id}
                  ref={scene}
                >
                  <CampaignCanvas
                    episode={episode}
                    game={game}
                    paused={
                      paused ||
                      hidden ||
                      codex ||
                      journalOpen ||
                      intro ||
                      restart ||
                      game.dialogue !== null ||
                      game.phase !== "explore"
                    }
                    input={touch}
                    onMove={move}
                    onInteract={interact}
                  />
                  <div className="ca-world-label" aria-hidden="true">
                    {episode.reference.label}
                    <span>{game.visited.length} de 3 testemunhos</span>
                  </div>
                  {paused && !intro && (
                    <div className="ca-pause">
                      Jornada pausada
                      <button
                        className="ca-button ca-primary"
                        onClick={() => {
                          setPaused(false);
                          focusScene();
                        }}
                      >
                        Retomar jornada
                      </button>
                    </div>
                  )}
                </div>
                <div className="ca-controls">
                  <div
                    className="ca-dpad"
                    role="group"
                    aria-label="Controles de movimento"
                  >
                    {(
                      [
                        ["Cima", 0, -1, "↑"],
                        ["Esquerda", -1, 0, "←"],
                        ["Baixo", 0, 1, "↓"],
                        ["Direita", 1, 0, "→"],
                      ] as const
                    ).map(([label, dx, dy, glyph]) => (
                      <button
                        key={label}
                        className={"ca-direction ca-" + label.toLowerCase()}
                        aria-label={"Caminhar para " + label.toLowerCase()}
                        disabled={
                          paused ||
                          intro ||
                          codex ||
                          journalOpen ||
                          restart ||
                          game.dialogue !== null ||
                          game.phase !== "explore"
                        }
                        onPointerDown={(event) => {
                          event.preventDefault();
                          event.currentTarget.setPointerCapture?.(
                            event.pointerId,
                          );
                          setTouch({ dx, dy, run: false });
                        }}
                        onPointerUp={() => setTouch(idle)}
                        onPointerCancel={() => setTouch(idle)}
                        onLostPointerCapture={() => setTouch(idle)}
                        onContextMenu={(e) => e.preventDefault()}
                      >
                        {glyph}
                      </button>
                    ))}
                  </div>
                  <div className="ca-control-help">
                    <span>WASD / setas · Shift para correr</span>
                    <span>E / Enter para investigar</span>
                  </div>
                  <button
                    className="ca-button ca-primary ca-interact"
                    disabled={
                      paused ||
                      intro ||
                      codex ||
                      journalOpen ||
                      game.phase !== "explore" ||
                      game.dialogue !== null
                    }
                    onClick={interact}
                  >
                    <Compass size={18} />
                    Investigar{near !== null ? " · " + (near + 1) : ""}
                  </button>
                </div>
                <p className="ca-feedback" role="status">
                  {game.feedback}
                </p>
              </section>
              {journalOpen && <aside className="ca-journal" aria-label="Diário da jornada">
                <button type="button" className="ca-button ca-journal-close" onClick={() => { setJournalOpen(false); focusScene(); }} aria-label="Fechar diário de missões">✕ Fechar diário</button>
                <div className="ca-witness">
                  <CampaignPortrait episode={episode} />
                  <p>
                    {episode.hero}
                    <small>Seu papel nesta narrativa</small>
                  </p>
                </div>
                <span className="ca-eyebrow">DIÁRIO DA JORNADA</span>
                <h4>
                  {game.phase === "complete"
                    ? "História concluída"
                    : game.phase === "trial"
                      ? "Reúna o que aprendeu"
                      : "Encontre os três lugares"}
                </h4>
                <ol>
                  {episode.stations.map((station, i) => (
                    <li
                      key={station.name}
                      className={game.visited.includes(i) ? "ca-found" : ""}
                    >
                      <span>
                        {game.visited.includes(i) ? <Check size={15} /> : i + 1}
                      </span>
                      <div>
                        {station.name}
                        <small>
                          {game.visited.includes(i)
                            ? "Registrado no códice"
                            : "Aproxime-se do símbolo no cenário"}
                        </small>
                      </div>
                    </li>
                  ))}
                </ol>
                {refButtons}
                <button
                  className="ca-button ca-restart"
                  onClick={() => {
                    setRestart(true);
                    setTouch(idle);
                  }}
                >
                  <RotateCcw size={15} />
                  Reiniciar episódio
                </button>
                <p className="ca-save" aria-live="polite">
                  {saved || "Salvamento automático ativo"}
                </p>
              </aside>}
            </div>
            {codex && (
              <section className="ca-codex" aria-label="Códice de descobertas">
                <div className="ca-episode-header">
                  <h3>Códice de descobertas</h3>
                  <button
                    className="ca-button"
                    onClick={() => {
                      setCodex(false);
                      focusScene();
                    }}
                  >
                    Voltar ao cenário
                  </button>
                </div>
                <p>
                  Contextualização autoral. Leia a passagem para conferir o
                  testemunho bíblico.
                </p>
                <div className="ca-codex-grid">
                  {game.visited.map((i) => (
                    <article key={i}>
                      <span className="ca-eyebrow">TESTEMUNHO {i + 1}</span>
                      <h4>{episode.stations[i].name}</h4>
                      <p>{episode.stations[i].discovery}</p>
                    </article>
                  ))}
                </div>
                {game.visited.length === 0 && (
                  <p>
                    As descobertas aparecerão aqui depois de investigar os
                    lugares do cenário.
                  </p>
                )}
                {refButtons}
              </section>
            )}
            {intro && !restart && (
              <JourneyDialog
                episode={episode}
                title="Antes de partir"
                label="Introdução da aventura"
              >
                <span className="ca-eyebrow">{episode.reference.label}</span>
                <h3>{episode.title}</h3>
                <p>{episode.intro}</p>
                <p className="ca-fiction">
                  Seu papel: {episode.hero}. O cenário é uma representação
                  artística; personagens de apoio e deslocamentos são ficção
                  complementar. Os fatos bíblicos não mudam.
                </p>
                <button
                  className="ca-button ca-primary"
                  onClick={() => {
                    change((g) => ({ ...g, introduced: true }));
                    focusScene();
                  }}
                >
                  Iniciar exploração <ChevronRight size={17} />
                </button>
              </JourneyDialog>
            )}
            {!intro && !restart && game.dialogue !== null && (
              <JourneyDialog
                episode={episode}
                title={episode.stations[game.dialogue].name}
                label="Testemunho descoberto"
              >
                <span className="ca-eyebrow">
                  DESCOBERTA {game.dialogue + 1}/3 · CONTEXTO BÍBLICO
                </span>
                <p>{episode.stations[game.dialogue].discovery}</p>
                <button
                  className="ca-button ca-primary"
                  onClick={() => {
                    change(closeJourneyDialogue);
                    focusScene();
                  }}
                >
                  Registrar e continuar
                </button>
              </JourneyDialog>
            )}
            {!intro && !restart && game.phase === "trial" && !codex && (
              <JourneyDialog
                episode={episode}
                title="O desafio do capítulo"
                label="Desafio de conhecimento bíblico"
              >
                <p>{episode.trial.prompt}</p>
                <div className="ca-answers">
                  {episode.trial.choices.map((choice, i) => (
                    <button
                      key={choice}
                      className="ca-button"
                      onClick={() => change((g) => answerJourney(g, i))}
                    >
                      {String.fromCharCode(65 + i)}. {choice}
                    </button>
                  ))}
                </div>
                {game.attempts > 0 && <p role="status">{game.feedback}</p>}
                <div className="ca-actions">
                  <button className="ca-button" onClick={() => setCodex(true)}>
                    Rever descobertas
                  </button>
                  <button
                    className="ca-button"
                    onClick={() => openRef(episode)}
                  >
                    Consultar passagem
                  </button>
                </div>
              </JourneyDialog>
            )}
            {!intro && !restart && game.phase === "complete" && !codex && (
              <JourneyDialog
                episode={episode}
                title="Uma história guardada"
                label="Conclusão da aventura"
              >
                <span className="ca-victory">✦</span>
                <h3>{episode.title}</h3>
                <p>{episode.trial.explanation}</p>
                <p>{episode.ending}</p>
                {refButtons}
                <div className="ca-actions">
                  {nextEpisode && (
                    <button
                      className="ca-button ca-primary"
                      onClick={() => {
                        setSaga(nextEpisode.saga);
                        begin(nextEpisode.id);
                      }}
                    >
                      Próximo capítulo <ChevronRight size={17} />
                    </button>
                  )}
                  <button className="ca-button" onClick={select}>
                    Voltar ao mapa
                  </button>
                  <button className="ca-button" onClick={() => setCodex(true)}>
                    Rever descobertas
                  </button>
                </div>
                {!nextEpisode && (
                  <p>
                    A jornada chega ao fim. As seis sagas continuam disponíveis
                    para explorar e revisar.
                  </p>
                )}
              </JourneyDialog>
            )}
            {restart && (
              <JourneyDialog
                episode={episode}
                title="Recomeçar esta aventura?"
                label="Confirmar reinício"
              >
                <p>
                  Somente o progresso de {episode.title} será reiniciado. As
                  outras aventuras, o piloto e seus cartões serão preservados.
                </p>
                <div className="ca-actions">
                  <button
                    className="ca-button"
                    onClick={() => setRestart(false)}
                  >
                    Cancelar
                  </button>
                  <button
                    className="ca-button ca-primary"
                    onClick={() => begin(episode.id, true)}
                  >
                    Confirmar reinício
                  </button>
                </div>
              </JourneyDialog>
            )}
          </>
        ) : (
          <>
            <section className="ca-hero">
              <div className="ca-hero-art" aria-hidden="true">
                <CampaignCanvas
                  episode={CAMPAIGN_EPISODES[saga * 6]}
                  game={newJourney(CAMPAIGN_EPISODES[saga * 6].id)}
                  paused
                  decorative
                  input={idle}
                  onMove={noop}
                  onInteract={noop}
                />
              </div>
              <div className="ca-hero-copy">
                <span className="ca-eyebrow">
                  SEIS SAGAS · UMA HISTÓRIA DE ESPERANÇA
                </span>
                <h3>
                  Entre caminhos,
                  <br />
                  guarde testemunhos.
                </h3>
                <p>
                  36 aventuras compactas de exploração: caminhe, investigue e
                  conheça a história bíblica. Cada capítulo reúne três
                  descobertas e um desafio.
                </p>
                <span className="ca-offline">
                  ✦ Teclado e toque · save automático · cenários offline
                </span>
              </div>
            </section>
            <button
              className="ca-pilot"
              onClick={() => {
                void flush();
                setPilot(true);
              }}
            >
              <span className="ca-pilot-icon">✦</span>
              <div>
                <span className="ca-eyebrow">
                  EPISÓDIO ORIGINAL AMPLIADO · 1 SAMUEL 16–17
                </span>
                <h3>O Vale e a Coragem</h3>
                <p>
                  Uma campanha mais longa com três mapas, vizinhos, missões,
                  escolhas e inventário. Save independente.
                </p>
              </div>
              <ChevronRight size={24} />
            </button>
            <section aria-label="Selecionar saga" className="ca-sagas">
              {CAMPAIGN_SAGAS.map((item, index) => {
                const done = progress.completed.filter(
                  (id) =>
                    CAMPAIGN_EPISODES.find((e) => e.id === id)?.saga === index,
                ).length;
                return (
                  <button
                    key={item.id}
                    style={
                      { "--saga-color": item.color } as React.CSSProperties
                    }
                    className="ca-saga"
                    aria-pressed={saga === index}
                    onClick={() => {
                      setSaga(index);
                      const next = { ...latest.current, selectedSaga: index };
                      latest.current = next;
                      setProgress(next);
                    }}
                  >
                    <span className="ca-saga-number">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div>
                      <h3>{item.title}</h3>
                      <p>{item.caption}</p>
                      <progress
                        value={done}
                        max={6}
                        aria-label={"Progresso de " + item.title}
                      />
                      <span>{done}/6 concluídas</span>
                    </div>
                  </button>
                );
              })}
            </section>
            <section
              className="ca-chapters"
              aria-label={"Capítulos de " + CAMPAIGN_SAGAS[saga].title}
            >
              <div className="ca-chapter-heading">
                <div>
                  <span className="ca-eyebrow">SAGA {saga + 1}</span>
                  <h3>{CAMPAIGN_SAGAS[saga].title}</h3>
                </div>
                <p>Todos os capítulos estão disponíveis.</p>
              </div>
              <div className="ca-chapter-grid">
                {CAMPAIGN_EPISODES.filter((e) => e.saga === saga).map((e) => {
                  const state = progress.episodes[e.id];
                  return (
                    <button
                      className="ca-chapter"
                      key={e.id}
                      onClick={() => begin(e.id)}
                      aria-label={
                        (state ? "Continuar " : "Explorar ") + e.title
                      }
                    >
                      <span className="ca-chapter-top">
                        <span>
                          CAPÍTULO {String(e.number).padStart(2, "0")}
                        </span>
                        {state?.phase === "complete" && <Check size={18} />}
                      </span>
                      <h4>{e.title}</h4>
                      <p>{e.reference.label}</p>
                      <span className="ca-chapter-bottom">
                        {state?.phase === "complete"
                          ? "Revisitar história"
                          : state
                            ? "Continuar · " +
                              state.visited.length +
                              "/3 descobertas"
                            : "Iniciar aventura"}
                        <ChevronRight size={16} />
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
            <button className="ca-button" onClick={() => void exportSave()}>
              Exportar progresso das aventuras
            </button>
            <p className="ca-footnote">
              Escritura e ficção complementar: a narrativa não altera
              acontecimentos bíblicos nem oferece milagres como poderes.
              Cenários e textos autorais ficam disponíveis offline com a
              instalação da PWA; o texto de cada tradução deve ser baixado na
              Biblioteca.
            </p>
          </>
        )}
      </main>
    </div>
  );
}

function JourneyDialog({
  title,
  label,
  children,
  episode,
}: {
  title: string;
  label: string;
  children: React.ReactNode;
  episode: ChronicleEpisode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const [sceneHost, setSceneHost] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setSceneHost(document.querySelector<HTMLElement>(".ca-scene-enter"));
    panel.current?.focus({ preventScroll: true });
  }, [episode.id]);
  const dialog = (
    <div className="ca-modal-backdrop">
      <div
        className="ca-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        ref={panel}
        onKeyDown={(event) => {
          if (event.key !== "Tab") return;
          const targets = Array.from(
            panel.current?.querySelectorAll<HTMLButtonElement>(
              "button:not(:disabled),[href]",
            ) ?? [],
          );
          const first = targets[0],
            last = targets[targets.length - 1];
          if (
            event.shiftKey &&
            (document.activeElement === first ||
              document.activeElement === panel.current)
          ) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }}
      >
        <div className="ca-dialog-title">
          <CampaignPortrait episode={episode} />
          <h4>{title}</h4>
        </div>
        {children}
      </div>
    </div>
  );
  return sceneHost ? createPortal(dialog, sceneHost) : dialog;
}
