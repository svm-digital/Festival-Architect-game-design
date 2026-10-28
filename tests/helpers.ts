import { tileIndex } from '../src/model/grid';
import { placeFacility } from '../src/model/layout';
import { COMPACT_SCENARIO, createEmptyLayout, createExampleDesign, DEFAULT_SEED } from '../src/model/scenario';
import type { Facing, FacilityType, FestivalLayout, ObstacleKind, Program, ScenarioSettings } from '../src/model/types';
import type { SimulationInput } from '../src/sim/types';

export const S: ScenarioSettings = COMPACT_SCENARIO;

export function example(): { layout: FestivalLayout; program: Program } {
  return createExampleDesign(S);
}

export function exampleInput(overrides: Partial<SimulationInput> = {}): SimulationInput {
  const { layout, program } = example();
  return { layout, program, scenario: S, seed: DEFAULT_SEED, ...overrides };
}

export function place(layout: FestivalLayout, type: FacilityType, x: number, y: number, facing: Facing = 'south'): FestivalLayout {
  const r = placeFacility(layout, S, { type, x, y, facing });
  if (!r.facility) throw new Error(`Plaatsing mislukt: ${r.result.reasons.join(' ')}`);
  return r.layout;
}

export function setObstacle(layout: FestivalLayout, x: number, y: number, kind: ObstacleKind = 'rock'): FestivalLayout {
  const tiles = layout.grid.tiles.slice();
  const kinds = layout.grid.obstacleKinds.slice();
  const i = tileIndex(layout.grid, x, y);
  tiles[i] = 'obstacle';
  kinds[i] = kind;
  return { ...layout, grid: { ...layout.grid, tiles, obstacleKinds: kinds } };
}

/** Leeg terrein zonder scenario-obstakels, voor geïsoleerde tests. */
export function blankLayout(): FestivalLayout {
  const l = createEmptyLayout(S);
  const n = l.grid.width * l.grid.height;
  return { ...l, grid: { ...l.grid, tiles: new Array(n).fill('grass'), obstacleKinds: new Array(n).fill(null) } };
}
