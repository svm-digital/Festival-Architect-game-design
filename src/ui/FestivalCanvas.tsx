import { useEffect, useRef } from 'react';
import type { Point } from '../model/types';
import { renderScene, type RenderInput } from '../render/renderer';

export type FrameInput = Omit<RenderInput, 'timeMs'>;

interface Props {
  gridWidth: number;
  gridHeight: number;
  tileSize: number;
  /** Wordt elk frame gelezen; zo hoeft de render-loop niet opnieuw te starten. */
  frameRef: React.RefObject<FrameInput | null>;
  onHover: (tile: Point | null) => void;
  onPointerDown: (tile: Point, button: number) => void;
  onPointerDrag: (tile: Point) => void;
  onPointerUp: () => void;
  interactive: boolean;
}

export function FestivalCanvas({
  gridWidth,
  gridHeight,
  tileSize,
  frameRef,
  onHover,
  onPointerDown,
  onPointerDrag,
  onPointerUp,
  interactive,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const width = gridWidth * tileSize;
  const height = gridHeight * tileSize;
  const lastTile = useRef<string>('');
  const dragging = useRef(false);

  // Render-loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let raf = 0;
    const loop = (now: number) => {
      const input = frameRef.current;
      if (input) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        renderScene(ctx, { ...input, timeMs: now });
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [width, height, frameRef]);

  const toTile = (e: React.PointerEvent): Point | null => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * gridWidth);
    const y = Math.floor(((e.clientY - rect.top) / rect.height) * gridHeight);
    if (x < 0 || y < 0 || x >= gridWidth || y >= gridHeight) return null;
    return { x, y };
  };

  return (
    <canvas
      ref={canvasRef}
      className={`block h-auto w-full touch-none select-none rounded-xl shadow-2xl ring-1 ring-black/30 ${interactive ? 'cursor-crosshair' : 'cursor-default'}`}
      style={{ aspectRatio: `${width} / ${height}` }}
      onContextMenu={(e) => e.preventDefault()}
      onPointerMove={(e) => {
        const t = toTile(e);
        const key = t ? `${t.x},${t.y}` : '';
        if (key === lastTile.current) return;
        lastTile.current = key;
        onHover(t);
        if (dragging.current && t) onPointerDrag(t);
      }}
      onPointerLeave={() => {
        lastTile.current = '';
        onHover(null);
        if (dragging.current) {
          dragging.current = false;
          onPointerUp();
        }
      }}
      onPointerDown={(e) => {
        const t = toTile(e);
        if (!t) return;
        (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
        dragging.current = true;
        onPointerDown(t, e.button);
      }}
      onPointerUp={() => {
        dragging.current = false;
        onPointerUp();
      }}
    />
  );
}
