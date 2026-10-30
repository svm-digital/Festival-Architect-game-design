// Economie van een editie: vraag (bezoekersaantal), vaste kosten en afrekening.
// Alle regels zijn fictief en vereenvoudigd.

import { computeSpent, costBreakdown, programCost, type BudgetLine } from './budget';
import { getAct, PRODUCTS, type ProductType } from './catalog';
import type { FestivalLayout, Program, ScenarioSettings } from './types';

export const ECONOMY = {
  ticketPrice: { min: 10, max: 100, default: 35 },
  /** Prijsfactor = base − perEuro × prijs, begrensd. */
  price: { base: 1.2, perEuro: 0.01, min: 0.15, max: 1 },
  /** Line-upfactor = base + perPopularity × gemiddelde populariteit. */
  lineup: { base: 0.85, perPopularity: 0.04, noActs: 0.8 },
  /** Reputatie = 1 + perPoint × (tevredenheid vorige editie − neutral), begrensd. */
  reputation: { neutral: 60, perPoint: 0.01, min: 0.75, max: 1.25 },
  minVisitors: 10,
} as const;

export interface DemandBreakdown {
  ticketPrice: number;
  priceFactor: number;
  lineupFactor: number;
  reputationFactor: number;
  /** Aantal bezoekers vóór de terreinlimiet. */
  potential: number;
  visitors: number;
  soldOut: boolean;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function computeDemand(
  scenario: ScenarioSettings,
  program: Program,
  ticketPrice: number,
  previousSatisfaction: number | null,
): DemandBreakdown {
  const E = ECONOMY;
  const priceFactor = clamp(E.price.base - E.price.perEuro * ticketPrice, E.price.min, E.price.max);
  const pops = program.performances.map((p) => getAct(p.actId)?.popularity ?? 0);
  const lineupFactor = pops.length
    ? E.lineup.base + E.lineup.perPopularity * (pops.reduce((a, b) => a + b, 0) / pops.length)
    : E.lineup.noActs;
  const reputationFactor =
    previousSatisfaction === null
      ? 1
      : clamp(1 + E.reputation.perPoint * (previousSatisfaction - E.reputation.neutral), E.reputation.min, E.reputation.max);
  const potential = Math.round(scenario.maxVisitors * priceFactor * lineupFactor * reputationFactor);
  const visitors = clamp(potential, E.minVisitors, scenario.maxVisitors);
  return { ticketPrice, priceFactor, lineupFactor, reputationFactor, potential, visitors, soldOut: potential >= scenario.maxVisitors };
}

/** Dezelfde vraag, maar bij een andere ticketprijs (line-up en reputatie gelijk). */
export function demandAtPrice(base: DemandBreakdown, scenario: ScenarioSettings, ticketPrice: number): DemandBreakdown {
  const E = ECONOMY;
  const priceFactor = clamp(E.price.base - E.price.perEuro * ticketPrice, E.price.min, E.price.max);
  const potential = Math.round(scenario.maxVisitors * priceFactor * base.lineupFactor * base.reputationFactor);
  const visitors = clamp(potential, E.minVisitors, scenario.maxVisitors);
  return { ...base, ticketPrice, priceFactor, potential, visitors, soldOut: potential >= scenario.maxVisitors };
}

/** Ticketprijs (stappen van € 5) met de hoogste ticketomzet, los van verkoop op het terrein. */
export function bestTicketPrice(base: DemandBreakdown, scenario: ScenarioSettings): DemandBreakdown {
  let best = demandAtPrice(base, scenario, ECONOMY.ticketPrice.min);
  for (let p = ECONOMY.ticketPrice.min; p <= ECONOMY.ticketPrice.max; p += 5) {
    const d = demandAtPrice(base, scenario, p);
    if (d.visitors * p > best.visitors * best.ticketPrice) best = d;
  }
  return best;
}

/** Vaste kosten van een editie: huur voorzieningen + paden + gages. */
export function fixedCosts(layout: FestivalLayout, program: Program, scenario: ScenarioSettings): number {
  return computeSpent(layout, scenario) + programCost(program);
}

export interface SalesTotals {
  /** Verkochte eenheden per product. */
  units: Record<ProductType, number>;
}

export interface EditionFinance {
  capitalStart: number;
  ticketPrice: number;
  visitors: number;
  fixedCostLines: BudgetLine[];
  fixedCosts: number;
  revenue: { tickets: number } & Record<ProductType, number>;
  units: Record<ProductType, number>;
  purchaseCosts: number;
  revenueTotal: number;
  costsTotal: number;
  result: number;
  capitalEnd: number;
}

export function settleEdition(
  layout: FestivalLayout,
  program: Program,
  scenario: ScenarioSettings,
  capitalStart: number,
  ticketPrice: number,
  visitors: number,
  sales: SalesTotals,
): EditionFinance {
  const fixedCostLines = costBreakdown(layout, scenario, program);
  const fixed = fixedCosts(layout, program, scenario);
  const revenue = {
    tickets: visitors * ticketPrice,
    food: sales.units.food * PRODUCTS.food.price,
    bar: sales.units.bar * PRODUCTS.bar.price,
    merch: sales.units.merch * PRODUCTS.merch.price,
  };
  const purchaseCosts =
    sales.units.food * PRODUCTS.food.purchase + sales.units.bar * PRODUCTS.bar.purchase + sales.units.merch * PRODUCTS.merch.purchase;
  const revenueTotal = revenue.tickets + revenue.food + revenue.bar + revenue.merch;
  const costsTotal = fixed + purchaseCosts;
  const result = revenueTotal - costsTotal;
  return {
    capitalStart,
    ticketPrice,
    visitors,
    fixedCostLines,
    fixedCosts: fixed,
    revenue,
    units: { ...sales.units },
    purchaseCosts,
    revenueTotal,
    costsTotal,
    result,
    capitalEnd: capitalStart + result,
  };
}
