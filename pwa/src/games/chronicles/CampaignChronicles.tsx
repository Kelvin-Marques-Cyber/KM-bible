import {
  ArrowLeft,
  BookOpen,
  Backpack,
  Map,
  X,
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
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { message } from "../../components/ui";
import { app, sheets, useApp } from "../../lib/app";
import { verse } from "../../lib/content";
import { createCard, showPassage } from "../../screens/open";
import CampaignCanvas from "./CampaignCanvas";
import ChroniclesBoot from "./ChroniclesBoot";
import GameFront from "./GameFront";
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
  STATIONS,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  type CampaignProgress,
  type JourneyState,
} from "./campaign-engine";
import {
  CampaignSaveError,
  loadCampaign,
  preserveAndRestartCampaign,
  recoverCampaign,
  saveCampaign,
} from "./campaign-persistence";
import { activateSaveSlot, exportSaveSlots, overwriteSaveSlot, readSaveSlots, type SaveSlotSummary } from "./save-slots";
import { SAVE_SLOTS, type SaveSlot } from "./save-slot-key";
import "./campaign.css";
import "./campaign-gameplay.css";

const Pilot = lazy(() => import("../../screens/Chronicles"));
const idle = { dx: 0, dy: 0, run: false };
type JourneyMenu = "pause" | "journal" | "codex" | "inventory" | "map";
const externalSheetOpen = () => Array.from(document.querySelectorAll('[role="dialog"][aria-modal="true"]')).some(dialog => !dialog.closest(".ca-root"));

