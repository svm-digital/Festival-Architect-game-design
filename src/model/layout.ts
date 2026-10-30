import { FACILITY_DEFS } from './catalog';
import { buildOccupancy, inBounds, tileIndex, type FacilityShape } from './grid';
import { validatePathPaint, validatePlacement, type PlacementResult } from './placement';
import type { Facility, FacilityType, FestivalLayout, Program, ScenarioSettings } from './types';


function nextName(layout: FestivalLayout, type: FacilityType): string {
  const def = FACILITY_DEFS[type];
  if (type === 'entrance') return def.label;
  const used = new Set(layout.facilities.filter((f) => f.type === type).map((f) => f.name));
  for (let n = 1; ; n++) {
    const name = type === 'stage' ? `${def.label} ${String.fromCharCode(64 + n)}` : `${def.label} ${n}`;
    if (!used.has(name)) return name;
  }
}

export function placeFacility(
  layout: FestivalLayout,
  scenario: ScenarioSettings,
  candidate: FacilityShape,
  budget: number,
): { layout: FestivalLayout; result: PlacementResult; facility: Facility | null } {
  const result = validatePlacement(layout, scenario, candidate, budget);
  if (!result.ok) return { layout, result, facility: null };
  const facility: Facility = {
    id: `f${layout.nextFacilityNumber}`,
    type: candidate.type,
    name: nextName(layout, candidate.type),
    x: candidate.x,
    y: candidate.y,
    facing: candidate.facing,
  };
  return {
    layout: { ...layout, facilities: [...layout.facilities, facility], nextFacilityNumber: layout.nextFacilityNumber + 1 },
    result,
    facility,
  };
}

export function removeFacility(layout: FestivalLayout, id: string): FestivalLayout {
  return { ...layout, facilities: layout.facilities.filter((f) => f.id !== id) };
}

export function paintPath(layout: FestivalLayout, scenario: ScenarioSettings, x: number, y: number, budget: number): FestivalLayout {
  if (!validatePathPaint(layout, scenario, x, y, budget).ok) return layout;
  const tiles = layout.grid.tiles.slice();
  tiles[tileIndex(layout.grid, x, y)] = 'path';
  return { ...layout, grid: { ...layout.grid, tiles } };
}

export function erasePath(layout: FestivalLayout, x: number, y: number): FestivalLayout {
  if (!inBounds(layout.grid, x, y)) return layout;
  const i = tileIndex(layout.grid, x, y);
  if (layout.grid.tiles[i] !== 'path') return layout;
  const tiles = layout.grid.tiles.slice();
  tiles[i] = 'grass';
  return { ...layout, grid: { ...layout.grid, tiles } };
}

export function facilityAt(layout: FestivalLayout, x: number, y: number): Facility | null {
  if (!inBounds(layout.grid, x, y)) return null;
  const occ = buildOccupancy(layout.grid, layout.facilities);
  const i = occ[tileIndex(layout.grid, x, y)];
  return i >= 0 ? layout.facilities[i] : null;
}

/** Verwijdert optredens van podia die niet meer bestaan of buiten de tijdsloten vallen. */
export function pruneProgram(program: Program, layout: FestivalLayout, scenario: ScenarioSettings): Program {
  const stageIds = new Set(layout.facilities.filter((f) => f.type === 'stage').map((f) => f.id));
  const performances = program.performances.filter(
    (p) => stageIds.has(p.stageId) && p.slot >= 0 && p.slot < scenario.slots.length,
  );
  return performances.length === program.performances.length ? program : { performances };
}

/** Compacte vingerafdruk van ontwerp + programma + seed, om rapporten aan een versie te koppelen. */
export function designSignature(
  layout: FestivalLayout,
  program: Program,
  seed: number,
  visitorCount: number,
  ticketPrice: number,
): string {
  const facilities = layout.facilities.map((f) => `${f.type}:${f.x},${f.y},${f.facing}`).join('|');
  const paths: number[] = [];
  layout.grid.tiles.forEach((t, i) => {
    if (t === 'path') paths.push(i);
  });
  const perf = program.performances
    .map((p) => `${p.stageId}@${p.slot}=${p.actId}`)
    .sort()
    .join('|');
  const raw = `${facilities}#${paths.join(',')}#${perf}#${seed}#${visitorCount}#${ticketPrice}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < raw.length; i++) {
    h ^= raw.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}
