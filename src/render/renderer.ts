// Canvas 2D-renderer. Leest layout en simulatiestaat en tekent die; muteert nooit iets.
// `timeMs` wordt alleen gebruikt voor cosmetische animatie (water, lichtjes).

import { GENRE_COLORS, getAct } from '../model/catalog';
import {
  accessTile,
  audienceZone,
  footprintSize,
  footprintTiles,
  tileIndex,
  type FacilityShape,
} from '../model/grid';
import type { ReachabilityAnalysis } from '../model/reachability';
import type { Facility, Facing, FestivalLayout, Point, PostType } from '../model/types';
import { activePerformance, tickToMinute } from '../sim/clock';
import type { IncidentKind, SimulationState, Visitor } from '../sim/types';

export interface RenderOverlays {
  reachability: boolean;
  heatmap: boolean;
  zones: boolean;
}

export interface RenderInput {
  layout: FestivalLayout;
  tileSize: number;
  timeMs: number;
  hover: Point | null;
  facilityPreview: { shape: FacilityShape; ok: boolean } | null;
  pathPreview: { x: number; y: number; ok: boolean; erase: boolean } | null;
  selectedId: string | null;
  overlays: RenderOverlays;
  analysis: ReachabilityAnalysis | null;
  sim: SimulationState | null;
  alpha: number;
  heat: ArrayLike<number> | null;
  showAccess: boolean;
  /** Middentegel van een 3×3-vak dat uitgelicht wordt (piekmoment in rapport). */
  highlightTile: number | null;
  /** Dekkingslaag: aanlooptijd in minuten vanaf de dichtstbijzijnde hulppost van één type. */
  coverage: { kind: PostType; minutes: Float32Array } | null;
}

const C = {
  grass: ['#6ea65a', '#73ab5e', '#699f55', '#78ae62'],
  grassBlade: 'rgba(40, 90, 40, 0.35)',
  path: '#dcc597',
  pathEdge: '#b39565',
  pathPebble: 'rgba(120, 95, 60, 0.35)',
  water: '#4b97c4',
  waterDeep: '#3d82ad',
  waterShine: 'rgba(255,255,255,0.35)',
  treeShadow: 'rgba(20, 40, 20, 0.35)',
  treeDark: '#2f6b3a',
  treeLight: '#4b9150',
  trunk: '#6b4a2b',
  rock: '#8f9098',
  rockLight: '#b4b5bc',
  outline: 'rgba(20, 24, 32, 0.55)',
  select: '#facc15',
  ok: 'rgba(74, 222, 128, 0.45)',
  bad: 'rgba(248, 113, 113, 0.5)',
};

const FACING_VEC: Record<Facing, Point> = {
  south: { x: 0, y: 1 },
  north: { x: 0, y: -1 },
  west: { x: -1, y: 0 },
  east: { x: 1, y: 0 },
};

