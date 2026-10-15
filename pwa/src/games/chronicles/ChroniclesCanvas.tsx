import { useEffect, useRef } from 'react';
import { ChroniclesRenderer, type ScenePlayer, type SceneWorld } from './renderer';

export type ChroniclesInput = { dx: number; dy: number; run: boolean };
export type ChroniclesCanvasProps = {
  world: SceneWorld;
  player: ScenePlayer;
  onMove: (input: ChroniclesInput, dt: number) => void;
  onInteract: () => void;
  paused: boolean;
  touchInput?: ChroniclesInput;
  className?: string;
};

const MOVEMENT_KEYS = new Set(['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd', 'shift']);

/** The focusable canvas owns keyboard input; menus and text fields retain ordinary browser input. */
export default function ChroniclesCanvas(props: ChroniclesCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const latest = useRef(props);
  latest.current = props;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;
    const renderer = new ChroniclesRenderer();
    const keys = new Set<string>();
    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
    let reducedMotion = motionPreference.matches;
    let dimensions = { width: 1, height: 1, dpr: 1 };
    let frame = 0;
    let lastTime = 0;
    let alive = true;

    function resize() {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      // Limit fill rate on phones while preserving readable, crisp pixel artwork.
      const dpr = Math.min(window.devicePixelRatio || 1, rect.width < 640 ? 1.5 : 2);
      dimensions = { width: Math.max(1, Math.round(rect.width)), height: Math.max(1, Math.round(rect.height)), dpr };
      canvas.width = Math.round(dimensions.width * dpr);
      canvas.height = Math.round(dimensions.height * dpr);
      if (ctx) ctx.imageSmoothingEnabled = false;
    }

    function clearKeys() {
      keys.clear();
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.target !== canvas || event.altKey || event.ctrlKey || event.metaKey) return;
      const key = event.key.toLowerCase();
      if (MOVEMENT_KEYS.has(key)) {
        event.preventDefault();
        keys.add(key);
      } else if ((key === 'e' || key === 'enter' || key === ' ') && !event.repeat) {
        event.preventDefault();
        if (!latest.current.paused) latest.current.onInteract();
      }
    }

    function onKeyUp(event: KeyboardEvent) {
      const key = event.key.toLowerCase();
      if (MOVEMENT_KEYS.has(key)) {
        if (event.target === canvas) event.preventDefault();
        keys.delete(key);
      }
    }

    function onPointerDown() {
      canvas?.focus({ preventScroll: true });
    }

    function onMotionChange(event: MediaQueryListEvent) {
      reducedMotion = event.matches;
    }

    function render(timestamp: number) {
      if (!alive || document.hidden || !ctx) return;
      const dt = lastTime ? Math.min((timestamp - lastTime) / 1000, 0.05) : 0;
      lastTime = timestamp;
      const current = latest.current;
      if (!current.paused) {
        const touch = current.touchInput;
        const keyboardX = Number(keys.has('arrowright') || keys.has('d')) - Number(keys.has('arrowleft') || keys.has('a'));
        const keyboardY = Number(keys.has('arrowdown') || keys.has('s')) - Number(keys.has('arrowup') || keys.has('w'));
        const dx = Math.max(-1, Math.min(1, keyboardX + (touch?.dx || 0)));
        const dy = Math.max(-1, Math.min(1, keyboardY + (touch?.dy || 0)));
        if (dx || dy) current.onMove({ dx, dy, run: keys.has('shift') || Boolean(touch?.run) }, dt);
      } else clearKeys();
      ctx.setTransform(dimensions.dpr, 0, 0, dimensions.dpr, 0, 0);
      renderer.draw(ctx, current.world, current.player, dimensions.width, dimensions.height, timestamp / 1000, dt, reducedMotion);
      frame = window.requestAnimationFrame(render);
    }

    function onVisibilityChange() {
      clearKeys();
      window.cancelAnimationFrame(frame);
      lastTime = 0;
      if (!document.hidden && alive) frame = window.requestAnimationFrame(render);
    }

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();
    canvas.addEventListener('keydown', onKeyDown);
    canvas.addEventListener('keyup', onKeyUp);
    canvas.addEventListener('blur', clearKeys);
    canvas.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('blur', clearKeys);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', onVisibilityChange);
    motionPreference.addEventListener('change', onMotionChange);
    frame = window.requestAnimationFrame(render);

    return () => {
      alive = false;
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      renderer.reset();
      canvas.removeEventListener('keydown', onKeyDown);
      canvas.removeEventListener('keyup', onKeyUp);
      canvas.removeEventListener('blur', clearKeys);
      canvas.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('blur', clearKeys);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      motionPreference.removeEventListener('change', onMotionChange);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={props.className}
      tabIndex={0}
      role="application"
      aria-roledescription="Mundo explorável de RPG em duas dimensões"
      aria-label={`Crônicas da Aliança — ${props.world.name}. Use as setas ou W A S D para caminhar, Shift para correr e E ou Enter para interagir. No celular, use os controles direcionais abaixo.`}
      style={{ display: 'block', width: '100%', height: '100%', imageRendering: 'pixelated', touchAction: 'pan-y', background: '#78856a' }}
    >
      Seu navegador precisa oferecer suporte a Canvas 2D para explorar Crônicas da Aliança.
    </canvas>
  );
}
