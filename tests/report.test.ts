import { describe, expect, it } from 'vitest';
import { computeSpent, programCost } from '../src/model/budget';
import { placeFacility, removeFacility } from '../src/model/layout';
import { buildReport } from '../src/sim/report';
import { createSimulation, runToEnd } from '../src/sim/simulation';
import { BIG, exampleInput, S } from './helpers';

const run = (input = exampleInput()) => buildReport(runToEnd(createSimulation(input)));

describe('eindrapport (criterium 10)', () => {
  it('bevat alle onderdelen en klopt met het budget', () => {
    const input = exampleInput();
    const r = run(input);
    expect(r.visitorCount).toBe(r.demand.visitors);
    expect(r.stillOnSiteAtEnd).toBe(0);
    expect(r.facilities.filter((f) => f.type === 'food' || f.type === 'toilet').every((f) => f.avgWaitMinutes !== null)).toBe(true);
    expect(r.popularStageId).not.toBeNull();
    expect(r.peaks.length).toBeGreaterThan(0);
    expect(r.peaks.length).toBeLessThanOrEqual(3);
    expect(r.finance.fixedCosts).toBe(computeSpent(input.layout, S) + programCost(input.program));
    expect(r.finance.fixedCostLines.reduce((a, l) => a + l.total, 0)).toBe(r.finance.fixedCosts);
    expect(r.finance.revenue.tickets).toBe(r.visitorCount * r.demand.ticketPrice);
    expect(r.finance.capitalEnd).toBe(S.startCapital + r.finance.result);
    expect(r.incidents.map((i) => i.kind)).toEqual(['medical', 'conflict', 'wellbeing']);
    expect(r.posts.length).toBe(3);
    const merch = r.facilities.find((f) => f.type === 'merch')!;
    expect(merch.revenue).toBe(r.finance.revenue.merch);
    expect(r.heat).toHaveLength(32 * 24);
    expect(r.advice.length).toBeGreaterThan(0);
  });

  it('wijst een overbelaste voorziening aan, en het opvolgen van het advies helpt', () => {
    // Ontwerp met maar één eetkraam
    const base = exampleInput();
    const foods = base.layout.facilities.filter((f) => f.type === 'food');
    const oneStall = removeFacility(base.layout, foods[1].id);
    const before = run({ ...base, layout: oneStall });
    const stall = before.facilities.find((f) => f.id === foods[0].id)!;
    expect(before.advice.some((a) => a.includes(stall.name) && a.includes('wachtten'))).toBe(true);

    // Advies opvolgen: een tweede eetkraam elders
    const placed = placeFacility(oneStall, S, { type: 'food', x: 21, y: 10, facing: 'south' }, BIG);
    expect(placed.result.ok).toBe(true);
    const after = run({ ...base, layout: placed.layout });
    const waitFood = (r: typeof before) => {
      const f = r.facilities.filter((x) => x.type === 'food');
      const served = f.reduce((a, x) => a + x.served, 0);
      return f.reduce((a, x) => a + (x.avgWaitMinutes ?? 0) * x.served, 0) / served;
    };
    expect(waitFood(after)).toBeLessThan(waitFood(before));
    const abandoned = (r: typeof before) => r.facilities.filter((x) => x.type === 'food').reduce((a, x) => a + x.abandoned, 0);
    expect(abandoned(after)).toBeLessThan(abandoned(before));
  });

  it('noemt onbereikbare voorzieningen met uitleg', () => {
    const base = exampleInput();
    // Zet een toiletblok achter de vijver/bomen dicht: plaats een zitgebied op zijn toegang is verboden,
    // dus sluit het af met obstakels rond de toegangstegel.
    const toilet = base.layout.facilities.find((f) => f.type === 'toilet')!; // toegang (12,12)
    const tiles = base.layout.grid.tiles.slice();
    const kinds = base.layout.grid.obstacleKinds.slice();
    for (const [x, y] of [[11, 12], [13, 12], [12, 11]]) {
      tiles[y * 32 + x] = 'obstacle';
      kinds[y * 32 + x] = 'rock';
    }
    const layout = { ...base.layout, grid: { ...base.layout.grid, tiles, obstacleKinds: kinds } };
    const r = run({ ...base, layout });
    const f = r.facilities.find((x) => x.id === toilet.id)!;
    expect(f.reachable).toBe(false);
    expect(f.served).toBe(0);
    expect(r.advice.some((a) => a.startsWith(`${toilet.name} was niet bereikbaar`) && a.includes('afgesloten gebied'))).toBe(true);
  });

  it('signaleert een act met weinig publiek', () => {
    const base = exampleInput();
    const program = {
      performances: base.program.performances.map((p) => (p.slot === 0 && p.actId === 'pixelregen' ? { ...p, actId: 'lantaarnkoor' } : p)),
    };
    const r = run({ ...base, program });
    expect(r.advice.some((a) => a.includes('Lantaarnkoor'))).toBe(true);
  });
});

describe('advies over geld', () => {
  it('meldt uitverkocht en een betere ticketprijs', () => {
    const r = run(exampleInput({ ticketPrice: 25 }));
    expect(r.demand.soldOut).toBe(true);
    expect(r.advice.some((a) => a.startsWith('Uitverkocht'))).toBe(true);
    expect(r.advice.some((a) => a.startsWith('Ticketprijs'))).toBe(true);
  });
});
