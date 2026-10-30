import { describe, expect, it } from 'vitest';
import { programCost } from '../src/model/budget';
import { actFee, getAct, PRODUCTS } from '../src/model/catalog';
import { bestTicketPrice, computeDemand, demandAtPrice, ECONOMY, fixedCosts, settleEdition } from '../src/model/economy';
import { example, S } from './helpers';

describe('economie: vraag en afrekening', () => {
  const { layout, program } = example();

  it('meer ticketprijs = minder bezoekers, begrensd tussen 10 en 150', () => {
    let prev = Infinity;
    for (let p = ECONOMY.ticketPrice.min; p <= ECONOMY.ticketPrice.max; p += 5) {
      const d = computeDemand(S, program, p, null);
      expect(d.visitors).toBeLessThanOrEqual(prev);
      expect(d.visitors).toBeGreaterThanOrEqual(ECONOMY.minVisitors);
      expect(d.visitors).toBeLessThanOrEqual(S.maxVisitors);
      prev = d.visitors;
    }
    expect(computeDemand(S, program, 10, null).soldOut).toBe(true);
    expect(computeDemand(S, program, 100, null).soldOut).toBe(false);
  });

  it('reputatie volgt de tevredenheid van de vorige editie, begrensd', () => {
    expect(computeDemand(S, program, 50, null).reputationFactor).toBe(1);
    expect(computeDemand(S, program, 50, 60).reputationFactor).toBeCloseTo(1);
    expect(computeDemand(S, program, 50, 80).reputationFactor).toBeCloseTo(1.2);
    expect(computeDemand(S, program, 50, 100).reputationFactor).toBe(1.25);
    expect(computeDemand(S, program, 50, 0).reputationFactor).toBe(0.75);
    expect(computeDemand(S, program, 50, 80).visitors).toBeGreaterThan(computeDemand(S, program, 50, 40).visitors);
  });

  it('een populairdere line-up trekt meer bezoekers', () => {
    const weak = { performances: program.performances.map((p, i) => ({ ...p, actId: ['hoge-hoed', 'lantaarnkoor', 'grindpad', 'maanlicht-modem', 'kaartenhuis', 'pixelregen'][i] })) };
    expect(computeDemand(S, weak, 50, null).visitors).toBeLessThan(computeDemand(S, program, 50, null).visitors);
    expect(computeDemand(S, { performances: [] }, 50, null).lineupFactor).toBe(ECONOMY.lineup.noActs);
  });

  it('bestTicketPrice geeft de hoogste ticketomzet in stappen van € 5', () => {
    const base = computeDemand(S, program, 35, null);
    const best = bestTicketPrice(base, S);
    for (let p = ECONOMY.ticketPrice.min; p <= ECONOMY.ticketPrice.max; p += 5) {
      const d = demandAtPrice(base, S, p);
      expect(d.visitors * p).toBeLessThanOrEqual(best.visitors * best.ticketPrice);
    }
  });

  it('gages hangen af van populariteit', () => {
    expect(actFee(getAct('betonbloem')!)).toBe(9 * 40);
    expect(programCost(program)).toBe(program.performances.reduce((a, p) => a + actFee(getAct(p.actId)!), 0));
  });

  it('afrekening: omzet − (vaste kosten + inkoop) schuift door naar het kapitaal', () => {
    const f = settleEdition(layout, program, S, 10000, 40, 120, { units: { food: 50, bar: 100, merch: 20 } });
    expect(f.revenue.tickets).toBe(4800);
    expect(f.revenue.food).toBe(50 * PRODUCTS.food.price);
    expect(f.revenue.bar).toBe(100 * PRODUCTS.bar.price);
    expect(f.revenue.merch).toBe(20 * PRODUCTS.merch.price);
    expect(f.purchaseCosts).toBe(50 * PRODUCTS.food.purchase + 100 * PRODUCTS.bar.purchase + 20 * PRODUCTS.merch.purchase);
    expect(f.fixedCosts).toBe(fixedCosts(layout, program, S));
    expect(f.fixedCostLines.reduce((a, l) => a + l.total, 0)).toBe(f.fixedCosts);
    expect(f.result).toBe(f.revenueTotal - f.costsTotal);
    expect(f.capitalEnd).toBe(10000 + f.result);
  });
});
