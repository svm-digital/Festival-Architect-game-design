import { useCallback, useEffect, useRef, useState } from 'react';
import { getAct, hasQueue, isPost, PRODUCTS } from '../model/catalog';
import type { FacilityType, PostType } from '../model/types';
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
  visitorTotal: number;
  avgSatisfaction: number;
  noGoal: number;
  revenue: { tickets: number; food: number; bar: number; merch: number; total: number };
  incidents: { open: number; handled: number; unhandled: number };
  stages: { id: string; name: string; watching: number; actName: string | null }[];
  queues: { id: string; name: string; type: FacilityType; waiting: number; serving: number; capacity: number; reachable: boolean }[];
  seating: { id: string; name: string; used: number; capacity: number; reachable: boolean }[];
  posts: { id: string; name: string; type: PostType; busy: number; staff: number; reachable: boolean }[];
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
  const sales = s.metrics.sales;
  const revenue = {
    tickets: arrivedTotal * s.input.demand.ticketPrice,
    food: sales.food * PRODUCTS.food.price,
    bar: sales.bar * PRODUCTS.bar.price,
    merch: sales.merch * PRODUCTS.merch.price,
    total: 0,
  };
  revenue.total = revenue.tickets + revenue.food + revenue.bar + revenue.merch;
  const facs = s.facilityOrder.map((id) => s.facilities[id]);
  return {
    tick: s.tick,
    totalTicks: s.totalTicks,
    clock: formatClock(scenario, minute),
    onSite,
    arrivedTotal,
    visitorTotal: s.visitors.length,
    avgSatisfaction: onSite ? sat / onSite : 0,
    noGoal,
    revenue,
    incidents: {
      open: s.incidents.filter((i) => i.outcome === 'open').length,
      handled: s.incidents.filter((i) => i.outcome === 'handled').length,
      unhandled: s.incidents.filter((i) => i.outcome === 'unhandled').length,
    },
    stages: s.stageIds.map((id) => {
      const perf = activePerformance(program, scenario, id, minute);
      return { id, name: s.facilities[id].name, watching: watching[id] ?? 0, actName: perf ? (getAct(perf.actId)?.name ?? null) : null };
    }),
    queues: facs
      .filter((f) => hasQueue(f.type))
      .map((f) => ({ id: f.id, name: f.name, type: f.type, waiting: f.queue.length, serving: f.serving.length, capacity: f.capacity, reachable: f.reachable })),
    seating: facs
      .filter((f) => f.type === 'seating')
      .map((f) => ({ id: f.id, name: f.name, used: f.occupants.length, capacity: f.capacity, reachable: f.reachable })),
    posts: facs
      .filter((f) => isPost(f.type))
      .map((f) => ({
        id: f.id,
        name: f.name,
        type: f.type as PostType,
        busy: f.staffIds.filter((sid) => s.staff[sid].state !== 'idle').length,
        staff: f.staffIds.length,
        reachable: f.reachable,
      })),
  };
}

/**
 * Beheert één simulatierun. De update-loop (deze hook) en de render-loop (FestivalCanvas)
 * zijn twee losse requestAnimationFrame-lussen; de renderer leest alleen `runnerRef`.
 */
export function useSimulation(onReport: (r: FinalReport, s: SimulationState) => void) {
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
      onReportRef.current(buildReport(s), s);
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
