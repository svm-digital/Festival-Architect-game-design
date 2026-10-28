import type { BudgetLine } from '../model/budget';
import type { Rng } from './rng';
import type { ReachabilityAnalysis, WalkGrid } from '../model/reachability';
import type { FacilityType, FestivalLayout, Genre, Program, ScenarioSettings } from '../model/types';

export type VisitorState = 'Entering' | 'Walking' | 'Watching' | 'Queuing' | 'BeingServed' | 'Resting' | 'Leaving';

export type GoalKind = 'enter' | 'stage' | 'food' | 'toilet' | 'seating' | 'wander' | 'exit';

export type NeedKind = 'food' | 'toilet' | 'seating';

export interface VisitorGoal {
  kind: GoalKind;
  facilityId: string | null;
  tile: number;
}

export interface Visitor {
  id: number;
  phase: 'pending' | 'onSite' | 'exited';
  arrivalTick: number;
  state: VisitorState;
  /** Positie in tegel-eenheden; tegelmidden = index + 0,5. */
  x: number;
  y: number;
  /** Positie aan het begin van de laatste tick, voor interpolatie in de renderer. */
  prevX: number;
  prevY: number;
  tile: number;
  goal: VisitorGoal | null;
  path: number[];
  pathIndex: number;
  hunger: number;
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
  /** Kostenveld naar de toegangstegel (alleen bij bereikbare voorzieningen). */
  field: Float32Array | null;
  /** Podium: bereikbare publiekstegels. */
  audienceTiles: number[];
}

export interface MetricSample {
  minute: number;
  onSite: number;
  avgSatisfaction: number;
  watching: Record<string, number>;
  queues: Record<string, number>;
  noGoal: number;
  /** Drukste 3×3-venster: aantal bezoekers en middentegel. */
  peakCount: number;
  peakTile: number;
}

export interface FacilityStats {
  served: number;
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
}

export interface SimulationInput {
  layout: FestivalLayout;
  program: Program;
  scenario: ScenarioSettings;
  seed: number;
}

export interface SimulationState {
  input: SimulationInput;
  tick: number;
  festivalEndTick: number;
  totalTicks: number;
  rng: Rng;
  walk: WalkGrid;
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
}

export interface ReportStage {
  id: string;
  name: string;
  reachable: boolean;
  watchMinutes: number;
  peakAudience: number;
  performances: { slot: number; actName: string; genre: Genre; popularity: number; peakAudience: number; avgAudience: number }[];
}

export interface ReportPeak {
  minute: number;
  clock: string;
  count: number;
  tile: number;
  near: string;
}

export interface FinalReport {
  version: 1;
  signature: string;
  seed: number;
  visitorCount: number;
  avgSatisfaction: number;
  leftEarly: number;
  stillOnSiteAtEnd: number;
  facilities: ReportFacility[];
  stages: ReportStage[];
  popularStageId: string | null;
  peaks: ReportPeak[];
  noGoal: Record<NeedKind, number>;
  grassShare: number;
  budget: { budget: number; spent: number; remaining: number; lines: BudgetLine[] };
  advice: string[];
  heat: number[];
  timeline: { minute: number; onSite: number; avgSatisfaction: number }[];
}
