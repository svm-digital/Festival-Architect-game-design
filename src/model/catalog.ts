import type { Act, FacilityType, Genre, PostType } from './types';

export type FacilityCategory = 'basis' | 'horeca' | 'comfort' | 'verkoop' | 'zorg';

export interface FacilityDef {
  type: FacilityType;
  label: string;
  category: FacilityCategory;
  /** Afmetingen bij facing 'south' of 'north'. Bij 'west'/'east' worden ze omgewisseld. */
  width: number;
  height: number;
  /** Huur per editie, inclusief vaste bezetting. */
  cost: number;
  /** Gelijktijdig bediend (kramen, bar, toilet), zitplaatsen (zitgebied) of medewerkers (hulppost). */
  capacity: number | null;
  serviceMinutes: number | null;
  maxCount: number | null;
  description: string;
}

export const FACILITY_DEFS: Record<FacilityType, FacilityDef> = {
  entrance: {
    type: 'entrance',
    label: 'Ingang/uitgang',
    category: 'basis',
    width: 3,
    height: 1,
    cost: 400,
    capacity: null,
    serviceMinutes: null,
    maxCount: 1,
    description: 'Op de terreingrens. Bezoekers komen hier binnen en vertrekken hier.',
  },
  stage: {
    type: 'stage',
    label: 'Podium',
    category: 'basis',
    width: 5,
    height: 3,
    cost: 800,
    capacity: null,
    serviceMinutes: null,
    maxCount: 2,
    description: 'Publiek staat in de zone voor de toegangskant.',
  },
  food: {
    type: 'food',
    label: 'Eetkraam',
    category: 'horeca',
    width: 2,
    height: 2,
    cost: 300,
    capacity: 2,
    serviceMinutes: 3,
    maxCount: null,
    description: '2 tegelijk, 3 min per bezoeker.',
  },
  bar: {
    type: 'bar',
    label: 'Bar',
    category: 'horeca',
    width: 3,
    height: 2,
    cost: 350,
    capacity: 3,
    serviceMinutes: 1,
    maxCount: null,
    description: '3 tappunten, 1 min per drankje.',
  },
  toilet: {
    type: 'toilet',
    label: 'Toiletblok',
    category: 'comfort',
    width: 3,
    height: 2,
    cost: 250,
    capacity: 3,
    serviceMinutes: 2,
    maxCount: null,
    description: '3 cabines, 2 min per bezoeker.',
  },
  seating: {
    type: 'seating',
    label: 'Zitgebied',
    category: 'comfort',
    width: 3,
    height: 2,
    cost: 120,
    capacity: 6,
    serviceMinutes: null,
    maxCount: null,
    description: '6 zitplaatsen om energie bij te tanken.',
  },
  merch: {
    type: 'merch',
    label: 'Merchandisestand',
    category: 'verkoop',
    width: 2,
    height: 2,
    cost: 250,
    capacity: 2,
    serviceMinutes: 2,
    maxCount: null,
    description: '2 tegelijk, 2 min per verkoop.',
  },
  firstaid: {
    type: 'firstaid',
    label: 'EHBO-post',
    category: 'zorg',
    width: 2,
    height: 2,
    cost: 350,
    capacity: 2,
    serviceMinutes: null,
    maxCount: null,
    description: '2 hulpverleners voor medische incidenten.',
  },
  security: {
    type: 'security',
    label: 'Beveiligingspost',
    category: 'zorg',
    width: 2,
    height: 1,
    cost: 300,
    capacity: 2,
    serviceMinutes: null,
    maxCount: null,
    description: '2 beveiligers voor conflicten.',
  },
  awareness: {
    type: 'awareness',
    label: 'Awarenesspost',
    category: 'zorg',
    width: 2,
    height: 1,
    cost: 200,
    capacity: 2,
    serviceMinutes: null,
    maxCount: null,
    description: '2 awarenessmedewerkers voor welzijnsmeldingen.',
  },
};

/** Label midden in een zin: kleine letter, behalve afkortingen zoals EHBO. */
export function lowerLabel(type: FacilityType): string {
  const label = FACILITY_DEFS[type].label;
  return /^[A-Z]{2,}/.test(label) ? label : label.charAt(0).toLowerCase() + label.slice(1);
}

export const FACILITY_ORDER: FacilityType[] = [
  'entrance',
  'stage',
  'food',
  'bar',
  'toilet',
  'seating',
  'merch',
  'firstaid',
  'security',
  'awareness',
];

export const CATEGORY_LABELS: Record<FacilityCategory, string> = {
  basis: 'Basis',
  horeca: 'Eten en drinken',
  comfort: 'Sanitair en comfort',
  verkoop: 'Verkoop',
  zorg: 'Zorg en veiligheid',
};

export const POST_TYPES: PostType[] = ['firstaid', 'security', 'awareness'];

export const POST_SHORT: Record<PostType, string> = {
  firstaid: 'EHBO',
  security: 'Beveiliging',
  awareness: 'Awareness',
};

export function isPost(type: FacilityType): type is PostType {
  return type === 'firstaid' || type === 'security' || type === 'awareness';
}

/** Voorzieningen met een wachtrij en vaste servicetijd. */
export function hasQueue(type: FacilityType): boolean {
  return type === 'food' || type === 'bar' || type === 'toilet' || type === 'merch';
}

/** Verkoopprijs en inkoopprijs per verkochte eenheid. */
export const PRODUCTS = {
  food: { label: 'Eten', price: 8, purchase: 3 },
  bar: { label: 'Drank', price: 5, purchase: 1.5 },
  merch: { label: 'Merchandise', price: 20, purchase: 8 },
} as const;

export type ProductType = keyof typeof PRODUCTS;

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

/** Gage per optreden. */
export const ACT_FEE_PER_POPULARITY = 40;

export function actFee(act: Act): number {
  return act.popularity * ACT_FEE_PER_POPULARITY;
}

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
