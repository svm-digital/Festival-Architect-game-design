// Datamodel voor terrein, programma en scenario. Puur data: serialiseerbaar naar JSON.

export type TileType = 'grass' | 'path' | 'obstacle';
export type ObstacleKind = 'tree' | 'water' | 'rock';

export interface TileGrid {
  width: number;
  height: number;
  /** Rij voor rij, index = y * width + x. */
  tiles: TileType[];
  /** Alleen gevuld voor obstakeltegels; bepaalt uitsluitend de weergave. */
  obstacleKinds: (ObstacleKind | null)[];
}

export type FacilityType =
  | 'entrance'
  | 'stage'
  | 'food'
  | 'bar'
  | 'toilet'
  | 'seating'
  | 'merch'
  | 'firstaid'
  | 'security'
  | 'awareness';

/** Hulpposten met medewerkers die op incidenten afgaan. */
export type PostType = 'firstaid' | 'security' | 'awareness';

/** Kant van de footprint waar de toegangstegel ligt. */
export type Facing = 'south' | 'west' | 'north' | 'east';

export interface Facility {
  id: string;
  type: FacilityType;
  name: string;
  /** Linksboven van de footprint. */
  x: number;
  y: number;
  facing: Facing;
}

export interface Stage extends Facility {
  type: 'stage';
}

export interface FestivalLayout {
  grid: TileGrid;
  facilities: Facility[];
  /** Oplopende teller voor unieke id's. */
  nextFacilityNumber: number;
}

export type Genre = 'pop' | 'rock' | 'elektronisch' | 'folk';

export interface Act {
  id: string;
  name: string;
  genre: Genre;
  /** 1–10 */
  popularity: number;
}

export interface Performance {
  stageId: string;
  /** Index in ScenarioSettings.slots */
  slot: number;
  actId: string;
}

export interface Program {
  performances: Performance[];
}

export interface TimeSlot {
  index: number;
  startMinute: number;
  endMinute: number;
}

export interface ScenarioSettings {
  id: string;
  title: string;
  goal: string;
  gridWidth: number;
  gridHeight: number;
  /** Kapitaal bij de start van editie 1. */
  startCapital: number;
  pathTileCost: number;
  maxVisitors: number;
  festivalMinutes: number;
  exitWindowMinutes: number;
  arrivalWindowMinutes: number;
  /** Kloktijd van minuut 0, in minuten na middernacht. */
  clockStartMinutes: number;
  slots: TimeSlot[];
}

export interface Point {
  x: number;
  y: number;
}
