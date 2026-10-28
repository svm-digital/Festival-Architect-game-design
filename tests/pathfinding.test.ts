import { describe, expect, it } from 'vitest';
import { tileIndex } from '../src/model/grid';
import { buildWalkGrid, type WalkGrid } from '../src/model/reachability';
import { costField, findPath, pathFromField } from '../src/sim/pathfinding';
import { createRng, nextInt } from '../src/sim/rng';
import { blankLayout, example, setObstacle } from './helpers';

function assertValidPath(walk: WalkGrid, start: number, path: number[], goal: number) {
  let prev = start;
  for (const t of path) {
    expect(walk.walkable[t]).toBe(1);
    const dx = Math.abs((t % walk.width) - (prev % walk.width));
    const dy = Math.abs(Math.floor(t / walk.width) - Math.floor(prev / walk.width));
    expect(dx + dy).toBe(1);
    prev = t;
  }
  expect(prev).toBe(goal);
}

const pathCost = (walk: WalkGrid, path: number[]) => path.reduce((a, t) => a + walk.enterCost[t], 0);

describe('pathfinding (acceptatiecriterium 3)', () => {
  it('vindt een geldige route rond obstakels', () => {
    let l = blankLayout();
    for (let y = 0; y < 20; y++) l = setObstacle(l, 10, y);
    const walk = buildWalkGrid(l);
    const start = tileIndex(walk, 2, 2);
    const goal = tileIndex(walk, 18, 2);
    const path = findPath(walk, start, goal)!;
    assertValidPath(walk, start, path, goal);
    expect(path.some((t) => Math.floor(t / walk.width) >= 20)).toBe(true); // moet onder de muur door
  });

  it('geeft null voor een onbereikbaar doel en [] voor start = doel', () => {
    let l = blankLayout();
    for (let y = 0; y < 24; y++) l = setObstacle(l, 10, y);
    const walk = buildWalkGrid(l);
    expect(findPath(walk, tileIndex(walk, 2, 2), tileIndex(walk, 18, 2))).toBeNull();
    expect(findPath(walk, 5, 5)).toEqual([]);
  });

  it('loopt niet door voorzieningen; alleen via de toegangstegel', () => {
    const { layout } = example();
    const walk = buildWalkGrid(layout);
    const stage = layout.facilities.find((f) => f.type === 'stage')!;
    expect(walk.walkable[tileIndex(walk, stage.x + 1, stage.y + 1)]).toBe(0);
  });

  it('A* is optimaal en komt overeen met het Dijkstra-kostenveld', () => {
    const { layout } = example();
    const walk = buildWalkGrid(layout);
    const rng = createRng(7);
    const open: number[] = [];
    for (let i = 0; i < walk.walkable.length; i++) if (walk.walkable[i]) open.push(i);
    for (let k = 0; k < 40; k++) {
      const start = open[nextInt(rng, 0, open.length - 1)];
      const goal = open[nextInt(rng, 0, open.length - 1)];
      const field = costField(walk, goal);
      const a = findPath(walk, start, goal);
      if (!Number.isFinite(field[start])) {
        expect(a).toBeNull();
        continue;
      }
      assertValidPath(walk, start, a!, goal);
      expect(pathCost(walk, a!)).toBeCloseTo(field[start], 3);
      const viaField = pathFromField(walk, field, start)!;
      if (start !== goal) assertValidPath(walk, start, viaField, goal);
      expect(pathCost(walk, viaField)).toBeCloseTo(field[start], 3);
    }
  });

  it('geeft de voorkeur aan paden boven gras', () => {
    // Recht: 5 grastegels × 1,5 + 1 padtegel = 8,5. Omweg via pad: 8 padtegels × 1 = 8.
    const l = blankLayout();
    const tiles = l.grid.tiles.slice();
    const set = (x: number, y: number) => (tiles[tileIndex(l.grid, x, y)] = 'path');
    set(2, 6);
    for (let x = 2; x <= 8; x++) set(x, 5);
    set(8, 6);
    const walk = buildWalkGrid({ ...l, grid: { ...l.grid, tiles } });
    const path = findPath(walk, tileIndex(walk, 2, 6), tileIndex(walk, 8, 6))!;
    expect(path.every((t) => walk.tileTypes[t] === 'path')).toBe(true);
  });

  it('is deterministisch', () => {
    const walk = buildWalkGrid(example().layout);
    const a = findPath(walk, tileIndex(walk, 15, 22), tileIndex(walk, 6, 6));
    const b = findPath(walk, tileIndex(walk, 15, 22), tileIndex(walk, 6, 6));
    expect(a).toEqual(b);
  });
});
