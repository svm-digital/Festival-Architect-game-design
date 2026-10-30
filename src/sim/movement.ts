import type { WalkGrid } from '../model/reachability';
import type { Mover } from './types';

/**
 * Beweegt een mover één tick langs zijn pad (4-buren, dus altijd langs één as).
 * `speedFor(tile)` geeft tegels per tick bij het betreden van die tegel.
 * Geeft true als het einde van het pad is bereikt.
 */
export function stepAlongPath(walk: WalkGrid, m: Mover, speedFor: (tile: number) => number): boolean {
  const W = walk.width;
  let remaining = 1; // fractie van deze tick
  while (m.pathIndex < m.path.length && remaining > 0) {
    const target = m.path[m.pathIndex];
    const tx = (target % W) + 0.5;
    const ty = Math.floor(target / W) + 0.5;
    const speed = speedFor(target);
    const dist = Math.abs(tx - m.x) + Math.abs(ty - m.y);
    const reach = speed * remaining;
    if (dist <= reach) {
      m.x = tx;
      m.y = ty;
      m.tile = target;
      m.pathIndex += 1;
      remaining -= dist / speed;
    } else {
      const f = reach / dist;
      m.x += (tx - m.x) * f;
      m.y += (ty - m.y) * f;
      remaining = 0;
    }
  }
  return m.pathIndex >= m.path.length;
}
