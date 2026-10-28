import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { computeSpent } from '../model/budget';
import { FACILITY_DEFS, formatEuro } from '../model/catalog';
import {
  designSignature,
  erasePath,
  facilityAt,
  paintPath,
  placeFacility,
  pruneProgram,
  removeFacility,
} from '../model/layout';
import { centeredCandidate, snapEntrance, validatePathPaint, validatePlacement } from '../model/placement';
import { validateForSimulation } from '../model/reachability';
import { COMPACT_SCENARIO, createEmptyLayout, createExampleDesign, DEFAULT_SEED } from '../model/scenario';
import type { Facing, Point, Program, ScenarioSettings } from '../model/types';
import type { FinalReport, SimulationInput } from '../sim/types';
import { AUTOSAVE_NAME, readSave, writeSave, type SaveFile } from '../storage/saves';
import { BuildPanel, type Tool } from './BuildPanel';
import { Button } from './components';
import { FestivalCanvas, type FrameInput } from './FestivalCanvas';
import { ProgramPanel } from './ProgramPanel';
import { ReportPanel } from './ReportPanel';
import { SavePanel } from './SavePanel';
import { SimPanel } from './SimPanel';
import { useSimulation } from './useSimulation';

type Mode = 'build' | 'program' | 'simulate' | 'report';

const TILE = 28;
const ROTATION: Facing[] = ['south', 'west', 'north', 'east'];

/** 4-verbonden lijn tussen twee tegels, zodat snel slepen geen gaten in paden laat. */
function tileLine(a: Point, b: Point): Point[] {
  const out: Point[] = [];
  let { x, y } = a;
  out.push({ x, y });
  while (x !== b.x || y !== b.y) {
    if (Math.abs(b.x - x) >= Math.abs(b.y - y)) x += Math.sign(b.x - x);
    else y += Math.sign(b.y - y);
    out.push({ x, y });
  }
  return out;
}

