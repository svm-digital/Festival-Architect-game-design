import { lowerLabel } from './catalog';
import { fixedCosts } from './economy';
import { accessTile, buildOccupancy, inBounds, NEIGHBOR_OFFSETS, tileIndex } from './grid';
import type { Facility, FestivalLayout, ObstacleKind, Program, ScenarioSettings, TileType } from './types';

/** Kosten om een tegel te betreden. Paden zijn goedkoper, dus bezoekers verkiezen ze. */
export const PATH_COST = 1;
export const GRASS_COST = 1.5;

export interface WalkGrid {
  width: number;
  height: number;
  walkable: Uint8Array;
  enterCost: Float32Array;
  tileTypes: TileType[];
}

export function buildWalkGrid(layout: FestivalLayout): WalkGrid {
  const { grid } = layout;
  const occ = buildOccupancy(grid, layout.facilities);
  const n = grid.width * grid.height;
  const walkable = new Uint8Array(n);
  const enterCost = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = grid.tiles[i];
    walkable[i] = t !== 'obstacle' && occ[i] < 0 ? 1 : 0;
    enterCost[i] = t === 'path' ? PATH_COST : GRASS_COST;
  }
  return { width: grid.width, height: grid.height, walkable, enterCost, tileTypes: grid.tiles };
}

/** Alle begaanbare tegels die vanaf `start` bereikbaar zijn (4-buren). */
export function floodFill(walk: WalkGrid, start: number): Uint8Array {
  const seen = new Uint8Array(walk.width * walk.height);
  if (start < 0 || !walk.walkable[start]) return seen;
  const stack = [start];
  seen[start] = 1;
  while (stack.length) {
    const i = stack.pop()!;
    const x = i % walk.width;
    const y = (i - x) / walk.width;
    for (const [dx, dy] of NEIGHBOR_OFFSETS) {
      const nx = x + dx;
      const ny = y + dy;
      if (!inBounds(walk, nx, ny)) continue;
      const j = ny * walk.width + nx;
      if (!seen[j] && walk.walkable[j]) {
        seen[j] = 1;
        stack.push(j);
      }
    }
  }
  return seen;
}

export interface FacilityReach {
  facilityId: string;
  reachable: boolean;
  /** Uitleg voor de speler als de voorziening niet bereikbaar is. */
  explanation: string | null;
  /** Tegels van het afgesloten gebied rond de toegangstegel (voor de bereikbaarheidslaag). */
  regionTiles: number[];
}

export interface ReachabilityAnalysis {
  entranceId: string | null;
  /** 1 = bereikbaar vanaf de ingang. Null als er geen ingang is. */
  reachable: Uint8Array | null;
  facilities: Record<string, FacilityReach>;
}

const OBSTACLE_LABEL: Record<ObstacleKind, string> = { tree: 'bomen', water: 'water', rock: 'rotsen' };

