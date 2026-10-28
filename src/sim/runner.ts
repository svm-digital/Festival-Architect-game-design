import { MS_PER_TICK_AT_1X } from './clock';
import { step } from './simulation';
import type { SimulationState } from './types';

export type Speed = 1 | 2 | 4;

/** Echte tijd per aanroep wordt begrensd, zodat een verborgen tabblad geen inhaalspiraal veroorzaakt. */
export const MAX_FRAME_MS = 250;

/**
 * Fixed-timestep runner. Echte tijd × snelheid vult een accumulator; per volle
 * MS_PER_TICK_AT_1X wordt precies één `step` uitgevoerd. Snelheid bepaalt dus alleen
 * hoeveel ticks per seconde draaien, nooit wat een tick doet.
 * De runner kent geen DOM; de browser-loop roept `advance` aan.
 */
export class SimulationRunner {
  running = false;
  speed: Speed = 1;
  private accumulator = 0;

  constructor(
    public readonly state: SimulationState,
    private readonly onFinished?: (s: SimulationState) => void,
  ) {}

  start(): void {
    if (!this.state.finished) this.running = true;
  }

  pause(): void {
    this.running = false;
  }

  setSpeed(speed: Speed): void {
    this.speed = speed;
  }

  /** Interpolatiefactor voor de renderer (0–1). Blijft staan tijdens pauze. */
  get alpha(): number {
    return Math.min(1, this.accumulator / MS_PER_TICK_AT_1X);
  }

  /** Verwerkt verstreken echte tijd. Geeft het aantal uitgevoerde ticks terug. */
  advance(realMs: number): number {
    if (!this.running || this.state.finished) return 0;
    this.accumulator += Math.min(Math.max(realMs, 0), MAX_FRAME_MS) * this.speed;
    let steps = 0;
    while (this.accumulator >= MS_PER_TICK_AT_1X) {
      step(this.state);
      this.accumulator -= MS_PER_TICK_AT_1X;
      steps += 1;
      if (this.state.finished) {
        this.running = false;
        this.accumulator = 0;
        this.onFinished?.(this.state);
        break;
      }
    }
    return steps;
  }
}
