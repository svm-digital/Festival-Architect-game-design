import { describe, expect, it } from 'vitest';
import { computeSpent } from '../src/model/budget';
import { tileIndex } from '../src/model/grid';
import { paintPath, placeFacility, removeFacility } from '../src/model/layout';
import { snapEntrance, validatePathPaint, validatePlacement } from '../src/model/placement';
import { createEmptyLayout } from '../src/model/scenario';
import { BIG, blankLayout, place, S, setObstacle } from './helpers';

describe('plaatsingsvalidatie (acceptatiecriterium 1)', () => {
  it('accepteert een geldige plaatsing en muteert de oude layout niet', () => {
    const before = blankLayout();
    const r = placeFacility(before, S, { type: 'stage', x: 5, y: 5, facing: 'south' }, BIG);
    expect(r.result.ok).toBe(true);
    expect(r.layout.facilities).toHaveLength(1);
    expect(before.facilities).toHaveLength(0);
    expect(r.facility?.name).toBe('Podium A');
  });

  it('blokkeert bouwen buiten het raster', () => {
    const r = validatePlacement(blankLayout(), S, { type: 'stage', x: 29, y: 5, facing: 'south' }, BIG);
    expect(r.ok).toBe(false);
    expect(r.reasons.join(' ')).toMatch(/buiten het terrein/);
  });

  it('blokkeert een toegangstegel buiten het raster', () => {
    const r = validatePlacement(blankLayout(), S, { type: 'food', x: 4, y: 22, facing: 'south' }, BIG);
    expect(r.ok).toBe(false);
    expect(r.reasons.join(' ')).toMatch(/toegangstegel valt buiten/);
  });

  it('blokkeert overlap en noemt de andere voorziening', () => {
    const l = place(blankLayout(), 'stage', 5, 5);
    const r = validatePlacement(l, S, { type: 'food', x: 8, y: 6, facing: 'south' }, BIG);
    expect(r.ok).toBe(false);
    expect(r.reasons.join(' ')).toMatch(/Overlapt met Podium A/);
  });

  it('blokkeert bouwen op obstakels en paden', () => {
    let l = setObstacle(blankLayout(), 10, 10, 'tree');
    expect(validatePlacement(l, S, { type: 'food', x: 10, y: 10, facing: 'south' }, BIG).reasons.join(' ')).toMatch(/obstakel/);
    l = paintPath(l, S, 3, 3, BIG);
    expect(validatePlacement(l, S, { type: 'food', x: 3, y: 3, facing: 'south' }, BIG).reasons.join(' ')).toMatch(/op een pad/);
  });

  it('blokkeert een eigen toegangstegel op een obstakel', () => {
    const l = setObstacle(blankLayout(), 11, 12);
    // eetkraam 2×2 op (10,10) facing south → toegang (11,12)
    const r = validatePlacement(l, S, { type: 'food', x: 10, y: 10, facing: 'south' }, BIG);
    expect(r.reasons.join(' ')).toMatch(/toegangstegel ligt op een obstakel/);
  });

  it('blokkeert het afsluiten van de toegang van een andere voorziening', () => {
    const l = place(blankLayout(), 'food', 10, 10); // toegang (11,12)
    const r = validatePlacement(l, S, { type: 'toilet', x: 10, y: 12, facing: 'south' }, BIG);
    expect(r.ok).toBe(false);
    expect(r.reasons.join(' ')).toMatch(/Blokkeert de toegangstegel van Eetkraam 1/);
  });

  it('blokkeert het blokkeren van de ingang', () => {
    const l = place(blankLayout(), 'entrance', 14, 23, 'north'); // toegang (15,22)
    const r = validatePlacement(l, S, { type: 'toilet', x: 14, y: 21, facing: 'north' }, BIG);
    expect(r.ok).toBe(false);
    expect(r.reasons.join(' ')).toMatch(/toegang van de ingang/);
  });

  it('vereist dat de ingang op de terreingrens staat', () => {
    const r = validatePlacement(blankLayout(), S, { type: 'entrance', x: 10, y: 10, facing: 'north' }, BIG);
    expect(r.ok).toBe(false);
    expect(r.reasons.join(' ')).toMatch(/terreingrens/);
    for (const [cx, cy] of [[0, 12], [31, 5], [15, 0], [15, 23]]) {
      const shape = snapEntrance(blankLayout().grid, cx, cy);
      expect(validatePlacement(blankLayout(), S, shape, BIG).ok).toBe(true);
    }
  });

  it('staat maximaal één ingang en twee podia toe', () => {
    let l = place(blankLayout(), 'entrance', 14, 23, 'north');
    expect(validatePlacement(l, S, { type: 'entrance', x: 2, y: 23, facing: 'north' }, BIG).ok).toBe(false);
    l = place(l, 'stage', 1, 1);
    l = place(l, 'stage', 10, 1);
    const r = validatePlacement(l, S, { type: 'stage', x: 20, y: 1, facing: 'south' }, BIG);
    expect(r.ok).toBe(false);
    expect(r.reasons.join(' ')).toMatch(/Maximaal 2/);
  });

  it('blokkeert plaatsing boven het beschikbare budget en toont de kosten', () => {
    let l = blankLayout();
    l = place(l, 'stage', 1, 1);
    l = place(l, 'stage', 10, 1);
    l = place(l, 'entrance', 14, 23, 'north');
    l = place(l, 'food', 1, 10);
    l = place(l, 'food', 4, 10);
    expect(computeSpent(l, S)).toBe(2 * 800 + 400 + 2 * 300);
    const budget = 2600; // precies op
    const r = validatePlacement(l, S, { type: 'food', x: 7, y: 10, facing: 'south' }, budget);
    expect(r.ok).toBe(false);
    expect(r.cost).toBe(300);
    expect(r.reasons.join(' ')).toMatch(/Te duur/);
    expect(validatePlacement(l, S, { type: 'food', x: 7, y: 10, facing: 'south' }, budget + 300).ok).toBe(true);
    expect(validatePathPaint(l, S, 20, 20, budget).reason).toMatch(/budget/);
  });

  it('valideert paden: geen obstakel, geen voorziening, budget', () => {
    const base = createEmptyLayout(S);
    const tree = base.grid.tiles.findIndex((t) => t === 'obstacle');
    expect(validatePathPaint(base, S, tree % 32, Math.floor(tree / 32), BIG).ok).toBe(false);
    const l = place(blankLayout(), 'food', 10, 10);
    expect(validatePathPaint(l, S, 10, 10, BIG).reason).toMatch(/Onder Eetkraam 1/);
    expect(validatePathPaint(l, S, 5, 5, BIG).ok).toBe(true);
    const painted = paintPath(l, S, 5, 5, BIG);
    expect(painted.grid.tiles[tileIndex(painted.grid, 5, 5)]).toBe('path');
    expect(computeSpent(painted, S) - computeSpent(l, S)).toBe(S.pathTileCost);
  });

  it('verwijderen geeft de kosten terug', () => {
    const l = place(blankLayout(), 'stage', 5, 5);
    const id = l.facilities[0].id;
    expect(computeSpent(l, S)).toBe(800);
    expect(computeSpent(removeFacility(l, id), S)).toBe(0);
  });
});
