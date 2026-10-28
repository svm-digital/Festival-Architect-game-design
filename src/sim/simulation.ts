import { FACILITY_DEFS, GENRES } from '../model/catalog';
import { accessTile, audienceZone, centerTile, tileIndex } from '../model/grid';
import { buildWalkGrid, validateForSimulation } from '../model/reachability';
import { festivalEndTick, TICKS_PER_MINUTE, totalTicks } from './clock';
import { createMetrics, sampleMetrics } from './metrics';
import { costField } from './pathfinding';
import { updateQueues } from './queues';
import { createRng, nextFloat, nextRange, pick } from './rng';
import { RULES } from './rules';
import type { FacilityRuntime, SimulationInput, SimulationState, Visitor } from './types';
import { onServed, startLeaving, updateNeeds, updateVisitor } from './visitors';

export class SimulationSetupError extends Error {}

export function createSimulation(input: SimulationInput): SimulationState {
  const { layout, program, scenario, seed } = input;
  const validation = validateForSimulation(layout, program, scenario);
  if (!validation.ok) {
    const errors = validation.issues.filter((i) => i.severity === 'error').map((i) => i.message);
    throw new SimulationSetupError(errors.join(' '));
  }
  const walk = buildWalkGrid(layout);
  const analysis = validation.analysis;
  const grid = layout.grid;
  const entrance = layout.facilities.find((f) => f.type === 'entrance')!;
  const gate = centerTile(entrance);
  const gateTile = tileIndex(grid, gate.x, gate.y);
  const ea = accessTile(entrance);
  const entranceAccessTile = tileIndex(grid, ea.x, ea.y);
  const reach = analysis.reachable!;

  const reachableTiles: number[] = [];
  const reachablePathTiles: number[] = [];
  for (let i = 0; i < reach.length; i++) {
    if (!reach[i]) continue;
    reachableTiles.push(i);
    if (grid.tiles[i] === 'path') reachablePathTiles.push(i);
  }

  const facilities: Record<string, FacilityRuntime> = {};
  const facilityOrder: string[] = [];
  const stageIds: string[] = [];
  for (const f of layout.facilities) {
    if (f.type === 'entrance') continue;
    const def = FACILITY_DEFS[f.type];
    const a = accessTile(f);
    const at = tileIndex(grid, a.x, a.y);
    const reachable = analysis.facilities[f.id].reachable;
    const audienceTiles =
      f.type === 'stage'
        ? audienceZone(f, grid)
            .map((p) => tileIndex(grid, p.x, p.y))
            .filter((i) => walk.walkable[i] && reach[i])
            .sort((x, y) => x - y)
        : [];
    facilities[f.id] = {
      id: f.id,
      type: f.type,
      name: f.name,
      reachable,
      accessTile: at,
      capacity: def.capacity ?? 0,
      serviceTicks: (def.serviceMinutes ?? 0) * TICKS_PER_MINUTE,
      queue: [],
      serving: [],
      occupants: [],
      field: reachable ? costField(walk, at) : null,
      audienceTiles,
    };
    facilityOrder.push(f.id);
    if (f.type === 'stage') stageIds.push(f.id);
  }

  const rng = createRng(seed);
  const count = Math.max(0, Math.min(scenario.visitorCount, scenario.maxVisitors));
  const visitors: Visitor[] = [];
  const S = RULES.start;
  for (let id = 0; id < count; id++) {
    const arrivalTick = Math.floor(nextFloat(rng) * scenario.arrivalWindowMinutes * TICKS_PER_MINUTE);
    const genre = pick(rng, GENRES);
    visitors.push({
      id,
      phase: 'pending',
      arrivalTick,
      state: 'Entering',
      x: gate.x + 0.5,
      y: gate.y + 0.5,
      prevX: gate.x + 0.5,
      prevY: gate.y + 0.5,
      tile: gateTile,
      goal: null,
      path: [],
      pathIndex: 0,
      hunger: nextRange(rng, S.hunger[0], S.hunger[1]),
      toilet: nextRange(rng, S.toilet[0], S.toilet[1]),
      energy: nextRange(rng, S.energy[0], S.energy[1]),
      satisfaction: S.satisfaction,
      genre,
      timer: 0,
      queueEnterTick: 0,
      avoidFacilityId: null,
      avoidUntilTick: 0,
      unmetNeeds: [],
      needsDecision: false,
      leftEarly: false,
      exitTick: null,
    });
  }

  return {
    input,
    tick: 0,
    festivalEndTick: festivalEndTick(scenario),
    totalTicks: totalTicks(scenario),
    rng,
    walk,
    analysis,
    entranceId: entrance.id,
    gateTile,
    entranceAccessTile,
    entranceField: costField(walk, entranceAccessTile),
    reachableTiles,
    reachablePathTiles,
    facilities,
    facilityOrder,
    stageIds,
    visitors,
    metrics: createMetrics(grid.width * grid.height, facilityOrder, stageIds),
    finished: false,
  };
}

/** Eén fixed-timestep tick. Volgorde staat vast (zie SPEC.md). */
export function step(s: SimulationState): void {
  if (s.finished) return;

  // 1. Aankomsten
  for (const v of s.visitors) {
    if (v.phase === 'pending' && v.arrivalTick <= s.tick) {
      v.phase = 'onSite';
      v.state = 'Entering';
      v.goal = { kind: 'enter', facilityId: s.entranceId, tile: s.entranceAccessTile };
      v.path = [s.entranceAccessTile];
      v.pathIndex = 0;
    }
  }

  // 2. Festivaleinde
  if (s.tick === s.festivalEndTick) {
    for (const v of s.visitors) if (v.phase === 'onSite') startLeaving(s, v, false);
  }

  // 3. Behoeften
  for (const v of s.visitors) if (v.phase === 'onSite') updateNeeds(v);

  // 4. Wachtrijen
  updateQueues(s, onServed);

  // 5. Gedrag
  for (const v of s.visitors) if (v.phase === 'onSite') updateVisitor(s, v);

  // 6. Statistiek
  sampleMetrics(s);

  s.tick += 1;
  const allGone = s.visitors.every((v) => v.phase === 'exited');
  if (s.tick >= s.totalTicks || (s.tick > s.festivalEndTick && allGone)) s.finished = true;
}

export function runToEnd(s: SimulationState, onTick?: (s: SimulationState) => void): SimulationState {
  while (!s.finished) {
    step(s);
    onTick?.(s);
  }
  return s;
}

/** Vingerafdruk van de volledige toestand, voor reproduceerbaarheidstests. */
export function hashState(s: SimulationState): string {
  let h = 0x811c9dc5;
  const mix = (n: number) => {
    h ^= n | 0;
    h = Math.imul(h, 0x01000193);
  };
  mix(s.tick);
  mix(s.rng.state);
  for (const v of s.visitors) {
    mix(v.phase.length);
    mix(v.state.charCodeAt(0) + v.state.length);
    mix(Math.round(v.x * 1000));
    mix(Math.round(v.y * 1000));
    mix(Math.round(v.satisfaction * 1000));
    mix(Math.round(v.hunger * 1000));
    mix(Math.round(v.toilet * 1000));
    mix(Math.round(v.energy * 1000));
  }
  for (const sm of s.metrics.samples) {
    mix(sm.onSite);
    mix(sm.peakCount);
    mix(Math.round(sm.avgSatisfaction * 1000));
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}
