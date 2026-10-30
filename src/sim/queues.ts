import { hasQueue } from '../model/catalog';
import type { FacilityRuntime, SimulationState, Visitor } from './types';

/** Bezoeker sluit achteraan aan bij de wachtrij op de toegangstegel. */
export function joinQueue(s: SimulationState, fac: FacilityRuntime, v: Visitor): void {
  fac.queue.push(v.id);
  v.state = 'Queuing';
  v.queueEnterTick = s.tick;
  const stats = s.metrics.facility[fac.id];
  stats.maxQueue = Math.max(stats.maxQueue, fac.queue.length);
}

/** Verwijdert de bezoeker uit wachtrij, bediening en zitplaatsen van zijn huidige doel. */
export function removeFromFacility(s: SimulationState, v: Visitor): void {
  const id = v.goal?.facilityId;
  if (!id) return;
  const fac = s.facilities[id];
  if (!fac) return;
  const qi = fac.queue.indexOf(v.id);
  if (qi >= 0) fac.queue.splice(qi, 1);
  const si = fac.serving.findIndex((x) => x.visitorId === v.id);
  if (si >= 0) fac.serving.splice(si, 1);
  const oi = fac.occupants.indexOf(v.id);
  if (oi >= 0) fac.occupants.splice(oi, 1);
}

/**
 * Eén tick wachtrijlogica voor alle voorzieningen met een wachtrij (eten, bar, toilet, merchandise):
 * 1. bediening aftellen, klaar → `onServed`;
 * 2. vrije plekken vullen vanaf de voorkant van de rij.
 */
export function updateQueues(
  s: SimulationState,
  onServed: (v: Visitor, fac: FacilityRuntime) => void,
): void {
  for (const id of s.facilityOrder) {
    const fac = s.facilities[id];
    if (!hasQueue(fac.type)) continue;
    const done: number[] = [];
    for (const slot of fac.serving) {
      slot.remaining -= 1;
      if (slot.remaining <= 0) done.push(slot.visitorId);
    }
    const stats = s.metrics.facility[id];
    if (done.length > 0) {
      fac.serving = fac.serving.filter((slot) => slot.remaining > 0);
      stats.completed += done.length;
      for (const vid of done) onServed(s.visitors[vid], fac);
    }
    while (fac.serving.length < fac.capacity && fac.queue.length > 0) {
      const vid = fac.queue.shift()!;
      const v = s.visitors[vid];
      fac.serving.push({ visitorId: vid, remaining: fac.serviceTicks });
      v.state = 'BeingServed';
      stats.served += 1;
      stats.totalWaitTicks += s.tick - v.queueEnterTick;
    }
  }
}
