import { getAct } from '../model/catalog';
import { activePerformance, TICKS_PER_MINUTE, tickToMinute, upcomingPerformance } from './clock';
import { closeIncidentForVisitor } from './incidents';
import { stepAlongPath } from './movement';
import { findPath, pathFromField } from './pathfinding';
import { joinQueue, removeFromFacility } from './queues';
import { nextFloat, nextInt, pick } from './rng';
import { RULES } from './rules';
import {
  NEED_FACILITY,
  type FacilityRuntime,
  type GoalKind,
  type NeedKind,
  type SimulationState,
  type Visitor,
  type VisitorGoal,
} from './types';

const perTick = (perMinute: number) => perMinute / TICKS_PER_MINUTE;
const clamp = (v: number) => (v < 0 ? 0 : v > 100 ? 100 : v);

const NEED_GOAL: Record<NeedKind, GoalKind> = { food: 'food', drink: 'bar', toilet: 'toilet', seating: 'seating' };

// ── Behoeften ────────────────────────────────────────────────────────────────

export function updateNeeds(v: Visitor): void {
  const R = RULES;
  const servedAt = v.state === 'BeingServed' ? v.goal?.kind : null;
  if (servedAt !== 'food') v.hunger += perTick(R.rates.hunger);
  if (servedAt !== 'bar') v.thirst += perTick(R.rates.thirst);
  if (servedAt !== 'toilet') v.toilet += perTick(R.rates.toilet);

  const seated = v.state === 'Resting' && v.goal?.kind === 'seating';
  switch (v.state) {
    case 'Entering':
    case 'Walking':
    case 'Leaving':
      v.energy += perTick(R.rates.energyWalking);
      break;
    case 'Watching':
      v.energy += perTick(R.rates.energyWatching);
      break;
    case 'Queuing':
      v.energy += perTick(R.rates.energyQueuing);
      v.satisfaction += perTick(R.satisfaction.queuing);
      break;
    case 'Resting':
      v.energy += perTick(seated ? R.rates.energySeated : R.rates.energyStandingRest);
      if (seated) v.satisfaction += perTick(R.satisfaction.seated);
      break;
    case 'BeingServed':
    case 'BeingHelped':
      break;
  }
  if (v.hunger >= R.critical.hunger) v.satisfaction += perTick(R.satisfaction.criticalHunger);
  if (v.thirst >= R.critical.thirst) v.satisfaction += perTick(R.satisfaction.criticalThirst);
  if (v.toilet >= R.critical.toilet) v.satisfaction += perTick(R.satisfaction.criticalToilet);
  if (v.energy <= R.critical.energy) v.satisfaction += perTick(R.satisfaction.criticalEnergy);
  if (v.unmetNeeds.length > 0) v.satisfaction += perTick(R.satisfaction.noReachableGoal);

  v.hunger = clamp(v.hunger);
  v.thirst = clamp(v.thirst);
  v.toilet = clamp(v.toilet);
  v.energy = clamp(v.energy);
  v.satisfaction = clamp(v.satisfaction);
}

// ── Keuzes ───────────────────────────────────────────────────────────────────

/** Voorziening van dit type met de laagste verwachte kosten (looptijd + verwachte wachttijd), of null. */
export function chooseFacilityOfType(s: SimulationState, v: Visitor, type: FacilityRuntime['type']): FacilityRuntime | null {
  let best: FacilityRuntime | null = null;
  let bestScore = Infinity;
  for (const id of s.facilityOrder) {
    const fac = s.facilities[id];
    if (fac.type !== type || !fac.reachable || !fac.field) continue;
    if (v.avoidFacilityId === id && s.tick < v.avoidUntilTick) continue;
    const d = fac.field[v.tile];
    if (!Number.isFinite(d)) continue;
    let wait = 0;
    if (type === 'seating') {
      if (fac.occupants.length >= fac.capacity) continue;
    } else {
      wait = ((fac.queue.length + fac.serving.length) / fac.capacity) * (fac.serviceTicks / TICKS_PER_MINUTE);
    }
    const score = d / RULES.movement.pathSpeed + wait;
    if (score < bestScore) {
      bestScore = score;
      best = fac;
    }
  }
  return best;
}

