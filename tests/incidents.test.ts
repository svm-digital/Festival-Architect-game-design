import { describe, expect, it } from 'vitest';
import { removeFacility } from '../src/model/layout';
import { TICKS_PER_MINUTE } from '../src/sim/clock';
import { coverageMinutes, startIncident, updateIncidents } from '../src/sim/incidents';
import { findPath } from '../src/sim/pathfinding';
import { RULES } from '../src/sim/rules';
import { createSimulation, step } from '../src/sim/simulation';
import type { SimulationState } from '../src/sim/types';
import { example, exampleInput } from './helpers';

/** Zet bezoeker 0 op een vaste plek op het terrein, zonder dat de rest van de simulatie meedraait. */
function placeVisitor(s: SimulationState, tile: number) {
  const v = s.visitors[0];
  v.phase = 'onSite';
  v.state = 'Resting';
  v.tile = tile;
  v.x = v.prevX = (tile % s.walk.width) + 0.5;
  v.y = v.prevY = Math.floor(tile / s.walk.width) + 0.5;
  return v;
}

describe('zorg en veiligheid (spelmechaniek)', () => {
  it('de dichtstbijzijnde vrije medewerker loopt erheen, helpt en keert terug', () => {
    const s = createSimulation(exampleInput({ visitors: 1 }));
    const tile = 12 * 32 + 5; // op het pad
    const v = placeVisitor(s, tile);
    const inc = startIncident(s, v, 'medical');
    expect(v.state).toBe('BeingHelped');
    updateIncidents(s);
    const st = s.staff[inc.staffId!];
    expect(st.kind).toBe('firstaid');
    const post = s.facilities[st.postId];
    const tiles = findPath(s.staffWalk, post.accessTile, tile)!.length;
    let guard = 0;
    while (inc.outcome === 'open' && guard++ < 2000) {
      s.tick++;
      updateIncidents(s);
    }
    expect(inc.outcome).toBe('handled');
    const response = (inc.arrivedTick! - inc.createdTick) / TICKS_PER_MINUTE;
    expect(response).toBeCloseTo(tiles / RULES.movement.staffSpeed, 0);
    expect(v.needsDecision).toBe(true);
    expect(v.incidentId).toBeNull();
    while (st.state !== 'idle' && guard++ < 4000) {
      s.tick++;
      updateIncidents(s);
    }
    expect(st.tile).toBe(post.accessTile);
  });

  it('zonder post blijft een melding onbehandeld en kost dat tevredenheid', () => {
    const input = exampleInput({ visitors: 1 });
    let layout = input.layout;
    for (const f of layout.facilities.filter((x) => x.type === 'security')) layout = removeFacility(layout, f.id);
    const s = createSimulation({ ...input, layout });
    const v = placeVisitor(s, 12 * 32 + 5);
    v.satisfaction = 60;
    const inc = startIncident(s, v, 'conflict');
    for (let t = 0; t <= RULES.incidents.noPostGiveUpMinutes * TICKS_PER_MINUTE; t++) {
      s.tick++;
      updateIncidents(s);
    }
    expect(inc.outcome).toBe('unhandled');
    expect(v.satisfaction).toBe(60 + RULES.incidents.satisfaction.unhandled);
  });

  it('meldingen worden gesloten bij festivaleinde', () => {
    const s = createSimulation(exampleInput({ visitors: 20 }));
    while (s.tick < s.festivalEndTick - 5) step(s);
    const v = s.visitors.find((x) => x.phase === 'onSite' && x.state !== 'BeingHelped')!;
    startIncident(s, v, 'wellbeing');
    while (!s.finished) step(s);
    expect(s.incidents.every((i) => i.outcome !== 'open')).toBe(true);
    expect(s.visitors.every((x) => x.phase === 'exited')).toBe(true);
  });

  it('dekkingslaag: aanlooptijd in minuten vanaf de dichtstbijzijnde post', () => {
    const { layout } = example();
    const cov = coverageMinutes(layout, 'firstaid');
    const post = layout.facilities.find((f) => f.type === 'firstaid')!;
    // EHBO-post (17,18) naar het westen → toegang (16,19)
    expect(post.x).toBe(17);
    expect(cov[19 * 32 + 16]).toBe(0);
    expect(cov[19 * 32 + 15]).toBeCloseTo(1 / RULES.movement.staffSpeed);
    const tree = layout.grid.tiles.findIndex((t) => t === 'obstacle');
    expect(cov[tree]).toBe(Infinity);
  });
});
