import { tileIndex } from './grid';
import { placeFacility } from './layout';
import type { Facing, FacilityType, FestivalLayout, ObstacleKind, Program, ScenarioSettings, TileGrid } from './types';

export const DEFAULT_SEED = 2026;

export const COMPACT_SCENARIO: ScenarioSettings = {
  id: 'compact-festival',
  title: 'Compact festival',
  goal: 'Bouw over meerdere edities een compact festival dat bezoekers tevreden houdt en geld oplevert.',
  gridWidth: 32,
  gridHeight: 24,
  startCapital: 10000,
  pathTileCost: 5,
  maxVisitors: 150,
  festivalMinutes: 240,
  exitWindowMinutes: 30,
  arrivalWindowMinutes: 90,
  clockStartMinutes: 14 * 60,
  slots: [
    { index: 0, startMinute: 20, endMinute: 80 },
    { index: 1, startMinute: 100, endMinute: 160 },
    { index: 2, startMinute: 180, endMinute: 240 },
  ],
};

type Cell = [number, number];

const TREES: Cell[] = [
  [22, 1], [23, 1], [26, 1],
  [1, 2], [2, 2], [21, 2], [22, 2], [23, 2], [25, 2], [26, 2], [29, 2],
  [1, 3], [22, 3], [28, 3], [29, 3],
  [30, 4],
  [9, 10], [10, 10], [11, 10], [17, 10], [18, 10], [19, 10],
  [1, 15], [1, 16], [2, 16], [2, 17], [1, 19], [2, 19], [1, 20],
  [28, 22],
];

/** Vijver als rijen [y, xVan, xTot]. */
const WATER_ROWS: [number, number, number][] = [
  [14, 24, 26],
  [15, 23, 27],
  [16, 22, 28],
  [17, 22, 27],
  [18, 22, 26],
  [19, 23, 25],
];

const ROCKS: Cell[] = [
  [11, 7], [22, 13], [29, 18], [4, 22],
];

export function createScenarioGrid(s: ScenarioSettings): TileGrid {
  const size = s.gridWidth * s.gridHeight;
  const grid: TileGrid = {
    width: s.gridWidth,
    height: s.gridHeight,
    tiles: new Array(size).fill('grass'),
    obstacleKinds: new Array(size).fill(null),
  };
  const set = (x: number, y: number, kind: ObstacleKind) => {
    const i = tileIndex(grid, x, y);
    grid.tiles[i] = 'obstacle';
    grid.obstacleKinds[i] = kind;
  };
  for (const [x, y] of TREES) set(x, y, 'tree');
  for (const [y, x0, x1] of WATER_ROWS) for (let x = x0; x <= x1; x++) set(x, y, 'water');
  for (const [x, y] of ROCKS) set(x, y, 'rock');
  return grid;
}

export function createEmptyLayout(s: ScenarioSettings): FestivalLayout {
  return { grid: createScenarioGrid(s), facilities: [], nextFacilityNumber: 1 };
}

/**
 * Een speelbaar voorbeeldontwerp binnen het startkapitaal. Bedoeld als startpunt en voor tests;
 * het is geen aanbevolen of 'optimaal' ontwerp.
 */
export function createExampleDesign(s: ScenarioSettings): { layout: FestivalLayout; program: Program } {
  let layout = createEmptyLayout(s);
  const place = (type: FacilityType, x: number, y: number, facing: Facing) => {
    const r = placeFacility(layout, s, { type, x, y, facing }, s.startCapital);
    if (!r.facility) throw new Error(`Voorbeeldontwerp ongeldig bij ${type}: ${r.result.reasons.join(' ')}`);
    layout = r.layout;
    return r.facility;
  };
  place('entrance', 14, 23, 'north');
  const stageA = place('stage', 4, 3, 'south');
  const stageB = place('stage', 14, 2, 'south');
  place('food', 8, 13, 'north');
  place('toilet', 11, 13, 'north');
  place('toilet', 17, 13, 'north');
  place('food', 21, 10, 'south');
  place('seating', 3, 13, 'north');
  place('seating', 26, 9, 'south');
  place('bar', 16, 15, 'west');
  place('bar', 20, 6, 'south');
  place('merch', 12, 15, 'east');
  place('firstaid', 17, 18, 'west');
  place('security', 12, 20, 'east');
  place('awareness', 20, 17, 'west');

  const tiles = layout.grid.tiles.slice();
  const path = (x: number, y: number) => {
    tiles[tileIndex(layout.grid, x, y)] = 'path';
  };
  for (let y = 5; y <= 22; y++) path(15, y);
  for (let x = 3; x <= 25; x++) path(x, 12);
  for (let y = 6; y <= 11; y++) path(6, y);
  layout = { ...layout, grid: { ...layout.grid, tiles } };

  const program: Program = {
    performances: [
      { stageId: stageA.id, slot: 0, actId: 'neonvlinders' },
      { stageId: stageB.id, slot: 0, actId: 'pixelregen' },
      { stageId: stageA.id, slot: 1, actId: 'stoomfluit' },
      { stageId: stageB.id, slot: 1, actId: 'veldspaat' },
      { stageId: stageA.id, slot: 2, actId: 'betonbloem' },
      { stageId: stageB.id, slot: 2, actId: 'synthkasteel' },
    ],
  };
  return { layout, program };
}