function hash2(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function renderScene(ctx: CanvasRenderingContext2D, input: RenderInput): void {
  const { layout, tileSize: ts } = input;
  const { grid } = layout;
  ctx.save();
  ctx.clearRect(0, 0, grid.width * ts, grid.height * ts);

  drawGround(ctx, input);
  if (input.coverage) drawCoverage(ctx, input);
  if (input.overlays.zones || input.selectedId || input.facilityPreview?.shape.type === 'stage') drawZones(ctx, input);
  for (const f of layout.facilities) drawFacility(ctx, input, f);
  if (input.showAccess) for (const f of layout.facilities) drawAccess(ctx, ts, accessTile(f), f.facing, 'rgba(255,255,255,0.75)');
  if (input.overlays.reachability && input.analysis) drawReachability(ctx, input);
  if (input.overlays.heatmap && input.heat) drawHeat(ctx, input);
  if (input.sim) drawVisitors(ctx, input, input.sim);
  if (input.sim) drawStaff(ctx, input, input.sim);
  drawSelection(ctx, input);
  drawPreview(ctx, input);
  ctx.restore();
}

// ── Ondergrond ───────────────────────────────────────────────────────────────

function drawGround(ctx: CanvasRenderingContext2D, input: RenderInput): void {
  const { layout, tileSize: ts, timeMs } = input;
  const { grid } = layout;
  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      const r = hash2(x, y);
      ctx.fillStyle = C.grass[Math.floor(r * C.grass.length)];
      ctx.fillRect(x * ts, y * ts, ts, ts);
      if (r > 0.55) {
        ctx.fillStyle = C.grassBlade;
        const bx = x * ts + hash2(x + 7, y) * ts * 0.8;
        const by = y * ts + hash2(x, y + 7) * ts * 0.8;
        ctx.fillRect(bx, by, 1.5, 3);
        ctx.fillRect(bx + 3, by + 1, 1.5, 2.5);
      }
    }
  }
  // Paden
  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      if (grid.tiles[tileIndex(grid, x, y)] !== 'path') continue;
      ctx.fillStyle = C.path;
      ctx.fillRect(x * ts, y * ts, ts, ts);
      ctx.fillStyle = C.pathPebble;
      for (let k = 0; k < 3; k++) {
        ctx.fillRect(x * ts + hash2(x * 3 + k, y) * (ts - 3), y * ts + hash2(x, y * 3 + k) * (ts - 3), 2, 2);
      }
    }
  }
  ctx.strokeStyle = C.pathEdge;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  const isPath = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < grid.width && y < grid.height && grid.tiles[tileIndex(grid, x, y)] === 'path';
  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      if (!isPath(x, y)) continue;
      const px = x * ts;
      const py = y * ts;
      if (!isPath(x, y - 1)) { ctx.moveTo(px, py + 0.75); ctx.lineTo(px + ts, py + 0.75); }
      if (!isPath(x, y + 1)) { ctx.moveTo(px, py + ts - 0.75); ctx.lineTo(px + ts, py + ts - 0.75); }
      if (!isPath(x - 1, y)) { ctx.moveTo(px + 0.75, py); ctx.lineTo(px + 0.75, py + ts); }
      if (!isPath(x + 1, y)) { ctx.moveTo(px + ts - 0.75, py); ctx.lineTo(px + ts - 0.75, py + ts); }
    }
  }
  ctx.stroke();

  // Obstakels
  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      const kind = grid.obstacleKinds[tileIndex(grid, x, y)];
      if (kind === 'water') {
        ctx.fillStyle = (x + y) % 2 ? C.water : C.waterDeep;
        ctx.fillRect(x * ts, y * ts, ts, ts);
        ctx.strokeStyle = C.waterShine;
        ctx.lineWidth = 1;
        const phase = (timeMs / 900 + hash2(x, y) * 6) % 6;
        if (phase < 3) {
          const wy = y * ts + ts * (0.3 + 0.15 * phase);
          ctx.beginPath();
          ctx.moveTo(x * ts + ts * 0.2, wy);
          ctx.quadraticCurveTo(x * ts + ts * 0.5, wy - 2, x * ts + ts * 0.8, wy);
          ctx.stroke();
        }
      }
    }
  }
  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      const kind = grid.obstacleKinds[tileIndex(grid, x, y)];
      const cx = x * ts + ts / 2;
      const cy = y * ts + ts / 2;
      if (kind === 'tree') {
        const r = ts * (0.38 + hash2(x, y) * 0.08);
        ctx.fillStyle = C.treeShadow;
        ellipse(ctx, cx + ts * 0.12, cy + ts * 0.18, r, r * 0.7);
        ctx.fillStyle = C.trunk;
        ctx.fillRect(cx - 1.5, cy, 3, ts * 0.3);
        ctx.fillStyle = C.treeDark;
        circle(ctx, cx, cy - ts * 0.05, r);
        ctx.fillStyle = C.treeLight;
        circle(ctx, cx - r * 0.3, cy - r * 0.35, r * 0.5);
      } else if (kind === 'rock') {
        ctx.fillStyle = C.treeShadow;
        ellipse(ctx, cx + 2, cy + 4, ts * 0.33, ts * 0.2);
        ctx.fillStyle = C.rock;
        ctx.beginPath();
        ctx.moveTo(cx - ts * 0.32, cy + ts * 0.2);
        ctx.lineTo(cx - ts * 0.2, cy - ts * 0.2);
        ctx.lineTo(cx + ts * 0.12, cy - ts * 0.28);
        ctx.lineTo(cx + ts * 0.33, cy + ts * 0.05);
        ctx.lineTo(cx + ts * 0.22, cy + ts * 0.25);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = C.rockLight;
        ctx.fillRect(cx - ts * 0.12, cy - ts * 0.16, ts * 0.16, ts * 0.08);
      }
    }
  }
}

