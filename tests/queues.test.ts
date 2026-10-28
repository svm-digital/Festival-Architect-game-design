import { describe, expect, it } from 'vitest';
import { joinQueue, removeFromFacility, updateQueues } from '../src/sim/queues';
import { createSimulation } from '../src/sim/simulation';
import type { FacilityRuntime, SimulationState, Visitor } from '../src/sim/types';
import { exampleInput } from './helpers';

function setup(): { s: SimulationState; fac: FacilityRuntime; vs: Visitor[] } {
  const s = createSimulation(exampleInput());
  const fac = Object.values(s.facilities).find((f) => f.type === 'food')!;
  const vs = s.visitors.slice(0, 5);
  for (const v of vs) {
    v.phase = 'onSite';
    v.goal = { kind: 'food', facilityId: fac.id, tile: fac.accessTile };
    joinQueue(s, fac, v);
  }
  return { s, fac, vs };
}

describe('wachtrijen (acceptatiecriterium 4)', () => {
  it('bedient FIFO en respecteert de capaciteit', () => {
    const { s, fac, vs } = setup();
    expect(fac.capacity).toBe(2);
    updateQueues(s, () => undefined);
    expect(fac.serving.map((x) => x.visitorId)).toEqual([vs[0].id, vs[1].id]);
    expect(fac.queue).toEqual([vs[2].id, vs[3].id, vs[4].id]);
    expect(vs[0].state).toBe('BeingServed');
    expect(vs[2].state).toBe('Queuing');
  });

  it('rondt bediening af na de vaste servicetijd en schuift door', () => {
    const { s, fac, vs } = setup();
    const done: number[] = [];
    updateQueues(s, (v) => done.push(v.id)); // tick 0: 0 en 1 starten
    for (let t = 1; t < fac.serviceTicks; t++) {
      s.tick = t;
      updateQueues(s, (v) => done.push(v.id));
    }
    expect(done).toEqual([]);
    s.tick = fac.serviceTicks;
    updateQueues(s, (v) => done.push(v.id));
    expect(done).toEqual([vs[0].id, vs[1].id]);
    expect(fac.serving.map((x) => x.visitorId)).toEqual([vs[2].id, vs[3].id]);
    expect(s.metrics.facility[fac.id].totalWaitTicks).toBe(2 * fac.serviceTicks);
  });

  it('verwijdert vertrekkende bezoekers uit rij en bediening', () => {
    const { s, fac, vs } = setup();
    updateQueues(s, () => undefined);
    removeFromFacility(s, vs[3]);
    removeFromFacility(s, vs[0]);
    expect(fac.queue).toEqual([vs[2].id, vs[4].id]);
    expect(fac.serving.map((x) => x.visitorId)).toEqual([vs[1].id]);
    updateQueues(s, () => undefined);
    expect(fac.serving.map((x) => x.visitorId)).toEqual([vs[1].id, vs[2].id]);
  });
});
