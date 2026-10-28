// Seeded RNG (mulberry32). De volledige state is één 32-bits getal, zodat die
// in SimulationState past en runs reproduceerbaar zijn.

export interface Rng {
  state: number;
}

export function createRng(seed: number): Rng {
  return { state: (seed >>> 0) ^ 0x9e3779b9 };
}

export function nextFloat(rng: Rng): number {
  rng.state = (rng.state + 0x6d2b79f5) >>> 0;
  let t = rng.state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function nextRange(rng: Rng, min: number, max: number): number {
  return min + nextFloat(rng) * (max - min);
}

/** Geheel getal in [min, max] inclusief. */
export function nextInt(rng: Rng, min: number, max: number): number {
  return min + Math.floor(nextFloat(rng) * (max - min + 1));
}

export function pick<T>(rng: Rng, items: readonly T[]): T {
  return items[Math.floor(nextFloat(rng) * items.length)];
}