function circle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function ellipse(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number): void {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

// ── Voorzieningen ────────────────────────────────────────────────────────────

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

function facilityBox(ts: number, f: FacilityShape): Box {
  const { w, h } = footprintSize(f.type, f.facing);
  return { x: f.x * ts, y: f.y * ts, w: w * ts, h: h * ts };
}

/** Strook van de box aan de voorkant (toegangskant), met diepte d in pixels. */
function frontStrip(b: Box, facing: Facing, d: number): Box {
  switch (facing) {
    case 'south':
      return { x: b.x, y: b.y + b.h - d, w: b.w, h: d };
    case 'north':
      return { x: b.x, y: b.y, w: b.w, h: d };
    case 'west':
      return { x: b.x, y: b.y, w: d, h: b.h };
    case 'east':
      return { x: b.x + b.w - d, y: b.y, w: d, h: b.h };
  }
}

function backStrip(b: Box, facing: Facing, d: number): Box {
  const opposite: Record<Facing, Facing> = { south: 'north', north: 'south', west: 'east', east: 'west' };
  return frontStrip(b, opposite[facing], d);
}

function shadow(ctx: CanvasRenderingContext2D, b: Box): void {
  ctx.fillStyle = 'rgba(15, 30, 15, 0.28)';
  roundRect(ctx, b.x + 3, b.y + 4, b.w - 2, b.h - 2, 4);
  ctx.fill();
}

function drawFacility(ctx: CanvasRenderingContext2D, input: RenderInput, f: Facility): void {
  const ts = input.tileSize;
  const b = facilityBox(ts, f);
  const inset: Box = { x: b.x + 2, y: b.y + 2, w: b.w - 4, h: b.h - 4 };
  shadow(ctx, inset);
  switch (f.type) {
    case 'entrance':
      drawEntrance(ctx, inset, f.facing, ts);
      break;
    case 'stage':
      drawStage(ctx, input, inset, f);
      break;
    case 'food':
      drawFood(ctx, inset, f.facing, ts);
      break;
    case 'toilet':
      drawToilet(ctx, inset, f.facing, ts);
      break;
    case 'seating':
      drawSeating(ctx, inset, f.facing, ts);
      break;
    case 'bar':
      drawBar(ctx, inset, f.facing, ts);
      break;
    case 'merch':
      drawMerch(ctx, inset, f.facing, ts);
      break;
    case 'firstaid':
    case 'security':
    case 'awareness':
      drawPost(ctx, inset, f.type, ts);
      break;
  }
}

function drawEntrance(ctx: CanvasRenderingContext2D, b: Box, facing: Facing, ts: number): void {
  const horizontal = facing === 'south' || facing === 'north';
  ctx.fillStyle = '#8b5e34';
  roundRect(ctx, b.x, b.y, b.w, b.h, 3);
  ctx.fill();
  // Banner met strepen
  const stripes = 6;
  for (let i = 0; i < stripes; i++) {
    ctx.fillStyle = i % 2 ? '#fde68a' : '#f97316';
    if (horizontal) ctx.fillRect(b.x + 4 + ((b.w - 8) / stripes) * i, b.y + b.h * 0.3, (b.w - 8) / stripes, b.h * 0.4);
    else ctx.fillRect(b.x + b.w * 0.3, b.y + 4 + ((b.h - 8) / stripes) * i, b.w * 0.4, (b.h - 8) / stripes);
  }
  // Palen
  ctx.fillStyle = '#5b3a1e';
  const post = ts * 0.22;
  if (horizontal) {
    ctx.fillRect(b.x, b.y, post, b.h);
    ctx.fillRect(b.x + b.w - post, b.y, post, b.h);
  } else {
    ctx.fillRect(b.x, b.y, b.w, post);
    ctx.fillRect(b.x, b.y + b.h - post, b.w, post);
  }
  // Poort in het midden
  ctx.fillStyle = 'rgba(30, 20, 10, 0.55)';
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  ctx.fillRect(cx - ts * 0.35, cy - ts * 0.35, ts * 0.7, ts * 0.7);
}

function drawStage(ctx: CanvasRenderingContext2D, input: RenderInput, b: Box, f: Facility): void {
  const ts = input.tileSize;
  ctx.fillStyle = '#262a3b';
  roundRect(ctx, b.x, b.y, b.w, b.h, 4);
  ctx.fill();
  // Achterwand / truss
  const back = backStrip(b, f.facing, ts * 0.55);
  ctx.fillStyle = '#4b5068';
  ctx.fillRect(back.x, back.y, back.w, back.h);
  ctx.strokeStyle = '#8a90a8';
  ctx.lineWidth = 1;
  const horizontal = f.facing === 'south' || f.facing === 'north';
  ctx.beginPath();
  const n = 8;
  for (let i = 0; i <= n; i++) {
    if (horizontal) {
      const x = back.x + (back.w / n) * i;
      ctx.moveTo(x, back.y);
      ctx.lineTo(x + back.w / n / 2, back.y + back.h);
    } else {
      const y = back.y + (back.h / n) * i;
      ctx.moveTo(back.x, y);
      ctx.lineTo(back.x + back.w, y + back.h / n / 2);
    }
  }
  ctx.stroke();
  // Speelvloer
  const front = frontStrip(b, f.facing, ts * 0.35);
  ctx.fillStyle = '#3a3f57';
  ctx.fillRect(front.x, front.y, front.w, front.h);
  // Speakers op de voorhoeken
  ctx.fillStyle = '#0f111a';
  const s = ts * 0.55;
  if (horizontal) {
    const sy = f.facing === 'south' ? b.y + b.h - s - 2 : b.y + 2;
    ctx.fillRect(b.x + 3, sy, s, s);
    ctx.fillRect(b.x + b.w - s - 3, sy, s, s);
  } else {
    const sx = f.facing === 'east' ? b.x + b.w - s - 2 : b.x + 2;
    ctx.fillRect(sx, b.y + 3, s, s);
    ctx.fillRect(sx, b.y + b.h - s - 3, s, s);
  }
  // Lichtjes: kleur van het genre van de act die nu speelt
  let lightColor = 'rgba(255,255,255,0.25)';
  if (input.sim) {
    const minute = tickToMinute(input.sim.tick);
    const perf = activePerformance(input.sim.input.program, input.sim.input.scenario, f.id, minute);
    const act = perf ? getAct(perf.actId) : undefined;
    if (act) lightColor = GENRE_COLORS[act.genre];
  }
  const lights = 5;
  for (let i = 0; i < lights; i++) {
    const on = input.sim ? Math.floor(input.timeMs / 220 + i) % 2 === 0 : true;
    ctx.fillStyle = on ? lightColor : 'rgba(255,255,255,0.12)';
    const t = (i + 0.5) / lights;
    if (horizontal) circle(ctx, back.x + back.w * t, back.y + back.h / 2, ts * 0.12);
    else circle(ctx, back.x + back.w / 2, back.y + back.h * t, ts * 0.12);
  }
  // Letter
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = `bold ${Math.round(ts * 0.7)}px ui-sans-serif, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(f.name.replace('Podium ', ''), b.x + b.w / 2, b.y + b.h / 2);
}

function drawFood(ctx: CanvasRenderingContext2D, b: Box, facing: Facing, ts: number): void {
  ctx.fillStyle = '#f5ede0';
  roundRect(ctx, b.x, b.y, b.w, b.h, 3);
  ctx.fill();
  // Gestreepte luifel aan de voorkant
  const awning = frontStrip(b, facing, ts * 0.6);
  const horizontal = facing === 'south' || facing === 'north';
  const stripes = 6;
  for (let i = 0; i < stripes; i++) {
    ctx.fillStyle = i % 2 ? '#fff7ed' : '#dc2626';
    if (horizontal) ctx.fillRect(awning.x + (awning.w / stripes) * i, awning.y, awning.w / stripes, awning.h);
    else ctx.fillRect(awning.x, awning.y + (awning.h / stripes) * i, awning.w, awning.h / stripes);
  }
  // Pan/grill
  ctx.fillStyle = '#44403c';
  const back = backStrip(b, facing, ts * 0.9);
  circle(ctx, back.x + back.w / 2, back.y + back.h / 2, ts * 0.25);
  ctx.fillStyle = '#f59e0b';
  circle(ctx, back.x + back.w / 2, back.y + back.h / 2, ts * 0.12);
}

function drawToilet(ctx: CanvasRenderingContext2D, b: Box, facing: Facing, ts: number): void {
  ctx.fillStyle = '#93c5fd';
  roundRect(ctx, b.x, b.y, b.w, b.h, 3);
  ctx.fill();
  const horizontal = facing === 'south' || facing === 'north';
  const cabins = 3;
  ctx.strokeStyle = '#1e3a8a';
  ctx.lineWidth = 1.5;
  for (let i = 1; i < cabins; i++) {
    ctx.beginPath();
    if (horizontal) {
      ctx.moveTo(b.x + (b.w / cabins) * i, b.y);
      ctx.lineTo(b.x + (b.w / cabins) * i, b.y + b.h);
    } else {
      ctx.moveTo(b.x, b.y + (b.h / cabins) * i);
      ctx.lineTo(b.x + b.w, b.y + (b.h / cabins) * i);
    }
    ctx.stroke();
  }
  // Deuren aan de voorkant
  const door = frontStrip(b, facing, ts * 0.35);
  ctx.fillStyle = '#1d4ed8';
  for (let i = 0; i < cabins; i++) {
    if (horizontal) ctx.fillRect(door.x + (door.w / cabins) * i + ts * 0.2, door.y, door.w / cabins - ts * 0.4, door.h);
    else ctx.fillRect(door.x, door.y + (door.h / cabins) * i + ts * 0.2, door.w, door.h / cabins - ts * 0.4);
  }
  ctx.fillStyle = '#eff6ff';
  ctx.font = `bold ${Math.round(ts * 0.45)}px ui-sans-serif, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('WC', b.x + b.w / 2, b.y + b.h / 2);
}

function drawSeating(ctx: CanvasRenderingContext2D, b: Box, facing: Facing, ts: number): void {
  ctx.fillStyle = '#c8a36b';
  roundRect(ctx, b.x, b.y, b.w, b.h, 3);
  ctx.fill();
  ctx.strokeStyle = 'rgba(90, 60, 30, 0.35)';
  ctx.lineWidth = 1;
  const horizontal = facing === 'south' || facing === 'north';
  ctx.beginPath();
  for (let i = 1; i < 6; i++) {
    if (horizontal) {
      ctx.moveTo(b.x, b.y + (b.h / 6) * i);
      ctx.lineTo(b.x + b.w, b.y + (b.h / 6) * i);
    } else {
      ctx.moveTo(b.x + (b.w / 6) * i, b.y);
      ctx.lineTo(b.x + (b.w / 6) * i, b.y + b.h);
    }
  }
  ctx.stroke();
  // Picknicktafels
  for (const p of seatTables(b, facing)) {
    ctx.fillStyle = '#7c4a21';
    if (horizontal) {
      ctx.fillRect(p.x - ts * 0.35, p.y - ts * 0.18, ts * 0.7, ts * 0.36);
      ctx.fillStyle = '#5b3416';
      ctx.fillRect(p.x - ts * 0.35, p.y - ts * 0.42, ts * 0.7, ts * 0.1);
      ctx.fillRect(p.x - ts * 0.35, p.y + ts * 0.32, ts * 0.7, ts * 0.1);
    } else {
      ctx.fillRect(p.x - ts * 0.18, p.y - ts * 0.35, ts * 0.36, ts * 0.7);
      ctx.fillStyle = '#5b3416';
      ctx.fillRect(p.x - ts * 0.42, p.y - ts * 0.35, ts * 0.1, ts * 0.7);
      ctx.fillRect(p.x + ts * 0.32, p.y - ts * 0.35, ts * 0.1, ts * 0.7);
    }
  }
}

function drawBar(ctx: CanvasRenderingContext2D, b: Box, facing: Facing, ts: number): void {
  ctx.fillStyle = '#5b3a24';
  roundRect(ctx, b.x, b.y, b.w, b.h, 3);
  ctx.fill();
  // Bar-toog aan de voorkant
  const counter = frontStrip(b, facing, ts * 0.45);
  ctx.fillStyle = '#b7791f';
  ctx.fillRect(counter.x, counter.y, counter.w, counter.h);
  // Flessen achterin
  const back = backStrip(b, facing, ts * 0.5);
  const horizontal = facing === 'south' || facing === 'north';
  const colors = ['#65a30d', '#f59e0b', '#38bdf8', '#e11d48'];
  for (let i = 0; i < 7; i++) {
    ctx.fillStyle = colors[i % colors.length];
    const t = (i + 0.5) / 7;
    if (horizontal) ctx.fillRect(back.x + back.w * t - 1.5, back.y + back.h * 0.25, 3, back.h * 0.5);
    else ctx.fillRect(back.x + back.w * 0.25, back.y + back.h * t - 1.5, back.w * 0.5, 3);
  }
  label(ctx, 'BAR', b.x + b.w / 2, b.y + b.h / 2, ts * 0.42, '#fde68a');
}

function drawMerch(ctx: CanvasRenderingContext2D, b: Box, facing: Facing, ts: number): void {
  ctx.fillStyle = '#6d28d9';
  roundRect(ctx, b.x, b.y, b.w, b.h, 3);
  ctx.fill();
  const front = frontStrip(b, facing, ts * 0.35);
  ctx.fillStyle = '#c4b5fd';
  ctx.fillRect(front.x, front.y, front.w, front.h);
  // T-shirt
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2 - ts * 0.05;
  const u = ts * 0.22;
  ctx.fillStyle = '#facc15';
  ctx.beginPath();
  ctx.moveTo(cx - u * 0.6, cy - u);
  ctx.lineTo(cx - u * 1.4, cy - u * 0.4);
  ctx.lineTo(cx - u, cy);
  ctx.lineTo(cx - u * 0.7, cy - u * 0.2);
  ctx.lineTo(cx - u * 0.7, cy + u);
  ctx.lineTo(cx + u * 0.7, cy + u);
  ctx.lineTo(cx + u * 0.7, cy - u * 0.2);
  ctx.lineTo(cx + u, cy);
  ctx.lineTo(cx + u * 1.4, cy - u * 0.4);
  ctx.lineTo(cx + u * 0.6, cy - u);
  ctx.closePath();
  ctx.fill();
}

const POST_STYLE: Record<PostType, { bg: string; fg: string; text: string }> = {
  firstaid: { bg: '#15803d', fg: '#ffffff', text: '' },
  security: { bg: '#1e293b', fg: '#facc15', text: 'BEV' },
  awareness: { bg: '#a21caf', fg: '#fdf4ff', text: '' },
};

export const STAFF_COLORS: Record<PostType, string> = {
  firstaid: '#22c55e',
  security: '#facc15',
  awareness: '#e879f9',
};

const INCIDENT_COLORS: Record<IncidentKind, string> = {
  medical: '#22c55e',
  conflict: '#facc15',
  wellbeing: '#e879f9',
};

function drawPost(ctx: CanvasRenderingContext2D, b: Box, type: PostType, ts: number): void {
  const st = POST_STYLE[type];
  ctx.fillStyle = st.bg;
  roundRect(ctx, b.x, b.y, b.w, b.h, 4);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1;
  ctx.stroke();
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  ctx.fillStyle = st.fg;
  if (type === 'firstaid') {
    // Wit kruis op groen (EHBO-symbool, niet het beschermde rode kruis)
    const arm = Math.min(b.w, b.h) * 0.32;
    const thick = arm * 0.55;
    ctx.fillRect(cx - thick / 2, cy - arm, thick, arm * 2);
    ctx.fillRect(cx - arm, cy - thick / 2, arm * 2, thick);
  } else if (type === 'awareness') {
    // Hartje
    const r = Math.min(b.w, b.h) * 0.18;
    ctx.beginPath();
    ctx.arc(cx - r * 0.9, cy - r * 0.3, r, Math.PI, 0);
    ctx.arc(cx + r * 0.9, cy - r * 0.3, r, Math.PI, 0);
    ctx.lineTo(cx, cy + r * 1.6);
    ctx.closePath();
    ctx.fill();
  } else {
    label(ctx, st.text, cx, cy, ts * 0.38, st.fg);
  }
}

function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, color: string): void {
  ctx.fillStyle = color;
  ctx.font = `bold ${Math.round(size)}px ui-sans-serif, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
}

function drawCoverage(ctx: CanvasRenderingContext2D, input: RenderInput): void {
  const { minutes } = input.coverage!;
  const ts = input.tileSize;
  const W = input.layout.grid.width;
  for (let i = 0; i < minutes.length; i++) {
    const m = minutes[i];
    if (!Number.isFinite(m)) continue;
    ctx.fillStyle = m <= 3 ? 'rgba(34,197,94,0.28)' : m <= 6 ? 'rgba(250,204,21,0.26)' : 'rgba(239,68,68,0.24)';
    const x = i % W;
    ctx.fillRect(x * ts, ((i - x) / W) * ts, ts, ts);
  }
}

function drawStaff(ctx: CanvasRenderingContext2D, input: RenderInput, sim: SimulationState): void {
  const ts = input.tileSize;
  // Open incidenten: pulserende ring rond de bezoeker
  const pulse = 0.5 + 0.5 * Math.sin(input.timeMs / 160);
  for (const inc of sim.incidents) {
    if (inc.outcome !== 'open') continue;
    const v = sim.visitors[inc.visitorId];
    ctx.strokeStyle = INCIDENT_COLORS[inc.kind];
    ctx.globalAlpha = 0.5 + 0.5 * pulse;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(v.x * ts, v.y * ts, ts * (0.35 + 0.15 * pulse), 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  const size = Math.max(4, ts * 0.26);
  sim.staff.forEach((st, i) => {
    let x = (st.prevX + (st.x - st.prevX) * input.alpha) * ts;
    let y = (st.prevY + (st.y - st.prevY) * input.alpha) * ts;
    if (st.state === 'idle') {
      // Wachtende medewerkers naast elkaar bij hun post
      x += ((i % 2) - 0.5) * size * 1.3;
      y += size * 0.2;
    }
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(x - size / 2 + 1, y - size / 2 + 2, size, size);
    ctx.fillStyle = STAFF_COLORS[st.kind];
    ctx.fillRect(x - size / 2, y - size / 2, size, size);
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1;
    ctx.strokeRect(x - size / 2, y - size / 2, size, size);
  });
}

function seatTables(b: Box, facing: Facing): Point[] {
  const horizontal = facing === 'south' || facing === 'north';
  const out: Point[] = [];
  for (let i = 0; i < 3; i++) {
    const t = (i + 0.5) / 3;
    out.push(horizontal ? { x: b.x + b.w * t, y: b.y + b.h / 2 } : { x: b.x + b.w / 2, y: b.y + b.h * t });
  }
  return out;
}

/** Zitplekken (pixelposities) per zitgebied; 6 plekken, twee per tafel. */
function seatPositions(ts: number, f: Facility): Point[] {
  const b = facilityBox(ts, f);
  const horizontal = f.facing === 'south' || f.facing === 'north';
  const out: Point[] = [];
  for (const p of seatTables(b, f.facing)) {
    if (horizontal) {
      out.push({ x: p.x, y: p.y - ts * 0.37 }, { x: p.x, y: p.y + ts * 0.37 });
    } else {
      out.push({ x: p.x - ts * 0.37, y: p.y }, { x: p.x + ts * 0.37, y: p.y });
    }
  }
  return out;
}

function drawAccess(ctx: CanvasRenderingContext2D, ts: number, a: Point, facing: Facing, color: string): void {
  const cx = a.x * ts + ts / 2;
  const cy = a.y * ts + ts / 2;
  const v = FACING_VEC[facing];
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([3, 2]);
  roundRect(ctx, a.x * ts + 3, a.y * ts + 3, ts - 6, ts - 6, 3);
  ctx.stroke();
  ctx.setLineDash([]);
  // Pijl naar de voorziening (tegen de facing in)
  ctx.fillStyle = color;
  ctx.beginPath();
  const tipX = cx - v.x * ts * 0.25;
  const tipY = cy - v.y * ts * 0.25;
  const px = -v.y;
  const py = v.x;
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(cx + v.x * ts * 0.1 + px * ts * 0.15, cy + v.y * ts * 0.1 + py * ts * 0.15);
  ctx.lineTo(cx + v.x * ts * 0.1 - px * ts * 0.15, cy + v.y * ts * 0.1 - py * ts * 0.15);
  ctx.closePath();
  ctx.fill();
}

// ── Lagen ────────────────────────────────────────────────────────────────────

function drawZones(ctx: CanvasRenderingContext2D, input: RenderInput): void {
  const { layout, tileSize: ts } = input;
  const stages: FacilityShape[] = layout.facilities.filter(
    (f) => f.type === 'stage' && (input.overlays.zones || f.id === input.selectedId),
  );
  if (input.facilityPreview?.shape.type === 'stage') stages.push(input.facilityPreview.shape);
  for (const st of stages) {
    ctx.fillStyle = 'rgba(253, 224, 71, 0.13)';
    for (const p of audienceZone(st, layout.grid)) {
      if (layout.grid.tiles[tileIndex(layout.grid, p.x, p.y)] === 'obstacle') continue;
      ctx.fillRect(p.x * ts, p.y * ts, ts, ts);
    }
  }
}

function drawReachability(ctx: CanvasRenderingContext2D, input: RenderInput): void {
  const { layout, tileSize: ts, analysis } = input;
  if (!analysis) return;
  const { grid } = layout;
  const reach = analysis.reachable;
  const occupied = new Uint8Array(grid.width * grid.height);
  for (const f of layout.facilities) for (const p of footprintTiles(f)) occupied[tileIndex(grid, p.x, p.y)] = 1;
  // Zonder ingang is alles 'onbereikbaar'; dat meldt het paneel al, dus geen tegellaag.
  for (let i = 0; reach && i < grid.tiles.length; i++) {
    if (grid.tiles[i] === 'obstacle' || occupied[i]) continue;
    const x = i % grid.width;
    const y = (i - x) / grid.width;
    if (reach[i]) {
      ctx.fillStyle = 'rgba(56, 189, 248, 0.12)';
      ctx.fillRect(x * ts, y * ts, ts, ts);
    } else {
      ctx.fillStyle = 'rgba(239, 68, 68, 0.22)';
      ctx.fillRect(x * ts, y * ts, ts, ts);
      ctx.strokeStyle = 'rgba(185, 28, 28, 0.45)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x * ts, y * ts + ts);
      ctx.lineTo(x * ts + ts, y * ts);
      ctx.stroke();
    }
  }
  for (const f of layout.facilities) {
    const r = analysis.facilities[f.id];
    if (!r || r.reachable) continue;
    const b = facilityBox(ts, f);
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 3;
    roundRect(ctx, b.x + 1, b.y + 1, b.w - 2, b.h - 2, 4);
    ctx.stroke();
    drawAccess(ctx, ts, accessTile(f), f.facing, '#ef4444');
    ctx.fillStyle = '#ef4444';
    circle(ctx, b.x + b.w - 4, b.y + 4, ts * 0.32);
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${Math.round(ts * 0.45)}px ui-sans-serif, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('!', b.x + b.w - 4, b.y + 4.5);
  }
}

function drawHeat(ctx: CanvasRenderingContext2D, input: RenderInput): void {
  const heat = input.heat!;
  const ts = input.tileSize;
  const W = input.layout.grid.width;
  let max = 0;
  for (let i = 0; i < heat.length; i++) if (heat[i] > max) max = heat[i];
  if (max <= 0) return;
  for (let i = 0; i < heat.length; i++) {
    const v = heat[i] / max;
    if (v < 0.02) continue;
    const t = Math.sqrt(v);
    // geel → oranje → rood
    const r = 255;
    const g = Math.round(230 - 190 * t);
    const b = Math.round(80 - 60 * t);
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${0.15 + 0.55 * t})`;
    const x = i % W;
    const y = (i - x) / W;
    ctx.fillRect(x * ts, y * ts, ts, ts);
  }
}

