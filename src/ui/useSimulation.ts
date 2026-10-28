import { useCallback, useEffect, useRef, useState } from 'react';
import { getAct } from '../model/catalog';
import { activePerformance, formatClock, tickToMinute } from '../sim/clock';
import { buildReport } from '../sim/report';
import { SimulationRunner, type Speed } from '../sim/runner';
import { createSimulation } from '../sim/simulation';
import type { FinalReport, SimulationInput, SimulationState } from '../sim/types';

export type SimStatus = 'idle' | 'paused' | 'running' | 'finished';

export interface LiveStats {
  tick: number;
  totalTicks: number;
  clock: string;
  onSite: number;
  arrivedTotal: number;
  avgSatisfaction: number;
  noGoal: number;
  stages: { id: string; name: string; watching: number; actName: string | null }[];
  queues: { id: string; name: string; type: string; waiting: number; serving: number; capacity: number; reachable: boolean }[];
  seating: { id: string; name: string; used: number; capacity: number; reachable: boolean }[];
}

function computeStats(s: SimulationState): LiveStats {
  const minute = tickToMinute(s.tick);
  let onSite = 0;
  let sat = 0;
  let noGoal = 0;
  let arrivedTotal = 0;
  const watching: Record<string, number> = {};
  for (const v of s.visitors) {
    if (v.phase !== 'pending') arrivedTotal++;
    if (v.phase !== 'onSite') continue;
    onSite++;
    sat += v.satisfaction;
    if (v.unmetNeeds.length) noGoal++;
    if (v.state === 'Watching' && v.goal?.facilityId) watching[v.goal.facilityId] = (watching[v.goal.facilityId] ?? 0) + 1;
  }
  const { program, scenario } = s.input;
  return {
    tick: s.tick,
    totalTicks: s.totalTicks,
    clock: formatClock(scenario, minute),
    onSite,
    arrivedTotal,
    avgSatisfaction: onSite ? sat / onSite : 0,
    noGoal,
    stages: s.stageIds.map((id) => {
      const perf = activePerformance(program, scenario, id, minute);
      return { id, name: s.facilities[id].name, watching: watching[id] ?? 0, actName: perf ? (getAct(perf.actId)?.name ?? null) : null };
    }),
    queues: s.facilityOrder
      .map((id) => s.facilities[id])
      .filter((f) => f.type === 'food' || f.type === 'toilet')
      .map((f) => ({ id: f.id, name: f.name, type: f.type, waiting: f.queue.length, serving: f.serving.length, capacity: f.capacity, reachable: f.reachable })),
    seating: s.facilityOrder
      .map((id) => s.facilities[id])
      .filter((f) => f.type === 'seating')
      .map((f) => ({ id: f.id, name: f.name, used: f.occupants.length, capacity: f.capacity, reachable: f.reachable })),
  };
}

/**
 * Beheert één simulatierun. De update-loop (deze hook) en de render-loop (FestivalCanvas)
 * zijn twee losse requestAnimationFrame-lussen; de renderer leest alleen `runnerRef`.
 */
export function useSimulation(onReport: (r: FinalReport) => void) {
  const runnerRef = useRef<SimulationRunner | null>(null);
  const [status, setStatus] = useState<SimStatus>('idle');
  const [speed, setSpeedState] = useState<Speed>(1);
  const [stats, setStats] = useState<LiveStats | null>(null);
  const onReportRef = useRef(onReport);
  useEffect(() => {
    onReportRef.current = onReport;
  }, [onReport]);

  const load = useCallback((input: SimulationInput, initialSpeed: Speed) => {
    const runner = new SimulationRunner(createSimulation(input), (s) => {
      setStatus('finished');
      setStats(computeStats(s));
      onReportRef.current(buildReport(s));
    });
    runner.setSpeed(initialSpeed);
    runnerRef.current = runner;
    setStats(computeStats(runner.state));
    setStatus('paused');
  }, []);

  const clear = useCallback(() => {
    runnerRef.current = null;
    setStats(null);
    setStatus('idle');
  }, []);

  const start = useCallback(() => {
    const r = runnerRef.current;
    if (!r || r.state.finished) return;
    r.start();
    setStatus('running');
  }, []);

  const pause = useCallback(() => {
    runnerRef.current?.pause();
    if (runnerRef.current && !runnerRef.current.state.finished) setStatus('paused');
  }, []);

  const setSpeed = useCallback((sp: Speed) => {
    runnerRef.current?.setSpeed(sp);
    setSpeedState(sp);
  }, []);

  // Update-loop
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      runnerRef.current?.advance(now - last);
      last = now;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Statistieken voor React, 4× per seconde
  useEffect(() => {
    const id = window.setInterval(() => {
      const r = runnerRef.current;
      if (r && r.running) setStats(computeStats(r.state));
    }, 250);
    return () => window.clearInterval(id);
  }, []);

  return { runnerRef, status, speed, stats, load, clear, start, pause, setSpeed };
}