export function chooseFacility(s: SimulationState, v: Visitor, kind: NeedKind): FacilityRuntime | null {
  return chooseFacilityOfType(s, v, NEED_FACILITY[kind]);
}

function hasUrgentReachableNeed(s: SimulationState, v: Visitor): boolean {
  const C = RULES.critical;
  if (v.toilet >= C.toilet && chooseFacility(s, v, 'toilet')) return true;
  if (v.thirst >= C.thirst && chooseFacility(s, v, 'drink')) return true;
  if (v.hunger >= C.hunger && chooseFacility(s, v, 'food')) return true;
  if (v.energy <= C.energy && v.state !== 'Resting' && chooseFacility(s, v, 'seating')) return true;
  return false;
}

function chooseStage(s: SimulationState, v: Visitor): FacilityRuntime | null {
  const { program, scenario } = s.input;
  const minute = tickToMinute(s.tick);
  const C = RULES.choice;
  let best: FacilityRuntime | null = null;
  let bestScore = -Infinity;
  for (const id of s.stageIds) {
    const fac = s.facilities[id];
    if (!fac.reachable || !fac.field || fac.audienceTiles.length === 0) continue;
    const perf =
      activePerformance(program, scenario, id, minute) ??
      upcomingPerformance(program, scenario, id, minute, C.upcomingWithinMinutes);
    if (!perf) continue;
    const act = getAct(perf.actId);
    if (!act) continue;
    const d = fac.field[v.tile];
    if (!Number.isFinite(d)) continue;
    const noise = nextFloat(s.rng) * C.noise;
    const score = (act.popularity / 10) * (act.genre === v.genre ? 1 : C.otherGenreFactor) + noise - d * C.distancePenalty;
    if (score > bestScore) {
      bestScore = score;
      best = fac;
    }
  }
  return best;
}

function recordUnmet(s: SimulationState, v: Visitor, unmet: NeedKind[]): void {
  for (const kind of unmet) {
    const list = s.metrics.noGoalVisitors[kind];
    if (!list.includes(v.id)) list.push(v.id);
  }
}

function walkTo(s: SimulationState, v: Visitor, goal: VisitorGoal, path: number[], depth: number): void {
  v.goal = goal;
  v.path = path;
  v.pathIndex = 0;
  v.state = 'Walking';
  if (path.length === 0) arrive(s, v, depth);
}

function walkToFacility(s: SimulationState, v: Visitor, fac: FacilityRuntime, kind: GoalKind, depth: number): void {
  const path = pathFromField(s.walk, fac.field!, v.tile) ?? [];
  walkTo(s, v, { kind, facilityId: fac.id, tile: fac.accessTile }, path, depth + 1);
}

/** Beslismoment: kiest een nieuw doel volgens de vaste beslisvolgorde. */
export function decide(s: SimulationState, v: Visitor, depth = 0): void {
  if (s.tick >= s.festivalEndTick) return startLeaving(s, v, false);
  if (v.satisfaction < RULES.satisfaction.leaveEarlyBelow) return startLeaving(s, v, true);
  if (depth > 3) return restInPlace(s, v);

  const T = RULES.thresholds;
  const needs: { kind: NeedKind; urgency: number }[] = [];
  if (v.toilet >= T.toilet) needs.push({ kind: 'toilet', urgency: v.toilet - T.toilet });
  if (v.thirst >= T.thirst) needs.push({ kind: 'drink', urgency: v.thirst - T.thirst });
  if (v.hunger >= T.hunger) needs.push({ kind: 'food', urgency: v.hunger - T.hunger });
  if (v.energy <= T.energy) needs.push({ kind: 'seating', urgency: T.energy - v.energy });
  needs.sort((a, b) => b.urgency - a.urgency);

  const unmet: NeedKind[] = [];
  for (const need of needs) {
    const fac = chooseFacility(s, v, need.kind);
    if (!fac || !fac.field) {
      unmet.push(need.kind);
      continue;
    }
    v.unmetNeeds = unmet;
    recordUnmet(s, v, unmet);
    return walkToFacility(s, v, fac, NEED_GOAL[need.kind], depth);
  }
  v.unmetNeeds = unmet;
  recordUnmet(s, v, unmet);

  const stage = chooseStage(s, v);
  if (stage) {
    const target = pick(s.rng, stage.audienceTiles);
    const path = findPath(s.walk, v.tile, target) ?? pathFromField(s.walk, stage.field!, v.tile) ?? [];
    const tile = path.length > 0 ? path[path.length - 1] : v.tile;
    return walkTo(s, v, { kind: 'stage', facilityId: stage.id, tile }, path, depth + 1);
  }

  // Vrij moment: misschien merchandise kopen (één keer per bezoeker).
  const C = RULES.choice;
  if (!v.boughtMerch && v.satisfaction >= C.merchMinSatisfaction) {
    const roll = nextFloat(s.rng);
    const merch = roll < C.merchChance ? chooseFacilityOfType(s, v, 'merch') : null;
    if (merch) return walkToFacility(s, v, merch, 'merch', depth);
  }

  const usePaths = s.reachablePathTiles.length > 0 && nextFloat(s.rng) < C.wanderPathPreference;
  const target = pick(s.rng, usePaths ? s.reachablePathTiles : s.reachableTiles);
  const path = findPath(s.walk, v.tile, target) ?? [];
  walkTo(s, v, { kind: 'wander', facilityId: null, tile: path.length ? target : v.tile }, path, depth + 1);
}

