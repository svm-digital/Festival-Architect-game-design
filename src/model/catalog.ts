import type { Act, FacilityType, Genre } from './types';

export interface FacilityDef {
  type: FacilityType;
  label: string;
  /** Afmetingen bij facing 'south' of 'north'. Bij 'west'/'east' worden ze omgewisseld. */
  width: number;
  height: number;
  cost: number;
  /** Gelijktijdig bediend (eetkraam/toilet) of zitplaatsen (zitgebied). */
  capacity: number | null;
  serviceMinutes: number | null;
  maxCount: number | null;
  description: string;
}

export const FACILITY_DEFS: Record<FacilityType, FacilityDef> = {
  entrance: {
    type: 'entrance',
    label: 'Ingang/uitgang',
    width: 3,
    height: 1,
    cost: 4000,
    capacity: null,
    serviceMinutes: null,
    maxCount: 1,
    description: 'Op de terreingrens. Bezoekers komen hier binnen en vertrekken hier.',
  },
  stage: {
    type: 'stage',
    label: 'Podium',
    width: 5,
    height: 3,
    cost: 15000,
    capacity: null,
    serviceMinutes: null,
    maxCount: 2,
    description: 'Publiek staat in de zone voor de toegangskant.',
  },
  food: {
    type: 'food',
    label: 'Eetkraam',
    width: 2,
    height: 2,
    cost: 4000,
    capacity: 2,
    serviceMinutes: 3,
    maxCount: null,
    description: 'Bedient 2 bezoekers tegelijk, 3 min per bezoeker.',
  },
  toilet: {
    type: 'toilet',
    label: 'Toiletblok',
    width: 3,
    height: 2,
    cost: 3000,
    capacity: 3,
    serviceMinutes: 2,
    maxCount: null,
    description: '3 cabines, 2 min per bezoeker.',
  },
  seating: {
    type: 'seating',
    label: 'Zitgebied',
    width: 3,
    height: 2,
    cost: 1500,
    capacity: 6,
    serviceMinutes: null,
    maxCount: null,
    description: '6 zitplaatsen om energie bij te tanken.',
  },
};

export const FACILITY_ORDER: FacilityType[] = ['entrance', 'stage', 'food', 'toilet', 'seating'];

export const GENRES: Genre[] = ['pop', 'rock', 'elektronisch', 'folk'];

export const GENRE_LABELS: Record<Genre, string> = {
  pop: 'Pop',
  rock: 'Rock',
  elektronisch: 'Elektronisch',
  folk: 'Folk',
};

export const GENRE_COLORS: Record<Genre, string> = {
  pop: '#f472b6',
  rock: '#f59e0b',
  elektronisch: '#38bdf8',
  folk: '#a3e635',
};

/** Fictieve acts. Namen zijn verzonnen; elke gelijkenis berust op toeval. */
export const ACTS: Act[] = [
  { id: 'neonvlinders', name: 'De Neonvlinders', genre: 'pop', popularity: 8 },
  { id: 'kaartenhuis', name: 'Kaartenhuis', genre: 'pop', popularity: 5 },
  { id: 'hoge-hoed', name: 'Hoge Hoed', genre: 'pop', popularity: 3 },
  { id: 'betonbloem', name: 'Betonbloem', genre: 'rock', popularity: 9 },
  { id: 'stoomfluit', name: 'Stoomfluit', genre: 'rock', popularity: 7 },
  { id: 'grindpad', name: 'Grindpad', genre: 'rock', popularity: 4 },
  { id: 'synthkasteel', name: 'Synthkasteel', genre: 'elektronisch', popularity: 9 },
  { id: 'pixelregen', name: 'Pixelregen', genre: 'elektronisch', popularity: 6 },
  { id: 'maanlicht-modem', name: 'Maanlicht Modem', genre: 'elektronisch', popularity: 4 },
  { id: 'veldspaat', name: 'Veldspaat', genre: 'folk', popularity: 8 },
  { id: 'ruisende-rivier', name: 'Ruisende Rivier', genre: 'folk', popularity: 6 },
  { id: 'lantaarnkoor', name: 'Lantaarnkoor', genre: 'folk', popularity: 3 },
];

export function getAct(id: string): Act | undefined {
  return ACTS.find((a) => a.id === id);
}

export function formatEuro(amount: number): string {
  return new Intl.NumberFormat('nl-NL', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDecimal(n: number, digits = 1): string {
  return n.toLocaleString('nl-NL', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}
