import { describe, expect, it } from 'vitest';
import { compareKpis, createCampaign, currentCapital, isBankrupt, nextEditionNumber, previousSatisfaction, recordEdition, type Campaign, type EditionDraft } from '../src/game/campaign';
import { computeDemand } from '../src/model/economy';
import { placeFacility } from '../src/model/layout';
import { buildReport } from '../src/sim/report';
import { createSimulation, runToEnd } from '../src/sim/simulation';
import { BIG, example, S } from './helpers';

function runEdition(c: Campaign, draft: EditionDraft): Campaign {
  const demand = computeDemand(S, draft.program, draft.ticketPrice, previousSatisfaction(c));
  const report = buildReport(
    runToEnd(createSimulation({ layout: draft.layout, program: draft.program, scenario: S, seed: draft.seed, demand, capitalStart: currentCapital(c) })),
  );
  return recordEdition({ ...c, draft }, draft, report, '2026-10-30T12:00:00.000Z');
}

describe('festivalreeks: meerdere edities', () => {
  it('kapitaal en reputatie schuiven door naar de volgende editie', () => {
    const { layout, program } = example();
    let c = createCampaign('Reeks', S, { layout, program, seed: 1, ticketPrice: 35 });
    expect(currentCapital(c)).toBe(S.startCapital);
    expect(nextEditionNumber(c)).toBe(1);
    c = runEdition(c, c.draft);
    const e1 = c.editions[0];
    expect(e1.number).toBe(1);
    expect(e1.report.finance.capitalStart).toBe(S.startCapital);
    expect(currentCapital(c)).toBe(e1.report.finance.capitalEnd);
    expect(nextEditionNumber(c)).toBe(2);

    c = runEdition(c, c.draft);
    const e2 = c.editions[1];
    expect(e2.report.finance.capitalStart).toBe(e1.report.finance.capitalEnd);
    expect(e2.report.demand.reputationFactor).toBeCloseTo(1 + 0.01 * (e1.report.avgSatisfaction - 60));
  });

  it('verbeterpunten opvolgen levert een betere editie op, zichtbaar in de vergelijking', () => {
    const { layout, program } = example();
    let c = createCampaign('Reeks', S, { layout, program, seed: 3, ticketPrice: 35 });
    c = runEdition(c, c.draft);
    const r1 = c.editions[0].report;
    // Rapport wijst op de ticketprijs en de wachtrij bij de eetkramen
    expect(r1.advice.some((a) => a.startsWith('Ticketprijs'))).toBe(true);
    expect(r1.advice.some((a) => a.includes('Eetkraam') && a.includes('wachtten'))).toBe(true);

    // Editie 2: hogere prijs en een derde eetkraam
    const placed = placeFacility(c.draft.layout, S, { type: 'food', x: 6, y: 16, facing: 'north' }, BIG);
    expect(placed.result.ok).toBe(true);
    c = runEdition(c, { ...c.draft, layout: placed.layout, ticketPrice: 45 });
    const r2 = c.editions[1].report;

    const d = compareKpis(r2, r1);
    const k = (key: string) => d.find((x) => x.key === key)!;
    expect(r2.finance.result).toBeGreaterThan(r1.finance.result);
    expect(k('result').improved).toBe(true);
    expect(k('capital').improved).toBe(true);
    expect(k('ticket').improved).toBe(true);
  });

  it('is failliet als het kapitaal op is', () => {
    const { layout, program } = example();
    const c = createCampaign('Reeks', S, { layout, program, seed: 1 });
    expect(isBankrupt(c)).toBe(false);
    expect(isBankrupt({ ...c, startCapital: 0 })).toBe(true);
  });
});