// ── Bezoekers ────────────────────────────────────────────────────────────────

function jitter(id: number, salt: number): number {
  return hash2(id * 31 + salt, id * 17 + 3) - 0.5;
}

function drawVisitors(ctx: CanvasRenderingContext2D, input: RenderInput, sim: SimulationState): void {
  const ts = input.tileSize;
  const W = sim.walk.width;
  const facById = new Map(input.layout.facilities.map((f) => [f.id, f]));

  // Afgeleide weergaveposities voor rij, bediening en zitplaatsen (alleen visueel).
  const special = new Map<number, Point>();
  for (const id of sim.facilityOrder) {
    const fac = sim.facilities[id];
    const f = facById.get(id);
    if (!f) continue;
    const v = FACING_VEC[f.facing];
    const ax = (fac.accessTile % W) + 0.5;
    const ay = Math.floor(fac.accessTile / W) + 0.5;
    const px = -v.y;
    const py = v.x;
    fac.queue.forEach((vid, i) => {
      const row = i % 5;
      const col = Math.floor(i / 5);
      const along = 0.05 + row * 0.2;
      const side = (col % 2 ? -1 : 1) * Math.ceil(col / 2) * 0.28;
      special.set(vid, { x: (ax + v.x * along + px * side) * ts, y: (ay + v.y * along + py * side) * ts });
    });
    fac.serving.forEach((slot, i) => {
      const side = (i - (fac.serving.length - 1) / 2) * 0.32;
      special.set(slot.visitorId, { x: (ax - v.x * 0.55 + px * side) * ts, y: (ay - v.y * 0.55 + py * side) * ts });
    });
    if (fac.type === 'seating') {
      const seats = seatPositions(ts, f);
      fac.occupants.forEach((vid, i) => special.set(vid, seats[i % seats.length]));
    }
  }

  const r = Math.max(2.5, ts * 0.15);
  const bounce = (v: Visitor) =>
    v.state === 'Watching' ? Math.abs(Math.sin(input.timeMs / 180 + v.id)) * ts * 0.06 : 0;

  for (const v of sim.visitors) {
    if (v.phase !== 'onSite') continue;
    let x: number;
    let y: number;
    const sp = special.get(v.id);
    if (sp) {
      x = sp.x;
      y = sp.y;
    } else {
      const ix = v.prevX + (v.x - v.prevX) * input.alpha;
      const iy = v.prevY + (v.y - v.prevY) * input.alpha;
      const spread = v.state === 'Watching' || v.state === 'Resting' ? 0.6 : 0.3;
      x = (ix + jitter(v.id, 1) * spread) * ts;
      y = (iy + jitter(v.id, 2) * spread) * ts;
    }
    y -= bounce(v);
    ctx.globalAlpha = v.state === 'Leaving' ? 0.6 : 1;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ellipse(ctx, x + 1, y + r * 0.9, r * 0.9, r * 0.45);
    ctx.fillStyle = GENRE_COLORS[v.genre];
    circle(ctx, x, y, r);
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.8)';
    ctx.lineWidth = 1;
    ctx.stroke();
    if (v.unmetNeeds.length > 0) {
      ctx.fillStyle = '#ef4444';
      circle(ctx, x + r * 0.8, y - r * 0.9, r * 0.5);
    }
  }
  ctx.globalAlpha = 1;
}

