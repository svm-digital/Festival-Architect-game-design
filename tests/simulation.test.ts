import { describe, expect, it } from 'vitest';
import { audienceZone, tileIndex } from '../src/model/grid';
import { removeFacility } from '../src/model/layout';
import { buildReport } from '../src/sim/report';
import { createSimulation, hashState, runToEnd, SimulationSetupError, step } from '../src/sim/simulation';
import type { SimulationState } from '../src/sim/types';
import { blankLayout, exampleInput, place, S } from './helpers';

/** Controleert per tick alle invarianten van routes en wachtrijen. Gooit bij de eerste overtreding. */
function checkInvariants(s: SimulationState, lastTile: Map<number, number>) {
  const fail = (msg: string) => {
    throw new Error(`tick ${s.tick}: ${msg}`);
  };
  const W = s.walk.width;
  const memberships = new Map<number, number>();
  const add = (vid: number) => memberships.set(vid, (memberships.get(vid) ?? 0) + 1);
  for (const id of s.facilityOrder) {
    const fac = s.facilities[id];
    if (fac.serving.length > fac.capacity) fail(`${fac.name} bedient boven capaciteit`);
    if (fac.type === 'seating' && fac.occupants.length > fac.capacity) fail(`${fac.name} is overvol`);
    for (const vid of fac.queue) {
      const v = s.visitors[vid];
      if (v.phase !== 'onSite' || v.state !== 'Queuing') fail(`bezoeker ${vid} staat in rij maar is ${v.phase}/${v.state}`);
      if (v.goal?.facilityId !== id) fail(`bezoeker ${vid} staat in de verkeerde rij`);
      if (v.tile !== fac.accessTile) fail(`bezoeker ${vid} staat in rij buiten de toegangstegel`);
      add(vid);
    }
    for (const slot of fac.serving) {
      const v = s.visitors[slot.visitorId];
      if (v.phase !== 'onSite') fail(`vertrokken bezoeker ${v.id} wordt nog bediend`);
      add(v.id);
    }
    for (const vid of fac.occupants) add(vid);
  }
  for (const [vid, n] of memberships) if (n !== 1) fail(`bezoeker ${vid} zit in ${n} rijen/bedieningen`);
  for (const v of s.visitors) {
    if (v.phase !== 'onSite') continue;
    if (v.tile === s.gateTile) {
      if (v.state !== 'Entering' && v.state !== 'Leaving') fail(`bezoeker ${v.id} staat in de poort als ${v.state}`);
    } else if (!s.walk.walkable[v.tile]) fail(`bezoeker ${v.id} staat op niet-begaanbare tegel ${v.tile}`);
    const prev = lastTile.get(v.id);
    if (prev !== undefined && prev !== v.tile) {
      const d = Math.abs((prev % W) - (v.tile % W)) + Math.abs(Math.floor(prev / W) - Math.floor(v.tile / W));
      if (d !== 1) fail(`bezoeker ${v.id} sprong ${d} tegels`);
    }
    lastTile.set(v.id, v.tile);
  }
}

describe('simulatie', () => {
  it('één bezoeker loopt via een geldige route naar één podium en kijkt', () => {
    const input = exampleInput({ scenario: { ...S, visitorCount: 1 } });
    const s = createSimulation(input);
    const v = s.visitors[0];
    const lastTile = new Map<number, number>();
    while (!s.finished && v.state !== 'Watching') {
      step(s);
      checkInvariants(s, lastTile);
    }
    expect(v.state).toBe('Watching');
    expect(s.tick).toBeLessThan(s.festivalEndTick);
    const stage = input.layout.facilities.find((f) => f.id === v.goal!.facilityId)!;
    const zone = audienceZone(stage, input.layout.grid).map((p) => tileIndex(input.layout.grid, p.x, p.y));
    expect(zone).toContain(v.tile);
  });

  it('volledige run met 150 bezoekers: geldige routes, correcte wachtrijen, iedereen vertrekt (criteria 3, 4, 9)', () => {
    const s = createSimulation(exampleInput());
    expect(s.visitors).toHaveLength(150);
    const lastTile = new Map<number, number>();
    let maxOnSite = 0;
    runToEnd(s, (st) => {
      checkInvariants(st, lastTile);
      maxOnSite = Math.max(maxOnSite, st.visitors.filter((v) => v.phase === 'onSite').length);
    });
    expect(s.finished).toBe(true);
    expect(s.tick).toBeLessThanOrEqual(s.totalTicks);
    expect(s.tick).toBeGreaterThan(s.festivalEndTick);
    expect(maxOnSite).toBe(150);
    expect(s.visitors.every((v) => v.phase === 'exited')).toBe(true);
    for (const id of s.facilityOrder) {
      expect(s.facilities[id].queue).toEqual([]);
      expect(s.facilities[id].serving).toEqual([]);
      expect(s.facilities[id].occupants).toEqual([]);
    }
    const served = Object.values(s.metrics.facility).reduce((a, f) => a + f.served, 0);
    expect(served).toBeGreaterThan(100);
  }, 60_000);

  it('dezelfde seed en input geven exact hetzelfde resultaat (criterium 7)', () => {
    const a = runToEnd(createSimulation(exampleInput()));
    const b = runToEnd(createSimulation(exampleInput()));
    expect(hashState(a)).toBe(hashState(b));
    expect(buildReport(a)).toEqual(buildReport(b));
  });

  it('een andere seed geeft een ander resultaat', () => {
    const a = runToEnd(createSimulation(exampleInput({ seed: 1 })));
    const b = runToEnd(createSimulation(exampleInput({ seed: 2 })));
    expect(hashState(a)).not.toBe(hashState(b));
  });

  it('weigert te starten zonder bereikbaar podium', () => {
    const l = place(blankLayout(), 'entrance', 14, 23, 'north');
    expect(() => createSimulation({ ...exampleInput(), layout: l })).toThrow(SimulationSetupError);
  });

  it('telt bezoekers zonder bereikbaar doel als er geen toilet is', () => {
    const input = exampleInput();
    let layout = input.layout;
    for (const f of layout.facilities.filter((x) => x.type === 'toilet')) layout = removeFacility(layout, f.id);
    const s = runToEnd(createSimulation({ ...input, layout }));
    const r = buildReport(s);
    expect(r.noGoal.toilet).toBeGreaterThan(0);
    expect(s.metrics.samples.some((sm) => sm.noGoal > 0)).toBe(true);
    expect(s.visitors.every((v) => v.phase === 'exited')).toBe(true);
    expect(r.advice.some((a) => a.includes('toilet'))).toBe(true);
  });
});
