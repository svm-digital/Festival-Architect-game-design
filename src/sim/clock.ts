import type { Performance, Program, ScenarioSettings } from '../model/types';

/** Fixed timestep: 1 tick = 0,1 spelminuut. */
export const TICKS_PER_MINUTE = 10;
/** Echte milliseconden per tick bij snelheid 1×. */
export const MS_PER_TICK_AT_1X = 100;

export function minuteToTick(minute: number): number {
  return Math.round(minute * TICKS_PER_MINUTE);
}

export function tickToMinute(tick: number): number {
  return tick / TICKS_PER_MINUTE;
}

export function festivalEndTick(s: ScenarioSettings): number {
  return minuteToTick(s.festivalMinutes);
}

export function totalTicks(s: ScenarioSettings): number {
  return minuteToTick(s.festivalMinutes + s.exitWindowMinutes);
}

export function formatClock(s: ScenarioSettings, minute: number): string {
  const total = Math.floor(s.clockStartMinutes + minute);
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function slotLabel(s: ScenarioSettings, slot: number): string {
  const sl = s.slots[slot];
  return `${formatClock(s, sl.startMinute)}–${formatClock(s, sl.endMinute)}`;
}

/** Optreden dat op `minute` speelt op dit podium. */
export function activePerformance(
  program: Program,
  s: ScenarioSettings,
  stageId: string,
  minute: number,
): Performance | null {
  for (const p of program.performances) {
    if (p.stageId !== stageId) continue;
    const sl = s.slots[p.slot];
    if (sl && minute >= sl.startMinute && minute < sl.endMinute) return p;
  }
  return null;
}

/** Optreden dat binnen `within` minuten na `minute` begint. */
export function upcomingPerformance(
  program: Program,
  s: ScenarioSettings,
  stageId: string,
  minute: number,
  within: number,
): Performance | null {
  for (const p of program.performances) {
    if (p.stageId !== stageId) continue;
    const sl = s.slots[p.slot];
    if (sl && sl.startMinute > minute && sl.startMinute - minute <= within) return p;
  }
  return null;
}
