// Festivalreeks: opeenvolgende edities van hetzelfde festival. Het kapitaal na een editie
// is het budget van de volgende; het ontwerp schuift door als startpunt.

import { ECONOMY } from '../model/economy';
import type { FestivalLayout, Program, ScenarioSettings } from '../model/types';
import type { FinalReport } from '../sim/types';

export interface EditionDraft {
  layout: FestivalLayout;
  program: Program;
  ticketPrice: number;
  seed: number;
}

export interface EditionRecord {
  number: number;
  /** ISO-tijdstip van afronden (alleen administratie, geen invloed op de simulatie). */
  completedAt: string;
  seed: number;
  ticketPrice: number;
  layout: FestivalLayout;
  program: Program;
  report: FinalReport;
}

export interface Campaign {
  version: 2;
  name: string;
  scenarioId: string;
  startCapital: number;
  editions: EditionRecord[];
  draft: EditionDraft;
}

export function createCampaign(name: string, scenario: ScenarioSettings, draft: Omit<EditionDraft, 'ticketPrice'> & { ticketPrice?: number }): Campaign {
  return {
    version: 2,
    name,
    scenarioId: scenario.id,
    startCapital: scenario.startCapital,
    editions: [],
    draft: { ...draft, ticketPrice: draft.ticketPrice ?? ECONOMY.ticketPrice.default },
  };
}

export function lastEdition(c: Campaign): EditionRecord | null {
  return c.editions.length ? c.editions[c.editions.length - 1] : null;
}

/** Kapitaal dat beschikbaar is voor de volgende editie. */
export function currentCapital(c: Campaign): number {
  return lastEdition(c)?.report.finance.capitalEnd ?? c.startCapital;
}

export function nextEditionNumber(c: Campaign): number {
  return c.editions.length + 1;
}

/** Tevredenheid van de vorige editie, voor de reputatiefactor. Null bij editie 1. */
export function previousSatisfaction(c: Campaign): number | null {
  return lastEdition(c)?.report.avgSatisfaction ?? null;
}

export function isBankrupt(c: Campaign): boolean {
  return currentCapital(c) <= 0;
}

/** Legt een afgeronde run vast als nieuwe editie. Het concept blijft staan als basis voor de volgende. */
export function recordEdition(c: Campaign, draft: EditionDraft, report: FinalReport, completedAt: string): Campaign {
  const record: EditionRecord = {
    number: nextEditionNumber(c),
    completedAt,
    seed: draft.seed,
    ticketPrice: draft.ticketPrice,
    layout: draft.layout,
    program: draft.program,
    report,
  };
  return { ...c, editions: [...c.editions, record] };
}

export type KpiDirection = 'higher' | 'lower';

export interface Kpi {
  key: string;
  label: string;
  value: number;
  format: 'euro' | 'number' | 'minutes' | 'percent';
  better: KpiDirection;
}

/** Gewogen gemiddelde wachttijd over alle voorzieningen met een wachtrij. */
export function averageWait(r: FinalReport): number {
  let total = 0;
  let count = 0;
  for (const f of r.facilities) {
    if (f.avgWaitMinutes === null) continue;
    total += f.avgWaitMinutes * f.served;
    count += f.served;
  }
  return count ? total / count : 0;
}

export function editionKpis(r: FinalReport): Kpi[] {
  const responses = r.incidents.filter((i) => i.avgResponseMinutes !== null);
  const handled = r.incidents.reduce((a, i) => a + i.handled, 0);
  const respAvg = handled
    ? r.incidents.reduce((a, i) => a + (i.avgResponseMinutes ?? 0) * i.handled, 0) / handled
    : 0;
  return [
    { key: 'result', label: 'Resultaat', value: r.finance.result, format: 'euro', better: 'higher' },
    { key: 'capital', label: 'Kapitaal na afloop', value: r.finance.capitalEnd, format: 'euro', better: 'higher' },
    { key: 'revenue', label: 'Omzet', value: r.finance.revenueTotal, format: 'euro', better: 'higher' },
    { key: 'costs', label: 'Kosten', value: r.finance.costsTotal, format: 'euro', better: 'lower' },
    { key: 'visitors', label: 'Bezoekers', value: r.visitorCount, format: 'number', better: 'higher' },
    { key: 'ticket', label: 'Ticketprijs', value: r.finance.ticketPrice, format: 'euro', better: 'higher' },
    { key: 'satisfaction', label: 'Tevredenheid', value: r.avgSatisfaction, format: 'number', better: 'higher' },
    { key: 'wait', label: 'Gem. wachttijd', value: averageWait(r), format: 'minutes', better: 'lower' },
    { key: 'unhandled', label: 'Niet geholpen meldingen', value: r.incidents.reduce((a, i) => a + i.unhandled, 0), format: 'number', better: 'lower' },
    { key: 'response', label: 'Gem. aanlooptijd hulp', value: responses.length ? respAvg : 0, format: 'minutes', better: 'lower' },
    { key: 'leftEarly', label: 'Vroeg vertrokken', value: r.leftEarly, format: 'number', better: 'lower' },
  ];
}

export interface KpiDelta extends Kpi {
  previous: number | null;
  delta: number | null;
  /** true = beter, false = slechter, null = gelijk of geen vergelijking. */
  improved: boolean | null;
}

export function compareKpis(current: FinalReport, previous: FinalReport | null): KpiDelta[] {
  const prev = previous ? editionKpis(previous) : null;
  return editionKpis(current).map((k, i) => {
    const p = prev ? prev[i].value : null;
    const delta = p === null ? null : k.value - p;
    const eps = k.format === 'euro' ? 0.5 : 0.05;
    const improved = delta === null || Math.abs(delta) < eps ? null : k.better === 'higher' ? delta > 0 : delta < 0;
    return { ...k, previous: p, delta, improved };
  });
}