export default function App() {
  const [scenario, setScenario] = useState<ScenarioSettings>(COMPACT_SCENARIO);
  const [layout, setLayout] = useState(() => createEmptyLayout(COMPACT_SCENARIO));
  const [program, setProgram] = useState<Program>({ performances: [] });
  const [seed, setSeed] = useState(DEFAULT_SEED);
  const [mode, setMode] = useState<Mode>('build');
  const [tool, setTool] = useState<Tool>({ kind: 'select' });
  const [facing, setFacing] = useState<Facing>('south');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hover, setHover] = useState<Point | null>(null);
  const [showReach, setShowReach] = useState(true);
  const [showZones, setShowZones] = useState(false);
  const [showHeat, setShowHeat] = useState(false);
  const [lastReport, setLastReport] = useState<FinalReport | null>(null);
  const [highlightTile, setHighlightTile] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);
  const painting = useRef<{ erase: boolean; last: Point } | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);

  const notify = useCallback((msg: string) => {
    setToast(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2800);
  }, []);

  const effectiveProgram = useMemo(() => pruneProgram(program, layout, scenario), [program, layout, scenario]);
  const validation = useMemo(() => validateForSimulation(layout, effectiveProgram, scenario), [layout, effectiveProgram, scenario]);
  const spent = useMemo(() => computeSpent(layout, scenario), [layout, scenario]);
  const visitorCount = Math.min(scenario.visitorCount, scenario.maxVisitors);
  const signature = designSignature(layout, effectiveProgram, seed, visitorCount);
  const stages = layout.facilities.filter((f) => f.type === 'stage');
  const selected = layout.facilities.find((f) => f.id === selectedId) ?? null;

  const onReport = useCallback((r: FinalReport) => {
    setLastReport(r);
    setShowHeat(true);
    setMode('report');
  }, []);
  const sim = useSimulation(onReport);

  // ── Autosave ─────────────────────────────────────────────────────────────
  const applySave = useCallback(
    (s: SaveFile) => {
      sim.clear();
      setScenario({ ...COMPACT_SCENARIO, visitorCount: s.scenario.visitorCount });
      setLayout(s.layout);
      setProgram(s.program);
      setSeed(s.seed);
      setLastReport(s.lastReport);
      setSelectedId(null);
      setMode('build');
    },
    [sim],
  );

  useEffect(() => {
    let cancelled = false;
    readSave(AUTOSAVE_NAME)
      .then((s) => {
        if (s && !cancelled) applySave(s);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setRestored(true);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- alleen bij opstarten
  }, []);

  const makeSave = useCallback(
    (name: string): SaveFile => ({
      version: 1,
      name,
      savedAt: new Date().toISOString(),
      layout,
      program: effectiveProgram,
      scenario,
      seed,
      lastReport,
    }),
    [layout, effectiveProgram, scenario, seed, lastReport],
  );

  useEffect(() => {
    if (!restored) return;
    const id = window.setTimeout(() => {
      writeSave(makeSave(AUTOSAVE_NAME)).catch(() => undefined);
    }, 800);
    return () => window.clearTimeout(id);
  }, [restored, makeSave]);

  // ── Hover-preview ────────────────────────────────────────────────────────
  const preview = useMemo(() => {
    if (mode !== 'build' || !hover) return { facility: null, path: null, reasons: null as string[] | null };
    if (tool.kind === 'facility') {
      const shape = tool.type === 'entrance' ? snapEntrance(layout.grid, hover.x, hover.y) : centeredCandidate(tool.type, facing, hover.x, hover.y);
      const r = validatePlacement(layout, scenario, shape);
      return { facility: { shape, ok: r.ok }, path: null, reasons: r.reasons };
    }
    if (tool.kind === 'path') {
      const r = validatePathPaint(layout, scenario, hover.x, hover.y);
      const already = layout.grid.tiles[hover.y * layout.grid.width + hover.x] === 'path';
      return { facility: null, path: { ...hover, ok: r.ok || already, erase: false }, reasons: r.ok || already ? null : [r.reason!] };
    }
    if (tool.kind === 'erase') return { facility: null, path: { ...hover, ok: true, erase: true }, reasons: null };
    return { facility: null, path: null, reasons: null };
  }, [mode, hover, tool, facing, layout, scenario]);

  // ── Frame-input voor de render-loop ──────────────────────────────────────
  const frameRef = useRef<FrameInput | null>(null);
  const runnerRef = sim.runnerRef;
  useLayoutEffect(() => {
    const live = mode === 'simulate' || mode === 'report';
    const runnerLayout = runnerRef.current?.state.input.layout;
    const shownLayout = live && runnerLayout ? runnerLayout : layout;
    const reportHeat = mode === 'report' && lastReport ? lastReport.heat : null;
    frameRef.current = {
      layout: shownLayout,
      tileSize: TILE,
      hover: mode === 'build' ? hover : null,
      facilityPreview: preview.facility,
      pathPreview: preview.path,
      selectedId: mode === 'build' ? selectedId : null,
      overlays: { reachability: mode === 'build' && showReach, heatmap: live && showHeat, zones: mode !== 'simulate' && mode !== 'report' && showZones },
      analysis: validation.analysis,
      get sim() {
        return live ? (runnerRef.current?.state ?? null) : null;
      },
      get alpha() {
        return runnerRef.current?.alpha ?? 0;
      },
      get heat() {
        return reportHeat ?? (live ? (runnerRef.current?.state.metrics.heat ?? null) : null);
      },
      showAccess: mode === 'build',
      highlightTile: mode === 'report' ? highlightTile : null,
    };
  });

  // ── Interactie ───────────────────────────────────────────────────────────
  const applyPaint = useCallback(
    (tiles: Point[], erase: boolean) => {
      setLayout((prev) => tiles.reduce((acc, t) => (erase ? erasePath(acc, t.x, t.y) : paintPath(acc, scenario, t.x, t.y)), prev));
    },
    [scenario],
  );

  const onPointerDown = (t: Point, button: number) => {
    if (mode !== 'build') return;
    if (button === 2) {
      setTool({ kind: 'select' });
      return;
    }
    if (tool.kind === 'select') {
      setSelectedId(facilityAt(layout, t.x, t.y)?.id ?? null);
    } else if (tool.kind === 'path' || tool.kind === 'erase') {
      painting.current = { erase: tool.kind === 'erase', last: t };
      if (tool.kind === 'path') {
        const r = validatePathPaint(layout, scenario, t.x, t.y);
        if (!r.ok && r.reason && !r.reason.startsWith('Hier ligt al')) notify(r.reason);
      }
      applyPaint([t], tool.kind === 'erase');
    } else {
      const shape = tool.type === 'entrance' ? snapEntrance(layout.grid, t.x, t.y) : centeredCandidate(tool.type, facing, t.x, t.y);
      const r = placeFacility(layout, scenario, shape);
      if (r.facility) {
        setLayout(r.layout);
        setSelectedId(r.facility.id);
        notify(`${r.facility.name} geplaatst · ${formatEuro(r.result.cost)}`);
        const def = FACILITY_DEFS[tool.type];
        const count = r.layout.facilities.filter((f) => f.type === tool.type).length;
        if (def.maxCount !== null && count >= def.maxCount) setTool({ kind: 'select' });
      } else {
        notify(`Kan hier niet bouwen: ${r.result.reasons[0]}`);
      }
    }
  };

  const onPointerDrag = (t: Point) => {
    const p = painting.current;
    if (!p || mode !== 'build') return;
    applyPaint(tileLine(p.last, t).slice(1), p.erase);
    painting.current = { ...p, last: t };
  };

  const deleteFacility = useCallback(
    (id: string) => {
      const f = layout.facilities.find((x) => x.id === id);
      setLayout((prev) => removeFacility(prev, id));
      setSelectedId(null);
      if (f) notify(`${f.name} verwijderd · ${formatEuro(FACILITY_DEFS[f.type].cost)} terug`);
    },
    [layout, notify],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (mode !== 'build') return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if (e.key === 'r' || e.key === 'R') setFacing((f) => ROTATION[(ROTATION.indexOf(f) + 1) % 4]);
      else if (e.key === 'Escape') {
        setTool({ kind: 'select' });
        setSelectedId(null);
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) deleteFacility(selectedId);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode, selectedId, deleteFacility]);

  // ── Modi ─────────────────────────────────────────────────────────────────
  const currentInput = (): SimulationInput => ({ layout, program: effectiveProgram, scenario, seed });

  const goBuild = () => {
    sim.clear();
    setMode('build');
  };
  const goProgram = () => {
    sim.clear();
    setMode('program');
  };
  const goSimulate = (autostart = false) => {
    if (!validation.ok) {
      notify(validation.issues.find((i) => i.severity === 'error')?.message ?? 'Ontwerp is nog niet klaar.');
      return;
    }
    sim.load(currentInput(), sim.speed);
    setSelectedId(null);
    setTool({ kind: 'select' });
    setShowHeat(false);
    setMode('simulate');
    if (autostart) sim.start();
  };
  const resetRun = () => {
    const input = sim.runnerRef.current?.state.input ?? currentInput();
    sim.load(input, sim.speed);
  };

  const steps: { id: Mode; label: string; enabled: boolean }[] = [
    { id: 'build', label: '1 · Terrein', enabled: true },
    { id: 'program', label: '2 · Programma', enabled: true },
    { id: 'simulate', label: '3 · Simulatie', enabled: validation.ok },
    { id: 'report', label: '4 · Rapport', enabled: lastReport !== null },
  ];

  const hint =
    mode === 'build'
      ? tool.kind === 'facility'
        ? 'Klik om te plaatsen · R draait de toegang · rechtsklik of Esc stopt'
        : tool.kind === 'path'
          ? 'Klik en sleep om paden te tekenen'
          : tool.kind === 'erase'
            ? 'Klik en sleep om paden te wissen'
            : 'Klik op een voorziening om te selecteren · Del verwijdert'
      : mode === 'simulate'
        ? 'Het terrein is vergrendeld tijdens de simulatie'
        : mode === 'report'
          ? 'Heatmap: cumulatieve tegelbezetting (bezoekersminuten)'
          : 'Stel per podium en tijdslot een act in';

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <header className="border-b border-white/5 bg-slate-950/60">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div>
            <h1 className="text-lg font-bold tracking-tight text-amber-200">Festival Architect</h1>
            <p className="text-xs text-slate-400">
              Scenario: {scenario.goal} · fictieve game
            </p>
          </div>
          <nav className="flex flex-wrap gap-1.5">
            {steps.map((s) => (
              <Button
                key={s.id}
                variant={mode === s.id ? 'primary' : 'ghost'}
                disabled={!s.enabled}
                onClick={() => {
                  if (s.id === mode) return;
                  if (s.id === 'build') goBuild();
                  else if (s.id === 'program') goProgram();
                  else if (s.id === 'simulate') goSimulate();
                  else {
                    setShowHeat(true);
                    setMode('report');
                  }
                }}
              >
                {s.label}
              </Button>
            ))}
          </nav>
          <div className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300 tabular-nums ring-1 ring-white/10">
            Budget over <span className={scenario.budget - spent < 0 ? 'text-rose-300' : 'text-emerald-300'}>{formatEuro(scenario.budget - spent)}</span>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-[1500px] flex-col gap-4 px-4 py-4 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1">
          <div className="relative rounded-2xl bg-gradient-to-b from-emerald-950/60 to-slate-900 p-3 ring-1 ring-white/5">
            <FestivalCanvas
              gridWidth={layout.grid.width}
              gridHeight={layout.grid.height}
              tileSize={TILE}
              frameRef={frameRef}
              interactive={mode === 'build'}
              onHover={setHover}
              onPointerDown={onPointerDown}
              onPointerDrag={onPointerDrag}
              onPointerUp={() => {
                painting.current = null;
              }}
            />
            {toast && (
              <div className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-slate-950/90 px-4 py-1.5 text-sm text-slate-100 shadow-lg ring-1 ring-white/10">
                {toast}
              </div>
            )}
          </div>
          <div className="mt-2 flex flex-wrap justify-between gap-2 px-1 text-xs text-slate-500">
            <span>{hint}</span>
            {hover && mode === 'build' && (
              <span className="tabular-nums">
                tegel ({hover.x}, {hover.y})
              </span>
            )}
          </div>
        </div>

        <aside className="w-full shrink-0 lg:w-[400px]">
          {mode === 'build' && (
            <div className="flex flex-col gap-3">
              <BuildPanel
                layout={layout}
                budget={scenario.budget}
                spent={spent}
                pathTileCost={scenario.pathTileCost}
                tool={tool}
                setTool={setTool}
                facing={facing}
                rotate={() => setFacing((f) => ROTATION[(ROTATION.indexOf(f) + 1) % 4])}
                hoverReasons={preview.reasons}
                selected={selected}
                onDelete={deleteFacility}
                analysis={validation.analysis}
                issues={validation.issues}
                onFocusFacility={(id) => {
                  setTool({ kind: 'select' });
                  setSelectedId(id);
                  setShowReach(true);
                }}
                showReach={showReach}
                setShowReach={setShowReach}
                showZones={showZones}
                setShowZones={setShowZones}
                onLoadExample={() => {
                  const ex = createExampleDesign(scenario);
                  setLayout(ex.layout);
                  setProgram(ex.program);
                  setSelectedId(null);
                  notify('Voorbeeldontwerp geladen');
                }}
                onClear={() => {
                  setLayout(createEmptyLayout(scenario));
                  setProgram({ performances: [] });
                  setSelectedId(null);
                  notify('Terrein leeggemaakt');
                }}
                onNext={goProgram}
              />
              <SavePanel
                onSave={async (name) => {
                  await writeSave(makeSave(name));
                  notify(`Opgeslagen als “${name}”`);
                }}
                onLoad={async (name) => {
                  const s = await readSave(name);
                  if (s) {
                    applySave(s);
                    notify(`“${name}” geladen`);
                  }
                }}
              />
            </div>
          )}
          {mode === 'program' && (
            <ProgramPanel
              scenario={scenario}
              stages={stages}
              program={effectiveProgram}
              setProgram={setProgram}
              seed={seed}
              setSeed={setSeed}
              visitorCount={visitorCount}
              setVisitorCount={(n) => setScenario((s) => ({ ...s, visitorCount: n }))}
              issues={validation.issues}
              canSimulate={validation.ok}
              onBack={goBuild}
              onSimulate={() => goSimulate()}
            />
          )}
          {mode === 'simulate' && (
            <SimPanel
              stats={sim.stats}
              status={sim.status}
              speed={sim.speed}
              seed={sim.runnerRef.current?.state.input.seed ?? seed}
              visitorCount={sim.runnerRef.current?.state.visitors.length ?? visitorCount}
              onStart={sim.start}
              onPause={sim.pause}
              onSpeed={sim.setSpeed}
              onReset={resetRun}
              onBackToBuild={goBuild}
              onShowReport={() => setMode('report')}
              showHeat={showHeat}
              setShowHeat={setShowHeat}
            />
          )}
          {mode === 'report' && lastReport && (
            <ReportPanel
              report={lastReport}
              scenario={scenario}
              outdated={lastReport.signature !== signature}
              onEdit={goBuild}
              onRerun={() => goSimulate(true)}
              onHighlightTile={setHighlightTile}
              showHeat={showHeat}
              setShowHeat={setShowHeat}
            />
          )}
        </aside>
      </main>
    </div>
  );
}
