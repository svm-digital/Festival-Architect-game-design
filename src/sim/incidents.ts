// Incidenten en hulpmedewerkers. Een fictieve spelmechaniek: incidenten ontstaan met een
// kleine kans per bezoeker per minuut; de dichtstbijzijnde vrije medewerker van de juiste
// post loopt erheen, helpt een vaste tijd en loopt terug. Geen veiligheidsmodel.

import { TICKS_PER_MINUTE } from './clock';
import { stepAlongPath } from './movement';
import { accessTile } from '../model/grid';
import { buildWalkGrid } from '../model/reachability';
import type { FestivalLayout, PostType } from '../model/types';
import { costField, findPath, uniformWalk } from './pathfinding';
import { removeFromFacility } from './queues';
import { nextFloat } from './rng';
import { RULES } from './rules';
import { INCIDENT_POST, type Incident, type IncidentKind, type SimulationState, type StaffMember, type Visitor } from './types';

const clamp = (v: number) => (v < 0 ? 0 : v > 100 ? 100 : v);

/** Elke spelminuut: per bezoeker één trekking of er een incident ontstaat. */
export function spawnIncidents(s: SimulationState): void {
  if (s.tick % TICKS_PER_MINUTE !== 0 || s.tick >= s.festivalEndTick) return;
  const I = RULES.incidents;
  for (const v of s.visitors) {
    if (v.phase !== 'onSite') continue;
    if (v.state === 'Entering' || v.state === 'Leaving' || v.state === 'BeingHelped' || v.state === 'BeingServed') continue;
    const waitedMinutes = v.state === 'Queuing' ? (s.tick - v.queueEnterTick) / TICKS_PER_MINUTE : 0;
    const pMedical =
      I.medical.base +
      (v.energy < I.medical.lowEnergyBelow ? I.medical.lowEnergy : 0) +
      (v.thirst > I.medical.highThirstAbove ? I.medical.highThirst : 0);
    const pConflict =
      I.conflict.base +
      (v.satisfaction < I.conflict.lowSatisfactionBelow ? I.conflict.lowSatisfaction : 0) +
      (waitedMinutes >= I.conflict.longQueueMinutes ? I.conflict.longQueue : 0);
    const pWellbeing =
      I.wellbeing.base +
      (v.energy < I.wellbeing.lowEnergyBelow ? I.wellbeing.lowEnergy : 0) +
      (v.satisfaction < I.wellbeing.lowSatisfactionBelow ? I.wellbeing.lowSatisfaction : 0);
    const r = nextFloat(s.rng);
    let kind: IncidentKind | null = null;
    if (r < pMedical) kind = 'medical';
    else if (r < pMedical + pConflict) kind = 'conflict';
    else if (r < pMedical + pConflict + pWellbeing) kind = 'wellbeing';
    if (kind) startIncident(s, v, kind);
  }
}

export function startIncident(s: SimulationState, v: Visitor, kind: IncidentKind): Incident {
  removeFromFacility(s, v);
  const incident: Incident = {
    id: s.incidents.length,
    kind,
    visitorId: v.id,
    tile: v.tile,
    createdTick: s.tick,
    staffId: null,
    arrivedTick: null,
    resolvedTick: null,
    outcome: 'open',
  };
  s.incidents.push(incident);
  v.state = 'BeingHelped';
  v.incidentId = incident.id;
  v.path = [];
  v.pathIndex = 0;
  return incident;
}

function releaseVisitor(s: SimulationState, inc: Incident, satisfactionDelta: number): void {
  const v = s.visitors[inc.visitorId];
  v.satisfaction = clamp(v.satisfaction + satisfactionDelta);
  if (inc.kind === 'medical' && inc.outcome === 'handled') v.energy = Math.max(v.energy, RULES.incidents.medicalEnergyAfter);
  v.incidentId = null;
  v.needsDecision = true;
}

function resolve(s: SimulationState, inc: Incident, outcome: 'handled' | 'unhandled'): void {
  inc.outcome = outcome;
  inc.resolvedTick = s.tick;
  const S = RULES.incidents.satisfaction;
  if (outcome === 'unhandled') return releaseVisitor(s, inc, S.unhandled);
  const response = (inc.arrivedTick! - inc.createdTick) / TICKS_PER_MINUTE;
  releaseVisitor(s, inc, response <= S.fastWithin ? S.fast : response <= S.okWithin ? S.ok : S.slow);
}

