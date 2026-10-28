import { FACILITY_DEFS, FACILITY_ORDER } from './catalog';
import type { FestivalLayout, ScenarioSettings } from './types';

export function countPathTiles(layout: FestivalLayout): number {
  let n = 0;
  for (const t of layout.grid.tiles) if (t === 'path') n++;
  return n;
}

export function computeSpent(layout: FestivalLayout, scenario: ScenarioSettings): number {
  let total = countPathTiles(layout) * scenario.pathTileCost;
  for (const f of layout.facilities) total += FACILITY_DEFS[f.type].cost;
  return total;
}

export interface BudgetLine {
  label: string;
  count: number;
  unitCost: number;
  total: number;
}

export function costBreakdown(layout: FestivalLayout, scenario: ScenarioSettings): BudgetLine[] {
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
  return lines;
}
