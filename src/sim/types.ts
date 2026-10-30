import type { ProductType } from '../model/catalog';
import type { DemandBreakdown, EditionFinance } from '../model/economy';
import type { ReachabilityAnalysis, WalkGrid } from '../model/reachability';
import type { FacilityType, FestivalLayout, Genre, PostType, Program, ScenarioSettings } from '../model/types';
import type { Rng } from './rng';

export type VisitorState =
  | 'Entering'
  | 'Walking'
  | 'Watching'
  | 'Queuing'
  | 'BeingServed'
  | 'Resting'
  | 'BeingHelped'
  | 'Leaving';

export type GoalKind = 'enter' | 'stage' | 'food' | 'bar' | 'toilet' | 'seating' | 'merch' | 'wander' | 'exit';

/** Behoeften die een voorziening nodig hebben. */
export type NeedKind = 'food' | 'drink' | 'toilet' | 'seating';

export const NEED_FACILITY: Record<NeedKind, FacilityType> = {
  food: 'food',
  drink: 'bar',
  toilet: 'toilet',
  seating: 'seating',
};

export interface VisitorGoal {
  kind: GoalKind;
  facilityId: string | null;
  tile: number;
}

/** Alles wat langs een pad over het raster beweegt (bezoekers en medewerkers). */
export interface Mover {
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  tile: number;
  path: number[];
  pathIndex: number;
}

export interface Visitor extends Mover {
  id: number;
  phase: 'pending' | 'onSite' | 'exited';
  arrivalTick: number;
  state: VisitorState;
  goal: VisitorGoal | null;
  hunger: number;
  thirst: number;
  toilet: number;
  energy: number;
  satisfaction: number;
  genre: Genre;
  /** Resterende ticks van een tijdgebonden activiteit (rusten). */
  timer: number;
  queueEnterTick: number;
  avoidFacilityId: string | null;
  avoidUntilTick: number;
  /** Behoeften waarvoor bij het laatste beslismoment geen bereikbare voorziening was. */
  unmetNeeds: NeedKind[];
  needsDecision: boolean;
  boughtMerch: boolean;
  incidentId: number | null;
  leftEarly: boolean;
  exitTick: number | null;
}

export interface ServingSlot {
  visitorId: number;
  remaining: number;
}

export interface FacilityRuntime {
  id: string;
  type: FacilityType;
  name: string;
  reachable: boolean;
  accessTile: number;
  capacity: number;
  serviceTicks: number;
  /** FIFO: visitor-id's in volgorde van aankomst. */
  queue: number[];
  serving: ServingSlot[];
  /** Zitgebied: bezoekers die zitten. */
  occupants: number[];
  /** Kostenveld naar de toegangstegel (alleen bij bereikbare voorzieningen). Bij hulpposten in tegels (staffWalk). */
  field: Float32Array | null;
  /** Podium: bereikbare publiekstegels. */
  audienceTiles: number[];
  /** Hulppost: id's van de medewerkers. */
  staffIds: number[];
}

export type IncidentKind = 'medical' | 'conflict' | 'wellbeing';

export const INCIDENT_POST: Record<IncidentKind, PostType> = {
  medical: 'firstaid',
  conflict: 'security',
  wellbeing: 'awareness',
};

export interface Incident {
  id: number;
  kind: IncidentKind;
  visitorId: number;
  tile: number;
  createdTick: number;
  staffId: number | null;
  arrivedTick: number | null;
  resolvedTick: number | null;
  outcome: 'open' | 'handled' | 'unhandled';
}

export type StaffState = 'idle' | 'responding' | 'handling' | 'returning';

export interface StaffMember extends Mover {
  id: number;
  postId: string;
  kind: PostType;
  state: StaffState;
  incidentId: number | null;
  timer: number;
  /** Ticks bezig (onderweg of helpend), voor de bezettingsgraad. */
  busyTicks: number;
}

export interface SimulationInput {
  layout: FestivalLayout;
  program: Program;
  scenario: ScenarioSettings;
  seed: number;
  /** Uit de vraagregel (model/economy.ts); bepaalt ook het aantal bezoekers en de ticketprijs. */
  demand: DemandBreakdown;
  /** Kapitaal bij de start van deze editie. */
  capitalStart: number;
}

