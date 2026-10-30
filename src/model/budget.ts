import { actFee, FACILITY_DEFS, FACILITY_ORDER, getAct } from './catalog';
import type { FestivalLayout, Program, ScenarioSettings } from './types';

export function countPathTiles(layout: FestivalLayout): number {
  let n = 0;
  for (const t of layout.grid.tiles) if (t === 'path') n++;
  return n;
}

/** Huur van voorzieningen en paden voor één editie. */
export function computeSpent(layout: FestivalLayout, scenario: ScenarioSettings): number {
  let total = countPathTiles(layout) * scenario.pathTileCost;
  for (const f of layout.facilities) total += FACILITY_DEFS[f.type].cost;
  return total;
}

/** Gages van alle geboekte acts. */
export function programCost(program: Program): number {
  let total = 0;
  for (const p of program.performances) {
    const act = getAct(p.actId);
    if (act) total += actFee(act);
  }
  return total;
}

export interface BudgetLine {
  label: string;
  count: number;
  unitCost: number;
  total: number;
}

/** Alle vaste kosten van een editie, per regel. */
export function costBreakdown(layout: FestivalLayout, scenario: ScenarioSettings, program?: Program): BudgetLine[] {
  const lines: BudgetLine[] = [];
  for (const type of FACILITY_ORDER) {
    const count = layout.facilities.filter((f) => f.type === type).length;
    if (count === 0) continue;
    const def = FACILITY_DEFS[type];
    lines.push({ label: def.label, count, unitCost: def.cost, total: count * def.cost });
  }
  const paths = countPathTiles(layout);
  if (paths > 0) {
    lines.push({ label: 'Padtegels', count: paths, unitCost: scenario.pathTileCost, total: paths * scenario.pathTileCost });
  }
  if (program && program.performances.length > 0) {
    const total = programCost(program);
    lines.push({ label: 'Gages acts', count: program.performances.length, unitCost: Math.round(total / program.performances.length), total });
  }
  return lines;
}
