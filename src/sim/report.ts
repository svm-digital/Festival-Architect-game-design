import { costBreakdown, computeSpent } from '../model/budget';
import { FACILITY_DEFS, formatDecimal, formatEuro, getAct } from '../model/catalog';
import { centerTile, tilePoint } from '../model/grid';
import { designSignature } from '../model/layout';
import { formatClock, slotLabel, TICKS_PER_MINUTE } from './clock';
import { RULES } from './rules';
import type { FinalReport, NeedKind, ReportFacility, ReportPeak, ReportStage, SimulationState } from './types';

const NEED_LABEL: Record<NeedKind, string> = { food: 'eetkraam', toilet: 'toilet', seating: 'zitplek' };

function nearestFacilityName(s: SimulationState, tile: number): string {
  const p = tilePoint(s.walk, tile);
  let best = 'open terrein';
  let bestD = Infinity;
  for (const f of s.input.layout.facilities) {
    const c = centerTile(f);
    const d = Math.abs(c.x - p.x) + Math.abs(c.y - p.y);
    if (d < bestD) {
      bestD = d;
      best = f.name;
    }
  }
  return best;
}

export function buildReport(s: SimulationState): FinalReport {
  const { layout, program, scenario, seed } = s.input;
  const samples = s.metrics.samples;
  const arrived = s.visitors.filter((v) => v.phase !== 'pending');
  const avgSatisfaction = arrived.length ? arrived.reduce((a, v) => a + v.satisfaction, 0) / arrived.length : 0;

  // Voorzieningen
  const facilities: ReportFacility[] = [];
  for (const id of s.facilityOrder) {
    const fac = s.facilities[id];
    if (fac.type === 'stage') continue;
    const st = s.metrics.facility[id];
    const uses = fac.type === 'seating' ? st.uses : st.served;
    facilities.push({
      id,
      name: fac.name,
      type: fac.type,
      reachable: fac.reachable,
      served: uses,
      abandoned: st.abandoned,
      avgWaitMinutes: fac.type === 'seating' || st.served === 0 ? null : st.totalWaitTicks / st.served / TICKS_PER_MINUTE,
      maxQueue: st.maxQueue,
      turnedAway: st.turnedAway,
      underused: false,
    });
  }
  for (const f of facilities) {
    if (!f.reachable) continue;
    const same = facilities.filter((o) => o.type === f.type && o.reachable);
    const avg = same.reduce((a, o) => a + o.served, 0) / same.length;
    f.underused = f.served === 0 || (same.length >= 2 && f.served < 0.3 * avg);
  }

  // Podia
  const stages: ReportStage[] = s.stageIds.map((id) => {
    const fac = s.facilities[id];
    const series = samples.map((sm) => sm.watching[id] ?? 0);
    const performances = program.performances
      .filter((p) => p.stageId === id)
      .sort((a, b) => a.slot - b.slot)
      .map((p) => {
        const sl = scenario.slots[p.slot];
        const inSlot = samples.filter((sm) => sm.minute >= sl.startMinute && sm.minute < sl.endMinute).map((sm) => sm.watching[id] ?? 0);
        const act = getAct(p.actId);
        return {
          slot: p.slot,
          actName: act?.name ?? p.actId,
          genre: act?.genre ?? 'pop',
          popularity: act?.popularity ?? 0,
          peakAudience: inSlot.length ? Math.max(...inSlot) : 0,
          avgAudience: inSlot.length ? inSlot.reduce((a, b) => a + b, 0) / inSlot.length : 0,
        };
      });
    return {
      id,
      name: fac.name,
      reachable: fac.reachable,
      watchMinutes: s.metrics.stageWatchMinutes[id] ?? 0,
      peakAudience: series.length ? Math.max(...series) : 0,
      performances,
    };
  });
  const popular = [...stages].sort((a, b) => b.watchMinutes - a.watchMinutes)[0];
  const popularStageId = popular && popular.watchMinutes > 0 ? popular.id : null;

  // Drukste momenten (min. 15 minuten uit elkaar)
  const peaks: ReportPeak[] = [];
  const sorted = [...samples].sort((a, b) => b.peakCount - a.peakCount || a.minute - b.minute);
  for (const sm of sorted) {
    if (peaks.length >= 3 || sm.peakCount === 0) break;
    if (peaks.some((p) => Math.abs(p.minute - sm.minute) < 15)) continue;
    peaks.push({
      minute: sm.minute,
      clock: formatClock(scenario, sm.minute),
      count: sm.peakCount,
      tile: sm.peakTile,
      near: nearestFacilityName(s, sm.peakTile) + (sm.minute >= scenario.festivalMinutes ? ' (uitstroom)' : ''),
    });
  }
  peaks.sort((a, b) => a.minute - b.minute);

  const noGoal: Record<NeedKind, number> = {
    food: s.metrics.noGoalVisitors.food.length,
    toilet: s.metrics.noGoalVisitors.toilet.length,
    seating: s.metrics.noGoalVisitors.seating.length,
  };
  const walkTotal = s.metrics.walkTicksPath + s.metrics.walkTicksGrass;
  const grassShare = walkTotal > 0 ? s.metrics.walkTicksGrass / walkTotal : 0;
  const spent = computeSpent(layout, scenario);
  const budget = { budget: scenario.budget, spent, remaining: scenario.budget - spent, lines: costBreakdown(layout, scenario) };
  const leftEarly = s.visitors.filter((v) => v.leftEarly).length;

  const report: FinalReport = {
    version: 1,
    signature: designSignature(layout, program, seed, s.visitors.length),
    seed,
    visitorCount: s.visitors.length,
    avgSatisfaction,
    leftEarly,
    stillOnSiteAtEnd: s.visitors.filter((v) => v.phase === 'onSite').length,
    facilities,
    stages,
    popularStageId,
    peaks,
    noGoal,
    grassShare,
    budget,
    advice: [],
    heat: Array.from(s.metrics.heat, (h) => Math.round(h * 10) / 10),
    timeline: samples.map((sm) => ({ minute: sm.minute, onSite: sm.onSite, avgSatisfaction: Math.round(sm.avgSatisfaction * 10) / 10 })),
  };
  report.advice = buildAdvice(s, report);
  return report;
}

