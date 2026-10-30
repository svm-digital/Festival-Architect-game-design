import { hasQueue, PRODUCTS } from '../model/catalog';
import { TICKS_PER_MINUTE } from './clock';
import type { FacilityStats, SimulationMetrics, SimulationState } from './types';

export function createMetrics(tileCount: number, facilityIds: string[], stageIds: string[]): SimulationMetrics {
  const facility: Record<string, FacilityStats> = {};
  for (const id of facilityIds) {
    facility[id] = { served: 0, completed: 0, abandoned: 0, totalWaitTicks: 0, maxQueue: 0, uses: 0, turnedAway: 0 };
  }
  const stageWatchMinutes: Record<string, number> = {};
  for (const id of stageIds) stageWatchMinutes[id] = 0;
  return {
    samples: [],
    heat: new Float32Array(tileCount),
    facility,
    noGoalVisitors: { food: [], drink: [], toilet: [], seating: [] },
    stageWatchMinutes,
    walkTicksPath: 0,
    walkTicksGrass: 0,
    sales: { food: 0, bar: 0, merch: 0 },
  };
}

/** Tegelbezetting op dit moment (aantal bezoekers per tegel). */
export function tileCounts(s: SimulationState): Uint16Array {
  const counts = new Uint16Array(s.walk.width * s.walk.height);
  for (const v of s.visitors) if (v.phase === 'onSite') counts[v.tile] += 1;
  return counts;
}

/** Eén sample per spelminuut. Drukte is uitsluitend een spelindicator. */
export function sampleMetrics(s: SimulationState): void {
  if (s.tick % TICKS_PER_MINUTE !== 0) return;
  const m = s.metrics;
  const counts = tileCounts(s);
  let onSite = 0;
  let satSum = 0;
  let noGoal = 0;
  const watching: Record<string, number> = {};
  for (const id of s.stageIds) watching[id] = 0;
  for (const v of s.visitors) {
    if (v.phase !== 'onSite') continue;
    onSite += 1;
    satSum += v.satisfaction;
    if (v.unmetNeeds.length > 0) noGoal += 1;
    if (v.state === 'Watching' && v.goal?.facilityId) watching[v.goal.facilityId] += 1;
  }
  const queues: Record<string, number> = {};
  for (const id of s.facilityOrder) {
    const fac = s.facilities[id];
    if (hasQueue(fac.type)) queues[id] = fac.queue.length;
  }
  for (let i = 0; i < counts.length; i++) m.heat[i] += counts[i];

  // Drukste 3×3-venster
  const W = s.walk.width;
  const H = s.walk.height;
  let peakCount = 0;
  let peakTile = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let sum = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= H) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= W) continue;
          sum += counts[yy * W + xx];
        }
      }
      if (sum > peakCount) {
        peakCount = sum;
        peakTile = y * W + x;
      }
    }
  }

  m.samples.push({
    minute: s.tick / TICKS_PER_MINUTE,
    onSite,
    avgSatisfaction: onSite > 0 ? satSum / onSite : 0,
    watching,
    queues,
    noGoal,
    openIncidents: s.incidents.filter((i) => i.outcome === 'open').length,
    revenue: revenueSoFar(s),
    peakCount,
    peakTile,
  });
}

/** Omzet tot nu toe: tickets van gearriveerde bezoekers plus verkoop. */
export function revenueSoFar(s: SimulationState): number {
  let arrived = 0;
  for (const v of s.visitors) if (v.phase !== 'pending') arrived++;
  const sales = s.metrics.sales;
  return (
    arrived * s.input.demand.ticketPrice +
    sales.food * PRODUCTS.food.price +
    sales.bar * PRODUCTS.bar.price +
    sales.merch * PRODUCTS.merch.price
  );
}
