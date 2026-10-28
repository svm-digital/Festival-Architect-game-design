import { describe, expect, it } from 'vitest';
import { analyzeReachability, validateForSimulation } from '../src/model/reachability';
import { blankLayout, example, place, S, setObstacle } from './helpers';

describe('bereikbaarheid vóór simulatie (acceptatiecriterium 2)', () => {
  it('voorbeeldontwerp is volledig bereikbaar en simuleerbaar', () => {
    const { layout, program } = example();
    const v = validateForSimulation(layout, program, S);
    expect(v.ok).toBe(true);
    expect(v.issues).toEqual([]);
    expect(Object.values(v.analysis.facilities).every((f) => f.reachable)).toBe(true);
  });

  it('weigert simulatie zonder ingang of podium', () => {
    const v = validateForSimulation(blankLayout(), { performances: [] }, S);
    expect(v.ok).toBe(false);
    expect(v.issues.map((i) => i.code)).toEqual(expect.arrayContaining(['no-entrance', 'no-stage']));
  });

  it('weigert simulatie als geen podium bereikbaar is', () => {
    let l = blankLayout();
    for (let y = 0; y < 24; y++) l = setObstacle(l, 16, y, 'tree'); // muur van bomen
    l = place(l, 'entrance', 3, 23, 'north');
    l = place(l, 'stage', 20, 2);
    const v = validateForSimulation(l, { performances: [] }, S);
    expect(v.ok).toBe(false);
    expect(v.issues.find((i) => i.code === 'no-reachable-stage')).toBeDefined();
    const stageId = l.facilities.find((f) => f.type === 'stage')!.id;
    const expl = v.analysis.facilities[stageId].explanation!;
    expect(expl).toMatch(/niet bereikbaar vanaf de ingang/);
    expect(expl).toMatch(/bomen/);
  });

  it('legt uit waarom een ingesloten voorziening onbereikbaar is', () => {
    let l = blankLayout();
    l = place(l, 'entrance', 14, 23, 'north');
    l = place(l, 'stage', 10, 5);
    l = place(l, 'food', 0, 0); // toegang (1,2)
    l = setObstacle(l, 0, 2);
    l = setObstacle(l, 2, 2);
    l = place(l, 'seating', 0, 3); // bedekt (1,3)
    const food = l.facilities.find((f) => f.type === 'food')!;
    const a = analyzeReachability(l);
    const r = a.facilities[food.id];
    expect(r.reachable).toBe(false);
    expect(r.regionTiles).toHaveLength(1);
    expect(r.explanation).toContain('afgesloten gebied van 1 tegel');
    expect(r.explanation).toContain('Zitgebied 1');
    expect(r.explanation).toContain('rotsen');
    expect(r.explanation).toContain('Zitgebied 1 te verplaatsen');

    const v = validateForSimulation(l, { performances: [] }, S);
    expect(v.ok).toBe(true); // podium bereikbaar → alleen waarschuwing
    const warn = v.issues.find((i) => i.code === 'unreachable');
    expect(warn?.severity).toBe('warning');
    expect(warn?.facilityId).toBe(food.id);
  });

  it('waarschuwt voor ontbrekende voorzieningen en een leeg programma', () => {
    let l = blankLayout();
    l = place(l, 'entrance', 14, 23, 'north');
    l = place(l, 'stage', 10, 5);
    const codes = validateForSimulation(l, { performances: [] }, S).issues.map((i) => i.code);
    expect(codes).toEqual(expect.arrayContaining(['no-food', 'no-toilet', 'no-performances']));
  });
});