function joinNl(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} en ${items[items.length - 1]}`;
}

function explainEnclosure(layout: FestivalLayout, walk: WalkGrid, f: Facility, entrance: Facility | null): FacilityReach {
  const a = accessTile(f);
  const coord = `(${a.x}, ${a.y})`;
  if (!entrance) {
    return {
      facilityId: f.id,
      reachable: false,
      explanation: `${f.name} is niet bereikbaar omdat er nog geen ingang is.`,
      regionTiles: [],
    };
  }
  const ai = tileIndex(walk, a.x, a.y);
  if (!inBounds(walk, a.x, a.y) || !walk.walkable[ai]) {
    return {
      facilityId: f.id,
      reachable: false,
      explanation: `${f.name}: de toegangstegel ${coord} is geblokkeerd.`,
      regionTiles: [],
    };
  }
  const region = floodFill(walk, ai);
  const regionTiles: number[] = [];
  const occ = buildOccupancy(layout.grid, layout.facilities);
  const blockerFacilities = new Set<string>();
  const blockerObstacles = new Set<string>();
  let touchesEdge = false;
  for (let i = 0; i < region.length; i++) {
    if (!region[i]) continue;
    regionTiles.push(i);
    const x = i % walk.width;
    const y = (i - x) / walk.width;
    for (const [dx, dy] of NEIGHBOR_OFFSETS) {
      const nx = x + dx;
      const ny = y + dy;
      if (!inBounds(walk, nx, ny)) {
        touchesEdge = true;
        continue;
      }
      const j = ny * walk.width + nx;
      if (walk.walkable[j]) continue;
      if (occ[j] >= 0) {
        const other = layout.facilities[occ[j]];
        if (other.id !== f.id) blockerFacilities.add(other.name);
      } else {
        const kind = layout.grid.obstacleKinds[j];
        if (kind) blockerObstacles.add(OBSTACLE_LABEL[kind]);
      }
    }
  }
  const parts = [...blockerFacilities, ...blockerObstacles];
  if (touchesEdge) parts.push('de terreingrens');
  const size = regionTiles.length;
  const hint =
    blockerFacilities.size > 0
      ? ` Maak een doorgang vrij, bijvoorbeeld door ${[...blockerFacilities][0]} te verplaatsen.`
      : ' Draai of verplaats de voorziening naar een open plek.';
  return {
    facilityId: f.id,
    reachable: false,
    explanation:
      `${f.name} is niet bereikbaar vanaf de ingang. De toegangstegel ${coord} ligt in een afgesloten gebied ` +
      `van ${size} ${size === 1 ? 'tegel' : 'tegels'}, ingesloten door ${joinNl(parts)}.${hint}`,
    regionTiles,
  };
}

export function analyzeReachability(layout: FestivalLayout, walk: WalkGrid = buildWalkGrid(layout)): ReachabilityAnalysis {
  const entrance = layout.facilities.find((f) => f.type === 'entrance') ?? null;
  let reachable: Uint8Array | null = null;
  if (entrance) {
    const a = accessTile(entrance);
    reachable = inBounds(walk, a.x, a.y) ? floodFill(walk, tileIndex(walk, a.x, a.y)) : new Uint8Array(walk.width * walk.height);
  }
  const facilities: Record<string, FacilityReach> = {};
  for (const f of layout.facilities) {
    const a = accessTile(f);
    const ok = reachable !== null && inBounds(walk, a.x, a.y) && reachable[tileIndex(walk, a.x, a.y)] === 1;
    facilities[f.id] = ok
      ? { facilityId: f.id, reachable: true, explanation: null, regionTiles: [] }
      : explainEnclosure(layout, walk, f, entrance);
  }
  return { entranceId: entrance?.id ?? null, reachable, facilities };
}

export type IssueSeverity = 'error' | 'warning';

export interface ValidationIssue {
  severity: IssueSeverity;
  code: string;
  message: string;
  facilityId?: string;
}

export interface SimulationValidation {
  ok: boolean;
  issues: ValidationIssue[];
  analysis: ReachabilityAnalysis;
}

export function validateForSimulation(
  layout: FestivalLayout,
  program: Program,
  scenario: ScenarioSettings,
  /** Beschikbaar kapitaal voor deze editie. */
  capital: number,
): SimulationValidation {
  const analysis = analyzeReachability(layout);
  const issues: ValidationIssue[] = [];
  const err = (code: string, message: string, facilityId?: string) => issues.push({ severity: 'error', code, message, facilityId });
  const warn = (code: string, message: string, facilityId?: string) => issues.push({ severity: 'warning', code, message, facilityId });

  const stages = layout.facilities.filter((f) => f.type === 'stage');
  if (!analysis.entranceId) err('no-entrance', 'Plaats een ingang/uitgang op de terreingrens.');
  if (stages.length === 0) err('no-stage', 'Plaats minstens één podium.');
  else if (analysis.entranceId && !stages.some((s) => analysis.facilities[s.id].reachable)) {
    err('no-reachable-stage', 'Geen enkel podium is bereikbaar vanaf de ingang. Zonder bereikbaar podium kan de simulatie niet starten.');
  }
  const costs = fixedCosts(layout, program, scenario);
  if (costs > capital) {
    err(
      'over-budget',
      `Huur en gages kosten samen € ${costs.toLocaleString('nl-NL')}, maar er is maar € ${Math.max(0, capital).toLocaleString('nl-NL')} kapitaal.`,
    );
  }

  if (analysis.entranceId) {
    for (const f of layout.facilities) {
      const r = analysis.facilities[f.id];
      if (!r.reachable && f.type !== 'entrance' && r.explanation) warn('unreachable', r.explanation, f.id);
    }
  }
  for (const type of ['food', 'bar', 'toilet'] as const) {
    if (!layout.facilities.some((f) => f.type === type)) {
      warn(`no-${type}`, `Er is geen ${lowerLabel(type)}. Bezoekers met die behoefte vinden geen doel.`);
    }
  }
  for (const type of ['firstaid', 'security', 'awareness'] as const) {
    if (!layout.facilities.some((f) => f.type === type)) {
      warn(`no-${type}`, `Er is geen ${lowerLabel(type)}. Incidenten van dat type worden niet opgevangen.`);
    }
  }
  const stageIds = new Set(stages.map((s) => s.id));
  const performances = program.performances.filter((p) => stageIds.has(p.stageId));
  if (stages.length > 0 && performances.length === 0) {
    warn('no-performances', 'Het programma is leeg. Zonder optredens slenteren bezoekers alleen rond.');
  } else {
    for (const s of stages) {
      if (!performances.some((p) => p.stageId === s.id)) warn('idle-stage', `${s.name} heeft geen optredens in het programma.`, s.id);
    }
  }
  return { ok: !issues.some((i) => i.severity === 'error'), issues, analysis };
}
