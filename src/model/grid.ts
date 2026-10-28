import { FACILITY_DEFS } from './catalog';
import type { Facility, FacilityType, Facing, Point, TileGrid } from './types';

export const AUDIENCE_DEPTH = 5;

export function tileIndex(grid: { width: number }, x: number, y: number): number {
  return y * grid.width + x;
}

export function tilePoint(grid: { width: number }, index: number): Point {
  return { x: index % grid.width, y: Math.floor(index / grid.width) };
}

export function inBounds(grid: { width: number; height: number }, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < grid.width && y < grid.height;
}

export interface FacilityShape {
  type: FacilityType;
  x: number;
  y: number;
  facing: Facing;
}

export function footprintSize(type: FacilityType, facing: Facing): { w: number; h: number } {
  const def = FACILITY_DEFS[type];
  return facing === 'south' || facing === 'north'
    ? { w: def.width, h: def.height }
    : { w: def.height, h: def.width };
}

export function footprintTiles(f: FacilityShape): Point[] {
  const { w, h } = footprintSize(f.type, f.facing);
  const out: Point[] = [];
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) out.push({ x: f.x + dx, y: f.y + dy });
  }
  return out;
}

/** De ene tegel direct naast de footprint waarlangs bezoekers de voorziening gebruiken. */
export function accessTile(f: FacilityShape): Point {
  const { w, h } = footprintSize(f.type, f.facing);
  switch (f.facing) {
    case 'south':
      return { x: f.x + Math.floor(w / 2), y: f.y + h };
    case 'north':
      return { x: f.x + Math.floor(w / 2), y: f.y - 1 };
    case 'west':
      return { x: f.x - 1, y: f.y + Math.floor(h / 2) };
    case 'east':
      return { x: f.x + w, y: f.y + Math.floor(h / 2) };
  }
}

/** Middelste footprinttegel; voor de ingang is dit de poort. */
export function centerTile(f: FacilityShape): Point {
  const { w, h } = footprintSize(f.type, f.facing);
  return { x: f.x + Math.floor(w / 2), y: f.y + Math.floor(h / 2) };
}

/** Publiekszone voor een podium: AUDIENCE_DEPTH diep, (breedte + 2) breed, aan de toegangskant. */
export function audienceZone(stage: FacilityShape, grid: { width: number; height: number }): Point[] {
  const { w, h } = footprintSize(stage.type, stage.facing);
  const out: Point[] = [];
  const push = (x: number, y: number) => {
    if (inBounds(grid, x, y)) out.push({ x, y });
  };
  for (let d = 0; d < AUDIENCE_DEPTH; d++) {
    if (stage.facing === 'south' || stage.facing === 'north') {
      const y = stage.facing === 'south' ? stage.y + h + d : stage.y - 1 - d;
      for (let x = stage.x - 1; x <= stage.x + w; x++) push(x, y);
    } else {
      const x = stage.facing === 'east' ? stage.x + w + d : stage.x - 1 - d;
      for (let y = stage.y - 1; y <= stage.y + h; y++) push(x, y);
    }
  }
  return out;
}

/** Facility-index per tegel (−1 = vrij). */
export function buildOccupancy(grid: TileGrid, facilities: Facility[]): Int32Array {
  const occ = new Int32Array(grid.width * grid.height).fill(-1);
  facilities.forEach((f, i) => {
    for (const p of footprintTiles(f)) {
      if (inBounds(grid, p.x, p.y)) occ[tileIndex(grid, p.x, p.y)] = i;
    }
  });
  return occ;
}

export const NEIGHBOR_OFFSETS: ReadonlyArray<readonly [number, number]> = [
  [0, -1], // noord
  [1, 0], // oost
  [0, 1], // zuid
  [-1, 0], // west
];
