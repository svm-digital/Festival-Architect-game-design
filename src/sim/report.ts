import { actFee, FACILITY_DEFS, formatDecimal, formatEuro, getAct, hasQueue, isPost, PRODUCTS, lowerLabel } from '../model/catalog';
import { bestTicketPrice, demandAtPrice, settleEdition } from '../model/economy';
import { centerTile, tilePoint } from '../model/grid';
import { designSignature } from '../model/layout';
import type { PostType } from '../model/types';
import { formatClock, slotLabel, TICKS_PER_MINUTE } from './clock';
import { RULES } from './rules';
import {
  INCIDENT_POST,
  type FinalReport,
  type IncidentKind,
  type NeedKind,
  type ReportFacility,
  type ReportIncidents,
  type ReportPeak,
  type ReportPost,
  type ReportStage,
  type SimulationState,
} from './types';

const NEED_LABEL: Record<NeedKind, string> = { food: 'eetkraam', drink: 'bar', toilet: 'toilet', seating: 'zitplek' };

export const INCIDENT_LABEL: Record<IncidentKind, string> = {
  medical: 'Medisch',
  conflict: 'Conflict',
  wellbeing: 'Welzijn',
};

const INCIDENT_PLURAL: Record<IncidentKind, string> = {
  medical: 'medische meldingen',
  conflict: 'conflictmeldingen',
  wellbeing: 'welzijnsmeldingen',
};

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
  const { layout, program, scenario, seed, demand } = s.input;
  const samples = s.metrics.samples;
  const arrived = s.visitors.filter((v) => v.phase !== 'pending');
  const avgSatisfaction = arrived.length ? arrived.reduce((a, v) => a + v.satisfaction, 0) / arrived.length : 0;

  // Voorzieningen met wachtrij of zitplaatsen
  const facilities: ReportFacility[] = [];
  for (const id of s.facilityOrder) {
    const fac = s.facilities[id];
    if (fac.type === 'stage' || isPost(fac.type)) continue;
    const st = s.metrics.facility[id];
    const uses = fac.type === 'seating' ? st.uses : st.served;
    const product = fac.type === 'food' || fac.type === 'bar' || fac.type === 'merch' ? PRODUCTS[fac.type] : null;
    facilities.push({
      id,
      name: fac.name,
      type: fac.type,
      reachable: fac.reachable,
      served: uses,
      abandoned: st.abandoned,
      avgWaitMinutes: !hasQueue(fac.type) || st.served === 0 ? null : st.totalWaitTicks / st.served / TICKS_PER_MINUTE,
      maxQueue: st.maxQueue,
      turnedAway: st.turnedAway,
      underused: false,
      revenue: product ? st.completed * product.price : 0,
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
        const inSlot = samples
          .filter((sm) => sm.minute >= sl.startMinute && sm.minute < sl.endMinute)
          .map((sm) => sm.watching[id] ?? 0);
        const act = getAct(p.actId);
        return {
          slot: p.slot,
          actName: act?.name ?? p.actId,
          genre: act?.genre ?? 'pop',
          popularity: act?.popularity ?? 0,
          fee: act ? actFee(act) : 0,
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

  // Incidenten per soort
  const incidents: ReportIncidents[] = (['medical', 'conflict', 'wellbeing'] as IncidentKind[]).map((kind) => {
    const list = s.incidents.filter((i) => i.kind === kind);
    const responses = list.filter((i) => i.arrivedTick !== null).map((i) => (i.arrivedTick! - i.createdTick) / TICKS_PER_MINUTE);
    const unhandled = list.filter((i) => i.outcome === 'unhandled');
    let worst = unhandled[0] ?? null;
    if (!worst && responses.length) {
      worst = list.filter((i) => i.arrivedTick !== null).sort((a, b) => b.arrivedTick! - b.createdTick - (a.arrivedTick! - a.createdTick))[0];
    }
    return {
      kind,
      total: list.length,
      handled: list.filter((i) => i.outcome === 'handled').length,
      unhandled: unhandled.length,
      avgResponseMinutes: responses.length ? responses.reduce((a, b) => a + b, 0) / responses.length : null,
      maxResponseMinutes: responses.length ? Math.max(...responses) : null,
      worstNear: worst ? nearestFacilityName(s, worst.tile) : null,
    };
  });

  const festivalTicks = s.festivalEndTick;
  const posts: ReportPost[] = s.facilityOrder
    .map((id) => s.facilities[id])
    .filter((f) => isPost(f.type))
    .map((f) => {
      const members = f.staffIds.map((sid) => s.staff[sid]);
      return {
        id: f.id,
        name: f.name,
        type: f.type as PostType,
        reachable: f.reachable,
        handled: s.incidents.filter((i) => i.staffId !== null && members.some((m) => m.id === i.staffId) && i.outcome === 'handled').length,
        utilization: members.length ? members.reduce((a, m) => a + m.busyTicks, 0) / (members.length * festivalTicks) : 0,
      };
    });

  const noGoal: Record<NeedKind, number> = {
    food: s.metrics.noGoalVisitors.food.length,
    drink: s.metrics.noGoalVisitors.drink.length,
    toilet: s.metrics.noGoalVisitors.toilet.length,
    seating: s.metrics.noGoalVisitors.seating.length,
  };
  const walkTotal = s.metrics.walkTicksPath + s.metrics.walkTicksGrass;
  const grassShare = walkTotal > 0 ? s.metrics.walkTicksGrass / walkTotal : 0;
  const finance = settleEdition(layout, program, scenario, s.input.capitalStart, demand.ticketPrice, s.visitors.length, {
    units: { ...s.metrics.sales },
  });
  const leftEarly = s.visitors.filter((v) => v.leftEarly).length;

  const report: FinalReport = {
    version: 2,
    signature: designSignature(layout, program, seed, s.visitors.length, demand.ticketPrice),
    seed,
    visitorCount: s.visitors.length,
    demand,
    avgSatisfaction,
    leftEarly,
    stillOnSiteAtEnd: s.visitors.filter((v) => v.phase === 'onSite').length,
    facilities,
    stages,
    popularStageId,
    peaks,
    noGoal,
    incidents,
    posts,
    grassShare,
    finance,
    advice: [],
    heat: Array.from(s.metrics.heat, (h) => Math.round(h * 10) / 10),
    timeline: samples.map((sm) => ({
      minute: sm.minute,
      onSite: sm.onSite,
      avgSatisfaction: Math.round(sm.avgSatisfaction * 10) / 10,
      revenue: sm.revenue,
    })),
  };
  report.advice = buildAdvice(s, report);
  return report;
}

/** Regelgebaseerde verbeterpunten. Elk punt verwijst naar een concrete voorziening, meting of bedrag. */
function buildAdvice(s: SimulationState, r: FinalReport): string[] {
  const { scenario } = s.input;
  const out: string[] = [];
  const n = r.visitorCount;
  const fin = r.finance;

  // Geld
  if (fin.result < 0) {
    const biggest = [...fin.fixedCostLines].sort((a, b) => b.total - a.total)[0];
    out.push(
      `Deze editie leverde ${formatEuro(-fin.result)} verlies op. Grootste kostenpost: ${biggest.label.toLowerCase()} (${formatEuro(biggest.total)}).`,
    );
  }
  const best = bestTicketPrice(r.demand, scenario);
  const now = r.demand;
  if (best.ticketPrice !== now.ticketPrice) {
    const diff = best.visitors * best.ticketPrice - now.visitors * now.ticketPrice;
    if (diff > 0) {
      out.push(
        `Ticketprijs: bij ${formatEuro(best.ticketPrice)} waren er volgens de vraagregel ${best.visitors} bezoekers gekomen ` +
          `(nu ${now.visitors} bij ${formatEuro(now.ticketPrice)}); dat is ${formatEuro(diff)} meer ticketomzet. ` +
          `Minder bezoekers betekent wel minder verkoop op het terrein.`,
      );
    }
  }
  if (now.soldOut) {
    const up = demandAtPrice(now, scenario, now.ticketPrice + 5);
    if (up.soldOut) out.push(`Uitverkocht, ook bij ${formatEuro(now.ticketPrice + 5)} was het terrein vol geweest.`);
  }

  for (const f of s.input.layout.facilities) {
    const reach = s.analysis.facilities[f.id];
    if (f.type !== 'entrance' && !reach.reachable) {
      out.push(`${f.name} was niet bereikbaar en is daardoor niet gebruikt. ${reach.explanation ?? ''}`.trim());
    }
  }

  // Wachtrijen
  for (const f of r.facilities) {
    if (!hasQueue(f.type) || !f.reachable) continue;
    const label = lowerLabel(f.type);
    if ((f.avgWaitMinutes ?? 0) >= 5 || f.abandoned > 0) {
      out.push(
        `Bij ${f.name} wachtten bezoekers gemiddeld ${formatDecimal(f.avgWaitMinutes ?? 0)} min (langste rij ${f.maxQueue}` +
          `${f.abandoned > 0 ? `, ${f.abandoned} haakten af na ${RULES.queue.maxWaitMinutes} min` : ''}). ` +
          `Een extra ${label} (${formatEuro(FACILITY_DEFS[f.type].cost)} per editie) op een andere plek spreidt de vraag.`,
      );
    }
  }

  for (const kind of ['drink', 'toilet', 'food', 'seating'] as NeedKind[]) {
    const count = r.noGoal[kind];
    if (count > 0) {
      out.push(`${count} bezoekers wilden een ${NEED_LABEL[kind]} maar vonden er geen bereikbare (vrije) ${kind === 'seating' ? 'plek' : 'voorziening'}.`);
    }
  }

  for (const f of r.facilities) {
    if (f.type === 'seating' && f.turnedAway >= 5) {
      out.push(`${f.name} was ${f.turnedAway} keer vol bij aankomst. Een extra zitgebied kost ${formatEuro(FACILITY_DEFS.seating.cost)} per editie.`);
    }
    if (f.underused) {
      out.push(
        `${f.name} werd weinig gebruikt (${f.served}×) en kost ${formatEuro(FACILITY_DEFS[f.type].cost)} per editie. ` +
          `Verplaats het dichter bij de looproutes of laat het weg.`,
      );
    }
  }

  // Zorg en veiligheid
  for (const inc of r.incidents) {
    if (inc.total === 0) continue;
    const postType = INCIDENT_POST[inc.kind];
    const postLabel = lowerLabel(postType);
    const hasPost = r.posts.some((p) => p.type === postType && p.reachable);
    if (inc.unhandled > 0) {
      out.push(
        `${inc.unhandled} van ${inc.total} ${INCIDENT_PLURAL[inc.kind]} werden niet geholpen ` +
          (hasPost
            ? `omdat er ${RULES.incidents.maxWaitMinutes} minuten lang geen medewerker vrij was`
            : `omdat er geen bereikbare ${postLabel} was`) +
          `${inc.worstNear ? ` (o.a. bij ${inc.worstNear})` : ''}. Een ${hasPost ? 'extra ' : ''}${postLabel} kost ${formatEuro(FACILITY_DEFS[postType].cost)} per editie.`,
      );
    } else if ((inc.avgResponseMinutes ?? 0) > RULES.incidents.satisfaction.fastWithin) {
      out.push(
        `${INCIDENT_LABEL[inc.kind]}: gemiddeld ${formatDecimal(inc.avgResponseMinutes ?? 0)} min voordat hulp er was` +
          `${inc.worstNear ? `, het langst bij ${inc.worstNear}` : ''}. Een ${postLabel} dichter bij die plek verkort de aanlooptijd.`,
      );
    }
  }
  for (const p of r.posts) {
    if (p.utilization > 0.4) out.push(`De medewerkers van ${p.name} waren ${Math.round(p.utilization * 100)}% van de tijd bezet.`);
  }

  // Programma
  for (const st of r.stages) {
    for (const p of st.performances) {
      if (p.avgAudience < n * 0.12) {
        out.push(
          `${st.name} trok tijdens ${slotLabel(scenario, p.slot)} gemiddeld ${p.avgAudience.toFixed(0)} kijkers (${p.actName}, populariteit ${p.popularity}, gage ${formatEuro(p.fee)}). ` +
            `Een act met hogere populariteit of een ander genre kan meer publiek trekken.`,
        );
      }
    }
  }

  if (r.grassShare > 0.45) {
    out.push(
      `${Math.round(r.grassShare * 100)}% van de looptijd ging over gras, dat langzamer loopt. Extra paden (${formatEuro(scenario.pathTileCost)} per tegel) verkorten looptijden.`,
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
    out.push('Geen duidelijke knelpunten in dit spelmodel. Probeer een hogere ticketprijs, een andere line-up of een andere seed.');
  }
  return out;
}

export function reportMatches(report: FinalReport | null, signature: string): boolean {
  return report !== null && report.signature === signature;
}