// ── Selectie en preview ──────────────────────────────────────────────────────

function drawSelection(ctx: CanvasRenderingContext2D, input: RenderInput): void {
  const ts = input.tileSize;
  if (input.hover && !input.facilityPreview && !input.pathPreview) {
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(input.hover.x * ts + 1, input.hover.y * ts + 1, ts - 2, ts - 2);
  }
  if (input.highlightTile !== null) {
    const W = input.layout.grid.width;
    const hx = input.highlightTile % W;
    const hy = Math.floor(input.highlightTile / W);
    const pulse = 0.5 + 0.5 * Math.sin(input.timeMs / 200);
    ctx.strokeStyle = `rgba(250, 204, 21, ${0.5 + 0.5 * pulse})`;
    ctx.lineWidth = 3;
    roundRect(ctx, (hx - 1) * ts, (hy - 1) * ts, ts * 3, ts * 3, 6);
    ctx.stroke();
  }
  const f = input.layout.facilities.find((x) => x.id === input.selectedId);
  if (!f) return;
  const b = facilityBox(ts, f);
  ctx.strokeStyle = C.select;
  ctx.lineWidth = 2.5;
  ctx.setLineDash([6, 4]);
  roundRect(ctx, b.x - 2, b.y - 2, b.w + 4, b.h + 4, 6);
  ctx.stroke();
  ctx.setLineDash([]);
  drawAccess(ctx, ts, accessTile(f), f.facing, C.select);
}