function restInPlace(s: SimulationState, v: Visitor): void {
  v.goal = { kind: 'wander', facilityId: null, tile: v.tile };
  v.path = [];
  v.pathIndex = 0;
  v.state = 'Resting';
  v.timer = nextInt(s.rng, RULES.choice.wanderRestMinutes[0], RULES.choice.wanderRestMinutes[1]) * TICKS_PER_MINUTE;
}

export function startLeaving(s: SimulationState, v: Visitor, early: boolean): void {
  if (v.state === 'Leaving') return;
  closeIncidentForVisitor(s, v);
  removeFromFacility(s, v);
  if (early) v.leftEarly = true;
  const path = pathFromField(s.walk, s.entranceField, v.tile) ?? [];
  path.push(s.gateTile);
  v.goal = { kind: 'exit', facilityId: s.entranceId, tile: s.gateTile };
  v.path = path;
  v.pathIndex = 0;
  v.state = 'Leaving';
}

// ── Aankomst bij doel ────────────────────────────────────────────────────────

function arrive(s: SimulationState, v: Visitor, depth: number): void {
  const goal = v.goal!;
  switch (goal.kind) {
    case 'enter':
      decide(s, v, depth);
      return;
    case 'stage':
      v.state = 'Watching';
      return;
    case 'food':
    case 'bar':
    case 'toilet':
    case 'merch':
      joinQueue(s, s.facilities[goal.facilityId!], v);
      return;
    case 'seating': {
      const fac = s.facilities[goal.facilityId!];
      const stats = s.metrics.facility[fac.id];
      if (fac.occupants.length < fac.capacity) {
        fac.occupants.push(v.id);
        stats.uses += 1;
        v.state = 'Resting';
        v.timer = RULES.seating.maxRestMinutes * TICKS_PER_MINUTE;
      } else {
        stats.turnedAway += 1;
        v.satisfaction = clamp(v.satisfaction + RULES.satisfaction.seatingFull);
        avoid(s, v, fac.id);
        decide(s, v, depth);
      }
      return;
    }
    case 'wander':
      v.state = 'Resting';
      v.timer = nextInt(s.rng, RULES.choice.wanderRestMinutes[0], RULES.choice.wanderRestMinutes[1]) * TICKS_PER_MINUTE;
      return;
    case 'exit':
      v.phase = 'exited';
      v.exitTick = s.tick;
      v.path = [];
      return;
  }
}

function avoid(s: SimulationState, v: Visitor, facilityId: string): void {
  v.avoidFacilityId = facilityId;
  v.avoidUntilTick = s.tick + RULES.queue.avoidMinutes * TICKS_PER_MINUTE;
}

// ── Bediening klaar (callback van het wachtrijsysteem) ───────────────────────