/** Regelgebaseerde verbeterpunten. Elk punt verwijst naar een concrete voorziening of meting. */
function buildAdvice(s: SimulationState, r: FinalReport): string[] {
  const { scenario } = s.input;
  const out: string[] = [];
  const n = r.visitorCount;

  for (const f of s.input.layout.facilities) {
    const reach = s.analysis.facilities[f.id];
    if (f.type !== 'entrance' && !reach.reachable) out.push(`${f.name} was niet bereikbaar en is daardoor niet gebruikt. ${reach.explanation ?? ''}`.trim());
  }

  for (const f of r.facilities) {
    if (f.type === 'seating' || !f.reachable) continue;
    const label = FACILITY_DEFS[f.type].label.toLowerCase();
    if ((f.avgWaitMinutes ?? 0) >= 5 || f.abandoned > 0) {
      const cost = FACILITY_DEFS[f.type].cost;
      const money =
        r.budget.remaining >= cost
          ? `Er is nog ${formatEuro(r.budget.remaining)} budget; een extra ${label} kost ${formatEuro(cost)}.`
          : `Een extra ${label} kost ${formatEuro(cost)}; er is nog ${formatEuro(r.budget.remaining)}. Maak budget vrij, bijvoorbeeld door overbodige paden of een onderbenutte voorziening te verwijderen.`;
      out.push(
        `Bij ${f.name} wachtten bezoekers gemiddeld ${formatDecimal(f.avgWaitMinutes ?? 0)} min (langste rij ${f.maxQueue}` +
          `${f.abandoned > 0 ? `, ${f.abandoned} haakten af na ${RULES.queue.maxWaitMinutes} min` : ''}). Een extra ${label} op een andere plek spreidt de vraag. ${money}`,
      );
    }
  }

  for (const kind of ['toilet', 'food', 'seating'] as NeedKind[]) {
    const count = r.noGoal[kind];
    if (count > 0) {
      out.push(`${count} bezoekers wilden een ${NEED_LABEL[kind]} maar vonden er geen bereikbare (vrije) ${kind === 'seating' ? 'plek' : 'voorziening'}.`);
    }
  }

  for (const f of r.facilities) {
    if (f.type === 'seating' && f.turnedAway >= 5) {
      out.push(`${f.name} was ${f.turnedAway} keer vol bij aankomst. Een extra zitgebied (${formatEuro(FACILITY_DEFS.seating.cost)}) helpt vermoeide bezoekers.`);
    }
    if (f.underused) {
      out.push(`${f.name} werd weinig gebruikt (${f.served}×). Verplaats het dichter bij de looproutes of verwijder het om budget vrij te maken.`);
    }
  }

  for (const st of r.stages) {
    for (const p of st.performances) {
      if (p.avgAudience < n * 0.12) {
        out.push(
          `${st.name} trok tijdens ${slotLabel(scenario, p.slot)} gemiddeld ${p.avgAudience.toFixed(0)} kijkers (${p.actName}, populariteit ${p.popularity}). ` +
            `Een act met hogere populariteit of een ander genre kan meer publiek trekken.`,
        );
      }
    }
  }

  if (r.grassShare > 0.45) {
    out.push(
      `${Math.round(r.grassShare * 100)}% van de looptijd ging over gras, dat langzamer loopt. Extra paden tussen ingang, podia en voorzieningen verkorten looptijden.`,
    );
  }

  const top = [...r.peaks].sort((a, b) => b.count - a.count)[0];
  if (top && top.count >= Math.max(20, n * 0.15)) {
    out.push(
      `Drukste moment volgens het spelmodel: ${top.clock} bij ${top.near} (${top.count} bezoekers binnen 3×3 tegels). Voorzieningen verder uit elkaar zetten verdeelt de drukte.`,
    );
  }

  if (r.leftEarly > 0) out.push(`${r.leftEarly} bezoekers vertrokken vroegtijdig omdat hun tevredenheid te laag werd.`);

  if (out.length === 0) {
    out.push('Geen duidelijke knelpunten in dit spelmodel. Probeer een andere seed of meer bezoekers om het ontwerp verder te testen.');
  }
  return out;
}

export function reportMatches(report: FinalReport | null, signature: string): boolean {
  return report !== null && report.signature === signature;
}

export function tileLabel(width: number, tile: number): string {
  const p = tilePoint({ width }, tile);
  return `(${p.x}, ${p.y})`;
}