function drawPreview(ctx: CanvasRenderingContext2D, input: RenderInput): void {
  const ts = input.tileSize;
  const { grid } = input.layout;
  if (input.facilityPreview) {
    const { shape, ok } = input.facilityPreview;
    ctx.fillStyle = ok ? C.ok : C.bad;
    for (const p of footprintTiles(shape)) ctx.fillRect(p.x * ts, p.y * ts, ts, ts);
    const b = facilityBox(ts, shape);
    ctx.strokeStyle = ok ? '#16a34a' : '#dc2626';
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);
    const a = accessTile(shape);
    if (a.x >= 0 && a.y >= 0 && a.x < grid.width && a.y < grid.height) {
      drawAccess(ctx, ts, a, shape.facing, ok ? '#f0fdf4' : '#fecaca');
    }
  }
  if (input.pathPreview) {
    const { x, y, ok, erase } = input.pathPreview;
    ctx.fillStyle = erase ? 'rgba(255,255,255,0.25)' : ok ? 'rgba(220, 197, 151, 0.7)' : C.bad;
    ctx.fillRect(x * ts, y * ts, ts, ts);
    ctx.strokeStyle = erase ? '#fff' : ok ? '#a16207' : '#dc2626';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x * ts + 1, y * ts + 1, ts - 2, ts - 2);
  }
}
