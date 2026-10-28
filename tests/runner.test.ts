import { describe, expect, it } from 'vitest';
import { MS_PER_TICK_AT_1X } from '../src/sim/clock';
import { SimulationRunner } from '../src/sim/runner';
import { createSimulation, hashState, runToEnd } from '../src/sim/simulation';
import { exampleInput } from './helpers';

describe('runner: pauze en snelheid', () => {
  it('pauze stopt de simulatietijd volledig (criterium 5)', () => {
    const r = new SimulationRunner(createSimulation(exampleInput()));
    r.start();
    for (let i = 0; i < 10; i++) r.advance(100);
    const tick = r.state.tick;
    const hash = hashState(r.state);
    expect(tick).toBe(10);
    r.pause();
    const alpha = r.alpha;
    for (let i = 0; i < 50; i++) expect(r.advance(200)).toBe(0);
    expect(r.state.tick).toBe(tick);
    expect(hashState(r.state)).toBe(hash);
    expect(r.alpha).toBe(alpha);
    r.start();
    r.advance(100);
    expect(r.state.tick).toBe(tick + 1);
  });

  it('snelheid bepaalt alleen het aantal ticks per seconde', () => {
    for (const speed of [1, 2, 4] as const) {
      const r = new SimulationRunner(createSimulation(exampleInput()));
      r.setSpeed(speed);
      r.start();
      for (let i = 0; i < 20; i++) r.advance(50); // 1 seconde echte tijd
      expect(r.state.tick).toBe((1000 / MS_PER_TICK_AT_1X) * speed);
    }
  });

  it('versnellen verandert de uitkomst niet (criterium 6)', () => {
    const reference = hashState(runToEnd(createSimulation(exampleInput())));
    const runWith = (speed: 1 | 2 | 4, frameMs: number) => {
      const r = new SimulationRunner(createSimulation(exampleInput()));
      r.setSpeed(speed);
      r.start();
      let frames = 0;
      while (!r.state.finished) {
        // Wissel halverwege van snelheid om ook dat te dekken.
        if (frames === 300) r.setSpeed(speed === 4 ? 1 : 4);
        r.advance(frameMs);
        frames++;
      }
      return hashState(r.state);
    };
    expect(runWith(1, 100)).toBe(reference);
    expect(runWith(2, 16.7)).toBe(reference);
    expect(runWith(4, 33)).toBe(reference);
  });

  it('begrenst grote frametijden en meldt het einde', () => {
    let finished = 0;
    const r = new SimulationRunner(createSimulation(exampleInput()), () => finished++);
    r.start();
    expect(r.advance(10_000)).toBe(2); // begrensd op 250 ms → 2 ticks
    while (!r.state.finished) r.advance(250);
    expect(finished).toBe(1);
    expect(r.running).toBe(false);
    expect(r.advance(1000)).toBe(0);
  });
});