/** The compact journeys and the extended pilot deliberately keep separate saves. */
export default function CampaignChronicles({ onBack }: { onBack: () => void }) {
  useApp();
  const sheetOpen = sheets.length > 0;
  const hadSheet = useRef(sheetOpen);
  const sheetFocus = useRef<HTMLElement | null>(null);
  const [progress, setProgress] = useState<CampaignProgress>(emptyProgress);
  const [loaded, setLoaded] = useState(false);
  const [slot, setSlot] = useState<SaveSlot>(1);
  const [slots, setSlots] = useState<SaveSlotSummary[]>([]);
  const [slotBusy, setSlotBusy] = useState(false);
  const [recoveryMenu, setRecoveryMenu] = useState(false);
  const slotRef = useRef<SaveSlot>(1);
  const slotLock = useRef(false);
  const [error, setError] = useState("");
  const [recoverable, setRecoverable] = useState(false);
  const [recoveryBusy, setRecoveryBusy] = useState(false);
  const [confirmRecoveryReset, setConfirmRecoveryReset] = useState(false);
  const [saved, setSaved] = useState("");
  const [saga, setSaga] = useState(0);
  const [pilot, setPilot] = useState(false);
  const [inAdventure, setInAdventure] = useState(false);
  const [landing, setLanding] = useState<"title" | "world">("title");
  const [menu, setMenu] = useState<JourneyMenu | null>(null);
  const paused = menu === "pause";
  const codex = menu === "codex";
  const journalOpen = menu === "journal";
  const inventoryOpen = menu === "inventory";
  const mapOpen = menu === "map";
  const [hidden, setHidden] = useState(document.hidden);
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
      music && !hidden && !sheetOpen && !pilot && (!inAdventure || !menu && !intro),
      episode?.saga ?? 0,
    );
  }, [music, hidden, sheetOpen, menu, intro, pilot, episode, inAdventure]);
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
    if (!ready.current || latest.current === lastSaved.current) return true;
    const snapshot = latest.current;
    const saveSlot = slotRef.current;
    if (saving.current) {
      await saving.current;
      if (snapshot === lastSaved.current) return true;
    }
    try {
      const task = saveCampaign(snapshot, saveSlot);
      saving.current = task.catch(() => {});
      await task;
      lastSaved.current = snapshot;
      if (mounted.current) {
        setSaved("Progresso salvo neste aparelho");
        setError("");
      }
      return true;
    } catch {
      if (mounted.current) {
        setSaved("Falha ao salvar");
        setError(
          "Não foi possível salvar. Mantenha esta sessão aberta e tente salvar novamente.",
        );
      }
      return false;
    }
  }, []);
  useEffect(() => {
    mounted.current = true;
    let cancelled = false;
    void readSaveSlots().then(async catalog => {
      if (cancelled) return null;
      slotRef.current = catalog.active;
      setSlot(catalog.active);
      setSlots(catalog.slots);
      return loadCampaign(catalog.active);
    })
      .then((value) => {
        if (!value) return;
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
    requestAnimationFrame(() => {
      if (sheets.length || externalSheetOpen()) return;
      const target = scene.current?.closest(".ca-stage")?.querySelector<HTMLElement>('[role="dialog"]') ?? scene.current?.querySelector("canvas");
      target?.focus({ preventScroll: true });
    });
  const openMenu = (next: JourneyMenu | null) => {
    setTouch(idle);
    setMenu(next);
    if (next === "pause") void flush();
    if (!next) focusScene();
  };
  const toggleMenu = (next: JourneyMenu) => openMenu(menu === next ? null : next);
  useEffect(() => {
    const wasOpen = hadSheet.current;
    hadSheet.current = sheetOpen;
    if (sheetOpen) { setTouch(idle); return; }
    if (!wasOpen) return;
    const frame = requestAnimationFrame(() => {
      if (sheets.length || externalSheetOpen()) return;
      const previous = sheetFocus.current;
      sheetFocus.current = null;
      const target = previous?.isConnected && previous.closest(".ca-root") ? previous :
        document.querySelector<HTMLElement>(".ca-playing .ca-game-menu, .ca-playing .ca-dialog") ?? scene.current?.querySelector("canvas") ?? document.querySelector<HTMLElement>(".ca-front-active button");
      target?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [sheetOpen, inAdventure]);

  const titleScreen = () => {
    select();
    setLanding("title");
  };
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
    setMenu(null);
    setRestart(false);
    setLanding("title");
    setSaga(next.selectedSaga);
    setInAdventure(true);
    void activateSaveSlot(slotRef.current, "campaign").catch(() => setError("Não foi possível guardar o espaço ativo. Exporte seu save antes de sair."));
    setTouch(idle);
    focusScene();
  };
  const select = () => {
    setLanding("world");
    setInAdventure(false);
    setMenu(null);
    setTouch(idle);
    void flush().then(() => readSaveSlots()).then(catalog => { if (mounted.current) setSlots(catalog.slots); }).catch(() => {});
  };
  const openRef = (e: ChronicleEpisode) => {
    setMenu(current => current ?? (inAdventure && game?.phase === "explore" && !intro && game.dialogue === null ? "pause" : null));
    setTouch(idle);
    void flush();
    const passage = episodePassage(e);
    sheetFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    showPassage(passage.start, { end: passage.end });
  };
  const memorize = async (e: ChronicleEpisode) => {
    if (memoryLock.current) return;
    memoryLock.current = true;
    setBusyMemory(true);
    setMenu(current => current ?? (inAdventure && game?.phase === "explore" && !intro && game.dialogue === null ? "pause" : null));
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
      sheetFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
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
        ? await preserveAndRestartCampaign(slotRef.current)
        : await recoverCampaign(slotRef.current);
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
      const archive = await exportSaveSlots(ready.current ? { slot: slotRef.current, state: latest.current } : undefined);
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
  const chooseSlot = async (id: SaveSlot, overwrite: boolean, resume: boolean): Promise<boolean> => {
    if (slotLock.current) return false;
    slotLock.current = true;
    setSlotBusy(true);
    if (!await flush()) {
      slotLock.current = false;
      setSlotBusy(false);
      return false;
    }
    ready.current = false;
    slotRef.current = id;
    setSlot(id);
    setError("");
    try {
      if (overwrite) await overwriteSaveSlot(id);
      const value = await loadCampaign(id);
      if (!mounted.current) return false;
      latest.current = value;
      lastSaved.current = value;
      setProgress(value);
      setSaga(value.selectedSaga ?? 0);
      await activateSaveSlot(id);
      const catalog = await readSaveSlots();
      setSlots(catalog.slots);
      ready.current = true;
      setRecoveryMenu(false);
      setSaved("");
      setMenu(null);
      setTouch(idle);
      const summary = catalog.slots.find(s => s.id === id);
      if (resume && summary?.kind === "pilot") {
        setInAdventure(false);
        setPilot(true);
      } else if (resume) {
        const episodeId = value.activeEpisodeId ?? Object.values(value.episodes).at(-1)?.episodeId;
        if (episodeId) begin(episodeId);
      } else {
        setInAdventure(false);
        setLanding("world");
      }
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setRecoverable(e instanceof CampaignSaveError && e.recoverable);
      return false;
    } finally {
      slotLock.current = false;
      if (mounted.current) setSlotBusy(false);
    }
  };
  const openPilot = () => {
    setTouch(idle);
    void flush();
    void activateSaveSlot(slotRef.current, "pilot").catch(() => {});
    setPilot(true);
  };
  const visibleSlots = SAVE_SLOTS.map(id => {
    const stored = slots.find(s => s.id === id);
    if (id !== slot || !ready.current) return stored ?? { id, status: "empty", completed: 0, chapter: "Nova jornada", kind: "campaign", hasPilot: false } as SaveSlotSummary;
    const current = CAMPAIGN_EPISODES.find(e => e.id === progress.activeEpisodeId);
    return { ...stored, id, status: stored?.status === "damaged" ? "damaged" : stored?.hasPilot || Object.keys(progress.episodes).length ? "saved" : "empty", completed: progress.completed.length, episodeId: current?.id, saga: current?.saga, chapter: stored?.kind === "pilot" ? "O Vale e a Coragem" : current?.title ?? stored?.chapter ?? "Nova jornada", kind: stored?.kind ?? "campaign", hasPilot: stored?.hasPilot ?? false } as SaveSlotSummary;
  });
  if (!loaded) return <ChroniclesBoot />;
  if (pilot)
    return (
      <Suspense fallback={<ChroniclesBoot />}>
        <Pilot slot={slot} onBack={() => { setPilot(false); setInAdventure(false); setLanding("world"); void readSaveSlots().then(catalog => setSlots(catalog.slots)); }} backLabel="Mapa de aventuras" />
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
            setMenu(current => current ?? (inAdventure && game?.phase === "explore" && !intro && game.dialogue === null ? "pause" : null));
            setTouch(idle);
            void flush();
            sheetFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
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
      className={"ca-root h-full" + (inAdventure && episode && game ? " ca-playing" : " ca-front-active")}
      onKeyDown={(event) => {
        const target = event.target;
        if (!inAdventure || sheetOpen || event.repeat || event.altKey || event.ctrlKey || event.metaKey ||
          target instanceof HTMLElement && target.closest("input, textarea, select, [contenteditable=true]") || externalSheetOpen()) return;
        const key = event.key.toLowerCase();
        if (!["escape", "i", "j", "m", "c"].includes(key)) return;
        event.preventDefault();
        event.stopPropagation();
        if (restart) {
          if (key === "escape") { setRestart(false); openMenu("journal"); }
          return;
        }
        if (key === "escape") openMenu(menu ? null : "pause");
        else toggleMenu(({ i: "inventory", j: "journal", m: "map", c: "codex" } as const)[key as "i" | "j" | "m" | "c"]);
      }}
    >
      <main className="ca-shell">
        {(inAdventure && episode && game) && <header className="ca-header">
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
        </header>}
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
        {!ready.current && !slotBusy && !recoveryMenu ? (
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
              <button className="ca-button" onClick={() => setRecoveryMenu(true)}>
                Escolher outro save
              </button>
              <button className="ca-button" onClick={onBack}>Voltar para Ferramentas e Games</button>
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
        ) : inAdventure && episode && game ? (
          <>
            <div className="ca-game-layout">
              <section className="ca-stage" aria-label="Cenário da aventura">
                <div className="ca-episode-header ca-hud" aria-label="HUD da aventura">
                  <div className="ca-hud-chapter">
                    <span className="ca-eyebrow">{CAMPAIGN_SAGAS[episode.saga].title} · {episode.number}/36</span>
                    <h3>{episode.title}</h3>
                  </div>
                  <nav className="ca-hud-shortcuts" aria-label="Menus da aventura">
                    <button className="ca-button" aria-label="Abrir inventário" title="Inventário (I)" aria-pressed={inventoryOpen} onClick={() => toggleMenu("inventory")}><Backpack size={17}/><span>Bolsa</span><kbd>I</kbd></button>
                    <button className="ca-button" aria-label="Abrir diário de missões" title="Missões (J)" aria-pressed={journalOpen} onClick={() => toggleMenu("journal")}><Compass size={17}/><span>Missões</span><kbd>J</kbd></button>
                    <button className="ca-button" aria-label="Abrir mapa da aventura" title="Mapa (M)" aria-pressed={mapOpen} onClick={() => toggleMenu("map")}><Map size={17}/><span>Mapa</span><kbd>M</kbd></button>
                    <button className="ca-button" aria-label={`Códice ${game.visited.length}/3`} title="Códice (C)" aria-pressed={codex} onClick={() => toggleMenu("codex")}><ScrollText size={17}/><span>Códice {game.visited.length}/3</span><kbd>C</kbd></button>
                    <button className="ca-button" aria-label={paused ? "Continuar exploração" : "Pausar"} title="Pausa (Esc)" aria-pressed={paused} onClick={() => toggleMenu("pause")}><Pause size={17}/><span>Pausa</span><kbd>Esc</kbd></button>
                  </nav>
                </div>
                <div
                  className={"ca-canvas ca-scene-enter" + ((intro || restart || menu || game.dialogue !== null || game.phase !== "explore") ? " ca-has-dialog" : "")}
                  key={episode.id}
                  style={{ "--ca-camera-x": `${game.x / WORLD_WIDTH * 100}%`, "--ca-camera-y": `${game.y / WORLD_HEIGHT * 100}%` } as CSSProperties}
                  ref={scene}
                >
                  <CampaignCanvas
                    episode={episode}
                    game={game}
                    paused={
                      !!menu ||
                      hidden ||
                      sheetOpen ||
                      intro ||
                      restart ||
                      game.dialogue !== null ||
                      game.phase !== "explore"
                    }
                    input={touch}
                    onMove={move}
                    onInteract={interact}
                  />
                  <div className="ca-world-label ca-mission-hud" aria-label="Missão atual">
                    <strong>{game.phase === "complete" ? "Capítulo concluído" : game.phase === "trial" ? "Reúna o que aprendeu" : "Investigue os três testemunhos"}</strong>
                    <span>{game.visited.length}/3 encontrados · {episode.reference.label}</span>
                  </div>
                  <div className="ca-context-hint" aria-live="polite">
                    {near !== null && !game.visited.includes(near) ? `${episode.stations[near].name} · E para investigar` : "WASD / setas para caminhar · Shift para correr"}
                  </div>
                  {paused && (
                    <GameMenu className="ca-pause" label="Menu de pausa" onClose={() => openMenu(null)}>
                      <span className="ca-pause-icon" aria-hidden="true">✦</span>
                      <strong>Jornada pausada</strong>
                      <p>{saved || "Salvamento automático neste aparelho"}</p>
                      <div className="ca-pause-actions">
                        <button className="ca-button ca-primary" onClick={() => openMenu(null)}><Play size={17}/> Retomar jornada</button>
                        <button className="ca-button" onClick={() => openMenu("journal")}><Compass size={17}/> Missões e testemunhos</button>
                        <button className="ca-button" onClick={() => openMenu("inventory")}><Backpack size={17}/> Abrir inventário</button>
                        <button className="ca-button" onClick={() => openMenu("map")}><Map size={17}/> Mapa da aventura</button>
                        <button className="ca-button" onClick={() => void toggleAudio()}>{music ? <Volume2 size={17}/> : <VolumeX size={17}/>} {music ? "Som ligado" : "Ativar som"}</button>
                        <button className="ca-button" onClick={select}><ArrowLeft size={17}/> Voltar ao atlas</button>
                        <button className="ca-button" onClick={titleScreen}>Tela de título</button>
                        <button className="ca-button" onClick={() => { void flush(); onBack(); }}>Ferramentas e Games</button>
                      </div>
                      <small>ESC · Pausa &nbsp; I · Inventário &nbsp; J · Missões &nbsp; M · Mapa &nbsp; C · Códice</small>
                    </GameMenu>
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
                          !!menu ||
                          sheetOpen ||
                          intro ||
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
                      !!menu ||
                      sheetOpen ||
                      intro ||
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
              {journalOpen && <GameMenu className="ca-journal" label="Diário da jornada" onClose={() => openMenu(null)}>
                <button type="button" className="ca-button ca-journal-close" onClick={() => openMenu(null)} aria-label="Fechar diário de missões">✕ Fechar diário</button>
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
                    setMenu(null);
                    setTouch(idle);
                  }}
                >
                  <RotateCcw size={15} />
                  Reiniciar episódio
                </button>
                <p className="ca-save" aria-live="polite">
                  {saved || "Salvamento automático ativo"}
                </p>
              </GameMenu>}
            </div>
            {codex && (
              <GameMenu className="ca-codex" label="Códice de descobertas" onClose={() => openMenu(null)}>
                <div className="ca-menu-heading">
                  <h3>Códice de descobertas</h3>
                  <button
                    className="ca-button"
                    onClick={() => {
                      openMenu(null);
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
              </GameMenu>
            )}
            {inventoryOpen && (
              <GameMenu className="ca-inventory" label="Inventário da jornada" onClose={() => openMenu(null)}>
                <MenuTitle title="Bolsa da jornada" subtitle={episode.hero} closeLabel="Fechar inventário" onClose={() => openMenu(null)}/>
                <p className="ca-menu-note">Leve consigo os testemunhos encontrados neste capítulo.</p>
                <div className="ca-inventory-slots">
                  {episode.stations.map((station, i) => <div key={station.name} className={"ca-inventory-slot" + (game.visited.includes(i) ? " ca-collected" : "")}>
                    <span aria-hidden="true">{game.visited.includes(i) ? "✦" : "·"}</span>
                    <strong>{game.visited.includes(i) ? station.name : `Testemunho ${i + 1}`}</strong>
                    <small>{game.visited.includes(i) ? "Guardado no códice" : "Ainda por descobrir"}</small>
                  </div>)}
                </div>
                <button className="ca-button ca-primary" onClick={() => openMenu("codex")}><ScrollText size={17}/> Consultar testemunhos</button>
                {refButtons}
              </GameMenu>
            )}
            {mapOpen && (
              <GameMenu className="ca-local-map" label="Mapa da aventura" onClose={() => openMenu(null)}>
                <MenuTitle title="Mapa da aventura" subtitle={episode.title} closeLabel="Fechar mapa da aventura" onClose={() => openMenu(null)}/>
                <div className="ca-map-terrain" role="img" aria-label={`Sua posição e os três testemunhos de ${episode.title}`}>
                  <span className="ca-map-river" aria-hidden="true"/>
                  {STATIONS.map((station, i) => <span key={i} className={"ca-map-marker" + (game.visited.includes(i) ? " ca-found" : "")} style={{left: `${station.x / WORLD_WIDTH * 100}%`, top: `${station.y / WORLD_HEIGHT * 100}%`}} title={episode.stations[i].name}>{game.visited.includes(i) ? "✓" : i + 1}</span>)}
                  <span className="ca-map-player" style={{left: `${game.x / WORLD_WIDTH * 100}%`, top: `${game.y / WORLD_HEIGHT * 100}%`}} title="Você está aqui">◆</span>
                  <span className="ca-map-compass" aria-hidden="true">N<br/>↑</span>
                </div>
                <p className="ca-map-legend">◆ Você &nbsp; 1–3 Testemunhos &nbsp; ✓ Investigado</p>
                <ol className="ca-map-places">{episode.stations.map((station, i) => <li key={station.name}><span>{game.visited.includes(i) ? "✓" : i + 1}</span>{station.name}</li>)}</ol>
                <button className="ca-button ca-primary" onClick={select}><Map size={17}/> Mapa de aventuras</button>
                <button className="ca-button ca-map-resume" onClick={() => openMenu(null)}>Voltar ao cenário</button>
              </GameMenu>
            )}
            {intro && !restart && !menu && (
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
            {!intro && !restart && !menu && game.dialogue !== null && (
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
            {!intro && !restart && game.phase === "trial" && !menu && (
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
                  <button className="ca-button" onClick={() => openMenu("codex")}>
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
            {!intro && !restart && game.phase === "complete" && !menu && (
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
                  <button className="ca-button" onClick={() => openMenu("codex")}>
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
                    onClick={() => { setRestart(false); openMenu("journal"); }}
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
          <GameFront
            progress={progress}
            slots={visibleSlots}
            activeSlot={slot}
            slotBusy={slotBusy}
            onChooseSlot={chooseSlot}
            sound={music}
            onSound={() => void toggleAudio()}
            onReference={openRef}
            onMemorize={(e) => void memorize(e)}
            saga={saga}
            initialScreen={landing}
            onSaga={(index) => {
              setSaga(index);
              const next = { ...latest.current, selectedSaga: index };
              latest.current = next;
              setProgress(next);
            }}
            onBegin={(id) => begin(id)}
            onPilot={openPilot}
            onBack={() => { void flush(); onBack(); }}
            onExport={() => void exportSave()}
          />
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
  }, [episode.id]);
  useEffect(() => {
    if (!externalSheetOpen()) panel.current?.focus({ preventScroll: true });
  }, [sceneHost, episode.id, label]);
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
          <div><span className="ca-dialog-speaker">{episode.hero}</span><h4>{title}</h4></div>
          <span className="ca-dialog-arrow" aria-hidden="true">▾</span>
        </div>
        {children}
      </div>
    </div>
  );
  return sceneHost ? createPortal(dialog, sceneHost) : dialog;
}


function MenuTitle({ title, subtitle, closeLabel, onClose }: { title: string; subtitle: string; closeLabel: string; onClose: () => void }) {
  return <div className="ca-menu-heading"><div><span className="ca-eyebrow">{subtitle}</span><h3>{title}</h3></div><button className="ca-button" aria-label={closeLabel} onClick={onClose}><X size={18}/> Fechar</button></div>;
}

function GameMenu({ label, className, onClose, children }: { label: string; className: string; onClose: () => void; children: React.ReactNode }) {
  const panel = useRef<HTMLDivElement>(null);
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => { setHost(document.querySelector<HTMLElement>(".ca-stage")); }, []);
  useEffect(() => {
    if (!externalSheetOpen()) panel.current?.focus({ preventScroll: true });
  }, [host, label]);
  const content = <div className="ca-menu-backdrop" onPointerDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className={className + " ca-game-menu"} ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-label={label} onKeyDown={event => {
      if (event.key !== "Tab") return;
      const targets = Array.from(panel.current?.querySelectorAll<HTMLElement>("button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), [tabindex='0']") ?? []);
      const first = targets[0], last = targets[targets.length - 1];
      if (!first) { event.preventDefault(); return; }
      if (document.activeElement === panel.current || event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        (event.shiftKey ? last : first)?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first.focus();
      }
    }}>{children}</div>
  </div>;
  return host ? createPortal(content, host) : content;
}
