import { FACILITY_DEFS, lowerLabel } from './catalog';
import {
  accessTile,
  buildOccupancy,
  footprintSize,
  footprintTiles,
  inBounds,
  tileIndex,
  type FacilityShape,
} from './grid';
import { computeSpent } from './budget';
import type { Facing, FestivalLayout, ScenarioSettings, TileGrid } from './types';

export interface PlacementResult {
  ok: boolean;
  /** Leesbare redenen waarom plaatsing niet kan. Leeg als ok. */
  reasons: string[];
  cost: number;
}

/**
 * Bepaalt voor de ingang de juiste positie en richting op de dichtstbijzijnde terreingrens,
 * gecentreerd op de cursor. De toegang wijst altijd naar binnen.
 */
export function snapEntrance(grid: TileGrid, cx: number, cy: number): FacilityShape {
  const dTop = cy;
  const dBottom = grid.height - 1 - cy;
  const dLeft = cx;
  const dRight = grid.width - 1 - cx;
  const min = Math.min(dTop, dBottom, dLeft, dRight);
  let facing: Facing;
  if (min === dTop) facing = 'south';
  else if (min === dBottom) facing = 'north';
  else if (min === dLeft) facing = 'east';
  else facing = 'west';
  const { w, h } = footprintSize('entrance', facing);
  const clampX = (x: number) => Math.max(0, Math.min(grid.width - w, x));
  const clampY = (y: number) => Math.max(0, Math.min(grid.height - h, y));
  switch (facing) {
    case 'south':
      return { type: 'entrance', facing, x: clampX(cx - Math.floor(w / 2)), y: 0 };
    case 'north':
      return { type: 'entrance', facing, x: clampX(cx - Math.floor(w / 2)), y: grid.height - 1 };
    case 'east':
      return { type: 'entrance', facing, x: 0, y: clampY(cy - Math.floor(h / 2)) };
    case 'west':
      return { type: 'entrance', facing, x: grid.width - 1, y: clampY(cy - Math.floor(h / 2)) };
  }
}

function entranceOnBorder(grid: TileGrid, c: FacilityShape): boolean {
  const { w, h } = footprintSize(c.type, c.facing);
  switch (c.facing) {
    case 'south':
      return c.y === 0;
    case 'north':
      return c.y + h - 1 === grid.height - 1;
    case 'east':
      return c.x === 0;
    case 'west':
      return c.x + w - 1 === grid.width - 1;
  }
}

/** Centreert een voorziening van dit type op de cursortegel. */
export function centeredCandidate(type: FacilityShape['type'], facing: Facing, cx: number, cy: number): FacilityShape {
  const { w, h } = footprintSize(type, facing);
  return { type, facing, x: cx - Math.floor(w / 2), y: cy - Math.floor(h / 2) };
}

export function validatePlacement(
  layout: FestivalLayout,
  scenario: ScenarioSettings,
  candidate: FacilityShape,
  /** Beschikbaar voor huur van voorzieningen en paden (kapitaal min gages). */
  budget: number,
): PlacementResult {
  const def = FACILITY_DEFS[candidate.type];
  const grid = layout.grid;
  const reasons: string[] = [];
  const tiles = footprintTiles(candidate);
  const access = accessTile(candidate);
  const occ = buildOccupancy(grid, layout.facilities);

  // Aantalslimieten
  const sameType = layout.facilities.filter((f) => f.type === candidate.type).length;
  if (def.maxCount !== null && sameType >= def.maxCount) {
    reasons.push(
      def.maxCount === 1
        ? `Er is al een ${lowerLabel(candidate.type)}; er kan er maar één zijn.`
        : `Maximaal ${def.maxCount} × ${lowerLabel(candidate.type)} toegestaan.`,
    );
  }

  // Raster
  if (tiles.some((p) => !inBounds(grid, p.x, p.y))) {
    reasons.push('Valt (deels) buiten het terrein.');
  }
  if (candidate.type === 'entrance') {
    if (!entranceOnBorder(grid, candidate)) reasons.push('De ingang moet op de terreingrens staan, met de toegang naar binnen.');
  } else if (!inBounds(grid, access.x, access.y)) {
    reasons.push('De toegangstegel valt buiten het terrein. Draai de voorziening (R).');
  }

  // Footprint-inhoud
  const blockedAccessOf = new Set<string>();
  let onObstacle = false;
  let onPath = false;
  const overlaps = new Set<string>();
  for (const p of tiles) {
    if (!inBounds(grid, p.x, p.y)) continue;
    const i = tileIndex(grid, p.x, p.y);
    if (grid.tiles[i] === 'obstacle') onObstacle = true;
    if (grid.tiles[i] === 'path') onPath = true;
    if (occ[i] >= 0) overlaps.add(layout.facilities[occ[i]].name);
    for (const other of layout.facilities) {
      const a = accessTile(other);
      if (a.x === p.x && a.y === p.y) blockedAccessOf.add(other.name);
    }
  }
  if (onObstacle) reasons.push('Staat op een obstakel (boom, water of rots).');
  if (onPath) reasons.push('Staat op een pad. Wis eerst het pad of kies een andere plek.');
  if (overlaps.size > 0) reasons.push(`Overlapt met ${[...overlaps].join(', ')}.`);
  if (blockedAccessOf.size > 0) {
    const names = [...blockedAccessOf];
    const isEntrance = layout.facilities.some((f) => f.type === 'entrance' && names.includes(f.name));
    reasons.push(
      isEntrance
        ? 'Blokkeert de toegang van de ingang.'
        : `Blokkeert de toegangstegel van ${names.join(', ')}.`,
    );
  }

  // Eigen toegangstegel moet begaanbaar blijven
  if (inBounds(grid, access.x, access.y)) {
    const ai = tileIndex(grid, access.x, access.y);
    if (grid.tiles[ai] === 'obstacle') reasons.push('De toegangstegel ligt op een obstakel. Draai of verplaats (R).');
    else if (occ[ai] >= 0) reasons.push(`De toegangstegel ligt onder ${layout.facilities[occ[ai]].name}.`);
  }

  // Budget
  const remaining = budget - computeSpent(layout, scenario);
  if (def.cost > remaining) {
    reasons.push(`Te duur: kost ${formatShort(def.cost)}, nog ${formatShort(remaining)} beschikbaar.`);
  }

  return { ok: reasons.length === 0, reasons, cost: def.cost };
}

export interface PathPaintResult {
  ok: boolean;
  reason: string | null;
}

export function validatePathPaint(
  layout: FestivalLayout,
  scenario: ScenarioSettings,
  x: number,
  y: number,
  budget: number,
): PathPaintResult {
  const grid = layout.grid;
  if (!inBounds(grid, x, y)) return { ok: false, reason: 'Buiten het terrein.' };
  const i = tileIndex(grid, x, y);
  if (grid.tiles[i] === 'path') return { ok: false, reason: 'Hier ligt al een pad.' };
  if (grid.tiles[i] === 'obstacle') return { ok: false, reason: 'Op een obstakel kan geen pad.' };
  const occ = buildOccupancy(grid, layout.facilities);
  if (occ[i] >= 0) return { ok: false, reason: `Onder ${layout.facilities[occ[i]].name} kan geen pad.` };
  const remaining = budget - computeSpent(layout, scenario);
  if (scenario.pathTileCost > remaining) return { ok: false, reason: 'Onvoldoende budget voor nog een padtegel.' };
  return { ok: true, reason: null };
}

function formatShort(n: number): string {
  return `€ ${n.toLocaleString('nl-NL')}`;
}