export interface MetricSample {
  minute: number;
  onSite: number;
  avgSatisfaction: number;
  watching: Record<string, number>;
  queues: Record<string, number>;
  noGoal: number;
  openIncidents: number;
  /** Omzet tot nu toe (tickets + verkoop). */
  revenue: number;
  /** Drukste 3×3-venster: aantal bezoekers en middentegel. */
  peakCount: number;
  peakTile: number;
}

export interface FacilityStats {
  /** Bediening gestart. */
  served: number;
  /** Bediening afgerond (bij verkooppunten: verkocht). */
  completed: number;
  abandoned: number;
  totalWaitTicks: number;
  maxQueue: number;
  /** Zitgebied: aantal keer gaan zitten. */
  uses: number;
  /** Zitgebied: bezoekers die het vol aantroffen. */
  turnedAway: number;
}

export interface SimulationMetrics {
  samples: MetricSample[];
  /** Bezoekersminuten per tegel. */
  heat: Float32Array;
  facility: Record<string, FacilityStats>;
  /** Unieke bezoekers die minstens één keer geen bereikbaar doel vonden, per behoefte. */
  noGoalVisitors: Record<NeedKind, number[]>;
  stageWatchMinutes: Record<string, number>;
  walkTicksPath: number;
  walkTicksGrass: number;
  sales: Record<ProductType, number>;
}

export interface SimulationState {
  input: SimulationInput;
  tick: number;
  festivalEndTick: number;
  totalTicks: number;
  rng: Rng;
  walk: WalkGrid;
  /** Zelfde raster met gelijke kosten per tegel: medewerkers lopen het kortste aantal tegels. */
  staffWalk: WalkGrid;
  analysis: ReachabilityAnalysis;
  entranceId: string;
  gateTile: number;
  entranceAccessTile: number;
  entranceField: Float32Array;
  reachableTiles: number[];
  reachablePathTiles: number[];
  facilities: Record<string, FacilityRuntime>;
  /** Vaste volgorde voor deterministische iteratie. */
  facilityOrder: string[];
  stageIds: string[];
  visitors: Visitor[];
  staff: StaffMember[];
  incidents: Incident[];
  metrics: SimulationMetrics;
  finished: boolean;
}

export interface ReportFacility {
  id: string;
  name: string;
  type: FacilityType;
  reachable: boolean;
  served: number;
  abandoned: number;
  avgWaitMinutes: number | null;
  maxQueue: number;
  turnedAway: number;
  underused: boolean;
  /** Omzet bij verkooppunten. */
  revenue: number;
}

export interface ReportStage {
  id: string;
  name: string;
  reachable: boolean;
  watchMinutes: number;
  peakAudience: number;
  performances: {
    slot: number;
    actName: string;
    genre: Genre;
    popularity: number;
    fee: number;
    peakAudience: number;
    avgAudience: number;
  }[];
}

export interface ReportPeak {
  minute: number;
  clock: string;
  count: number;
  tile: number;
  near: string;
}

export interface ReportIncidents {
  kind: IncidentKind;
  total: number;
  handled: number;
  unhandled: number;
  avgResponseMinutes: number | null;
  maxResponseMinutes: number | null;
  /** Voorziening het dichtst bij het traagst of niet geholpen incident. */
  worstNear: string | null;
}

export interface ReportPost {
  id: string;
  name: string;
  type: PostType;
  reachable: boolean;
  handled: number;
  /** Fractie van de festivaltijd dat medewerkers bezig waren. */
  utilization: number;
}

export interface FinalReport {
  version: 2;
  signature: string;
  seed: number;
  visitorCount: number;
  demand: DemandBreakdown;
  avgSatisfaction: number;
  leftEarly: number;
  stillOnSiteAtEnd: number;
  facilities: ReportFacility[];
  stages: ReportStage[];
  popularStageId: string | null;
  peaks: ReportPeak[];
  noGoal: Record<NeedKind, number>;
  incidents: ReportIncidents[];
  posts: ReportPost[];
  grassShare: number;
  finance: EditionFinance;
  advice: string[];
  heat: number[];
  timeline: { minute: number; onSite: number; avgSatisfaction: number; revenue: number }[];
}
