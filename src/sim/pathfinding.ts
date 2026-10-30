import type { WalkGrid } from '../model/reachability';
import { PATH_COST } from '../model/reachability';

// Buurvolgorde N, O, Z, W — vast, zodat paden deterministisch zijn.
const DX = [0, 1, 0, -1];
const DY = [-1, 0, 1, 0];

/** Min-heap op (prioriteit, volgnummer) voor deterministische tie-breaks. */
class MinHeap {
  private items: { p: number; seq: number; v: number }[] = [];
  private seq = 0;

  get size(): number {
    return this.items.length;
  }

  push(v: number, p: number): void {
    const items = this.items;
    items.push({ p, seq: this.seq++, v });
    let i = items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (!less(items[i], items[parent])) break;
      [items[i], items[parent]] = [items[parent], items[i]];
      i = parent;
    }
  }

  pop(): { p: number; v: number } {
    const items = this.items;
    const top = items[0];
    const last = items.pop()!;
    if (items.length > 0) {
      items[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < items.length && less(items[l], items[m])) m = l;
        if (r < items.length && less(items[r], items[m])) m = r;
        if (m === i) break;
        [items[i], items[m]] = [items[m], items[i]];
        i = m;
      }
    }
    return top;
  }
}

function less(a: { p: number; seq: number }, b: { p: number; seq: number }): boolean {
  return a.p < b.p || (a.p === b.p && a.seq < b.seq);
}

/**
 * A* over begaanbare tegels. Geeft de tegels na `start` tot en met `goal` terug,
 * een lege lijst als start === goal, of null als het doel onbereikbaar is.
 */
export function findPath(walk: WalkGrid, start: number, goal: number): number[] | null {
  if (start === goal) return [];
  if (!walk.walkable[goal]) return null;
  const n = walk.width * walk.height;
  const g = new Float64Array(n).fill(Infinity);
  const came = new Int32Array(n).fill(-1);
  const closed = new Uint8Array(n);
  const gx = goal % walk.width;
  const gy = (goal - gx) / walk.width;
  const h = (i: number) => {
    const x = i % walk.width;
    const y = (i - x) / walk.width;
    return (Math.abs(x - gx) + Math.abs(y - gy)) * PATH_COST;
  };
  const open = new MinHeap();
  g[start] = 0;
  open.push(start, h(start));
  while (open.size > 0) {
    const { v: cur } = open.pop();
    if (cur === goal) break;
    if (closed[cur]) continue;
    closed[cur] = 1;
    const x = cur % walk.width;
    const y = (cur - x) / walk.width;
    for (let d = 0; d < 4; d++) {
      const nx = x + DX[d];
      const ny = y + DY[d];
      if (nx < 0 || ny < 0 || nx >= walk.width || ny >= walk.height) continue;
      const j = ny * walk.width + nx;
      if (!walk.walkable[j] || closed[j]) continue;
      const cost = g[cur] + walk.enterCost[j];
      if (cost < g[j]) {
        g[j] = cost;
        came[j] = cur;
        open.push(j, cost + h(j));
      }
    }
  }
  if (came[goal] < 0) return null;
  const path: number[] = [];
  for (let c = goal; c !== start; c = came[c]) path.push(c);
  path.reverse();
  return path;
}

/**
 * Dijkstra-kostenveld naar `target`: field[i] = minimale kosten om van i naar target te lopen.
 * Infinity = onbereikbaar. Eén veld per voorziening maakt keuzes en routes goedkoop.
 */
export function costField(walk: WalkGrid, target: number): Float32Array {
  const n = walk.width * walk.height;
  const dist = new Float32Array(n).fill(Infinity);
  if (!walk.walkable[target]) return dist;
  dist[target] = 0;
  const heap = new MinHeap();
  heap.push(target, 0);
  while (heap.size > 0) {
    const { v, p } = heap.pop();
    if (p > dist[v]) continue;
    const x = v % walk.width;
    const y = (v - x) / walk.width;
    // Vanaf buur u naar v lopen kost enterCost[v].
    const step = dist[v] + walk.enterCost[v];
    for (let d = 0; d < 4; d++) {
      const nx = x + DX[d];
      const ny = y + DY[d];
      if (nx < 0 || ny < 0 || nx >= walk.width || ny >= walk.height) continue;
      const u = ny * walk.width + nx;
      if (!walk.walkable[u]) continue;
      if (step < dist[u]) {
        dist[u] = step;
        heap.push(u, step);
      }
    }
  }
  return dist;
}

/** Volgt het kostenveld vanaf `start` naar het doel (dist 0). */
export function pathFromField(walk: WalkGrid, field: Float32Array, start: number): number[] | null {
  if (!Number.isFinite(field[start])) return null;
  const path: number[] = [];
  let cur = start;
  let guard = walk.width * walk.height;
  while (field[cur] > 0 && guard-- > 0) {
    const x = cur % walk.width;
    const y = (cur - x) / walk.width;
    let best = -1;
    let bestCost = Infinity;
    for (let d = 0; d < 4; d++) {
      const nx = x + DX[d];
      const ny = y + DY[d];
      if (nx < 0 || ny < 0 || nx >= walk.width || ny >= walk.height) continue;
      const j = ny * walk.width + nx;
      if (!walk.walkable[j]) continue;
      const c = field[j] + walk.enterCost[j];
      if (c < bestCost - 1e-6) {
        bestCost = c;
        best = j;
      }
    }
    if (best < 0) return null;
    path.push(best);
    cur = best;
  }
  return path;
}

/** Kopie met gelijke kosten per tegel (kortste aantal tegels). */
export function uniformWalk(walk: WalkGrid): WalkGrid {
  return { ...walk, enterCost: new Float32Array(walk.width * walk.height).fill(1) };
}