function sendBack(s: SimulationState, st: StaffMember): void {
  const post = s.facilities[st.postId];
  st.incidentId = null;
  st.path = findPath(s.staffWalk, st.tile, post.accessTile) ?? [];
  st.pathIndex = 0;
  st.state = st.path.length > 0 ? 'returning' : 'idle';
}

/** Sluit het incident van een bezoeker die vertrekt (bijv. bij festivaleinde). */
export function closeIncidentForVisitor(s: SimulationState, v: Visitor): void {
  if (v.incidentId === null) return;
  const inc = s.incidents[v.incidentId];
  v.incidentId = null;
  if (inc.outcome !== 'open') return;
  inc.outcome = inc.arrivedTick !== null ? 'handled' : 'unhandled';
  inc.resolvedTick = s.tick;
  if (inc.staffId !== null) sendBack(s, s.staff[inc.staffId]);
}

/** Toewijzen, lopen, helpen en terugkeren. Eén keer per tick. */
export function updateIncidents(s: SimulationState): void {
  const I = RULES.incidents;
  for (const inc of s.incidents) {
    if (inc.outcome !== 'open' || inc.staffId !== null) continue;
    const waited = s.tick - inc.createdTick;
    const postType = INCIDENT_POST[inc.kind];
    let anyPost = false;
    let best: StaffMember | null = null;
    let bestCost = Infinity;
    for (const id of s.facilityOrder) {
      const post = s.facilities[id];
      if (post.type !== postType || !post.field) continue;
      const cost = post.field[inc.tile];
      if (!Number.isFinite(cost)) continue;
      anyPost = true;
      if (cost >= bestCost) continue;
      const free = post.staffIds.map((sid) => s.staff[sid]).find((st) => st.state === 'idle');
      if (free) {
        best = free;
        bestCost = cost;
      }
    }
    if (best) {
      inc.staffId = best.id;
      best.incidentId = inc.id;
      best.state = 'responding';
      best.path = findPath(s.staffWalk, best.tile, inc.tile) ?? [];
      best.pathIndex = 0;
    } else if (waited >= (anyPost ? I.maxWaitMinutes : I.noPostGiveUpMinutes) * TICKS_PER_MINUTE) {
      resolve(s, inc, 'unhandled');
    }
  }

  const speed = RULES.movement.staffSpeed / TICKS_PER_MINUTE;
  for (const st of s.staff) {
    st.prevX = st.x;
    st.prevY = st.y;
    if (st.state !== 'idle') st.busyTicks += 1;
    switch (st.state) {
      case 'responding': {
        if (stepAlongPath(s.staffWalk, st, () => speed)) {
          const inc = s.incidents[st.incidentId!];
          inc.arrivedTick = s.tick;
          st.state = 'handling';
          st.timer = I.handlingMinutes[inc.kind] * TICKS_PER_MINUTE;
        }
        break;
      }
      case 'handling': {
        st.timer -= 1;
        if (st.timer <= 0) {
          const inc = s.incidents[st.incidentId!];
          if (inc.outcome === 'open') resolve(s, inc, 'handled');
          sendBack(s, st);
        }
        break;
      }
      case 'returning':
        if (stepAlongPath(s.staffWalk, st, () => speed)) st.state = 'idle';
        break;
      case 'idle':
        break;
    }
  }
}

/**
 * Aanlooptijd in minuten vanaf de dichtstbijzijnde post van dit type, per tegel
 * (Infinity = geen post bereikbaar). Voor de dekkingslaag in de bouwmodus.
 */
export function coverageMinutes(layout: FestivalLayout, type: PostType): Float32Array {
  const walk = uniformWalk(buildWalkGrid(layout));
  const out = new Float32Array(walk.width * walk.height).fill(Infinity);
  for (const f of layout.facilities) {
    if (f.type !== type) continue;
    const a = accessTile(f);
    if (a.x < 0 || a.y < 0 || a.x >= walk.width || a.y >= walk.height) continue;
    const field = costField(walk, a.y * walk.width + a.x);
    for (let i = 0; i < out.length; i++) {
      const m = field[i] / RULES.movement.staffSpeed;
      if (m < out[i]) out[i] = m;
    }
  }
  return out;
}