export function makeOnServed(s: SimulationState) {
  return (v: Visitor, fac: FacilityRuntime): void => {
    const R = RULES.satisfaction;
    switch (fac.type) {
      case 'food':
        v.hunger = 0;
        v.satisfaction = clamp(v.satisfaction + R.servedFood);
        s.metrics.sales.food += 1;
        break;
      case 'bar':
        v.thirst = 0;
        v.satisfaction = clamp(v.satisfaction + R.servedDrink);
        s.metrics.sales.bar += 1;
        break;
      case 'toilet':
        v.toilet = 0;
        v.satisfaction = clamp(v.satisfaction + R.servedToilet);
        break;
      case 'merch':
        v.boughtMerch = true;
        v.satisfaction = clamp(v.satisfaction + R.boughtMerch);
        s.metrics.sales.merch += 1;
        break;
    }
    const need = (Object.keys(NEED_FACILITY) as NeedKind[]).find((k) => NEED_FACILITY[k] === fac.type);
    if (need) v.unmetNeeds = v.unmetNeeds.filter((k) => k !== need);
    v.needsDecision = true;
  };
}

// ── Beweging ─────────────────────────────────────────────────────────────────

function move(s: SimulationState, v: Visitor): boolean {
  const arrived = stepAlongPath(s.walk, v, (target) => {
    const onPath = target === s.gateTile || s.walk.tileTypes[target] === 'path';
    return perTick(onPath ? RULES.movement.pathSpeed : RULES.movement.grassSpeed);
  });
  if (s.walk.tileTypes[v.tile] === 'path') s.metrics.walkTicksPath += 1;
  else s.metrics.walkTicksGrass += 1;
  return arrived;
}

// ── Gedrag per tick ──────────────────────────────────────────────────────────

export function updateVisitor(s: SimulationState, v: Visitor): void {
  v.prevX = v.x;
  v.prevY = v.y;
  if (v.needsDecision) {
    v.needsDecision = false;
    decide(s, v);
  }
  switch (v.state) {
    case 'Entering':
    case 'Walking':
    case 'Leaving':
      if (move(s, v)) arrive(s, v, 0);
      return;
    case 'Watching':
      updateWatching(s, v);
      return;
    case 'Queuing':
      if (s.tick - v.queueEnterTick >= RULES.queue.maxWaitMinutes * TICKS_PER_MINUTE) {
        const fac = s.facilities[v.goal!.facilityId!];
        removeFromFacility(s, v);
        s.metrics.facility[fac.id].abandoned += 1;
        v.satisfaction = clamp(v.satisfaction + RULES.satisfaction.abandonQueue);
        avoid(s, v, fac.id);
        decide(s, v);
      }
      return;
    case 'BeingServed':
    case 'BeingHelped':
      return;
    case 'Resting':
      updateResting(s, v);
      return;
  }
}

function updateWatching(s: SimulationState, v: Visitor): void {
  if (hasUrgentReachableNeed(s, v)) return decide(s, v);
  const { program, scenario } = s.input;
  const minute = tickToMinute(s.tick);
  const stageId = v.goal!.facilityId!;
  const perf = activePerformance(program, scenario, stageId, minute);
  if (perf) {
    const act = getAct(perf.actId);
    if (act) {
      const R = RULES.satisfaction;
      const gain = act.popularity * (act.genre === v.genre ? R.watchMatchPerPopularity : R.watchOtherPerPopularity);
      v.satisfaction = clamp(v.satisfaction + perTick(gain));
    }
    s.metrics.stageWatchMinutes[stageId] += 1 / TICKS_PER_MINUTE;
    return;
  }
  if (upcomingPerformance(program, scenario, stageId, minute, RULES.choice.upcomingWithinMinutes)) return;
  decide(s, v);
}

function updateResting(s: SimulationState, v: Visitor): void {
  v.timer -= 1;
  const seated = v.goal?.kind === 'seating';
  const done = seated ? v.energy >= RULES.seating.restUntilEnergy || v.timer <= 0 : v.timer <= 0;
  if (done || hasUrgentReachableNeed(s, v)) {
    if (seated) removeFromFacility(s, v);
    decide(s, v);
  }
}
