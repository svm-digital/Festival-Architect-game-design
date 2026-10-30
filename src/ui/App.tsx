import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  createCampaign,
  currentCapital,
  isBankrupt,
  lastEdition,
  nextEditionNumber,
  previousSatisfaction,
  recordEdition,
  averageWait,
  type Campaign,
  type EditionDraft,
} from '../game/campaign';
import { computeSpent, programCost } from '../model/budget';
import { FACILITY_DEFS, formatDecimal, formatEuro, isPost } from '../model/catalog';
import { computeDemand } from '../model/economy';
import { designSignature, erasePath, facilityAt, paintPath, placeFacility, pruneProgram, removeFacility } from '../model/layout';
import { centeredCandidate, snapEntrance, validatePathPaint, validatePlacement } from '../model/placement';
import { validateForSimulation } from '../model/reachability';
import { COMPACT_SCENARIO, createEmptyLayout, createExampleDesign, DEFAULT_SEED } from '../model/scenario';
import type { Facing, FestivalLayout, Point, PostType, Program } from '../model/types';
import { coverageMinutes } from '../sim/incidents';
import type { FinalReport, SimulationInput, SimulationState } from '../sim/types';
import { AUTOSAVE_NAME, readSave, writeSave, type SaveFile } from '../storage/saves';
import { BuildPanel, type Tool } from './BuildPanel';
import { Button } from './components';
import { EditionsPanel } from './EditionsPanel';
import { FestivalCanvas, type FrameInput } from './FestivalCanvas';
import { KpiStrip, type KpiItem } from './KpiStrip';
import { ProgramPanel } from './ProgramPanel';
import { ReportPanel } from './ReportPanel';
import { SavePanel } from './SavePanel';
import { SimPanel } from './SimPanel';
import { useSimulation } from './useSimulation';

type Mode = 'build' | 'program' | 'simulate' | 'report' | 'editions';

const S = COMPACT_SCENARIO;
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

function freshCampaign(name = 'Mijn festival'): Campaign {
  return createCampaign(name, S, { layout: createEmptyLayout(S), program: { performances: [] }, seed: DEFAULT_SEED });
}

interface RunReport {
  report: FinalReport;
  trial: boolean;
  editionNumber: number | null;
}

export default function App() {
  const [campaign, setCampaign] = useState<Campaign>(() => freshCampaign());
  const [mode, setMode] = useState<Mode>('build');
  const [tool, setTool] = useState<Tool>({ kind: 'select' });
  const [facing, setFacing] = useState<Facing>('south');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hover, setHover] = useState<Point | null>(null);
  const [showReach, setShowReach] = useState(true);
  const [showZones, setShowZones] = useState(false);
  const [showHeat, setShowHeat] = useState(false);
  const [coverageKind, setCoverageKind] = useState<PostType | null>(null);
  const [runReport, setRunReport] = useState<RunReport | null>(null);
  const [viewEdition, setViewEdition] = useState<number | null>(null);
  const [highlightTile, setHighlightTile] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);
  const [trial, setTrial] = useState(false);
  const painting = useRef<{ erase: boolean; last: Point } | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);
  const runMeta = useRef<{ trial: boolean; editionNumber: number }>({ trial: false, editionNumber: 1 });

  const notify = useCallback((msg: string) => {
    setToast(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2800);
  }, []);

  // ── Concept voor de volgende editie ──────────────────────────────────────
  const draft = campaign.draft;
  const layout = draft.layout;
  const updateDraft = useCallback((fn: (d: EditionDraft) => EditionDraft) => setCampaign((c) => ({ ...c, draft: fn(c.draft) })), []);
  const setLayout = useCallback(
    (u: FestivalLayout | ((l: FestivalLayout) => FestivalLayout)) =>
      updateDraft((d) => ({ ...d, layout: typeof u === 'function' ? u(d.layout) : u })),
    [updateDraft],
  );
  const setProgram = useCallback((program: Program) => updateDraft((d) => ({ ...d, program })), [updateDraft]);

  const editionNumber = nextEditionNumber(campaign);
  const capital = currentCapital(campaign);
  const prevSat = previousSatisfaction(campaign);
  const effectiveProgram = useMemo(() => pruneProgram(draft.program, layout, S), [draft.program, layout]);
  const demand = useMemo(() => computeDemand(S, effectiveProgram, draft.ticketPrice, prevSat), [effectiveProgram, draft.ticketPrice, prevSat]);
  const rent = useMemo(() => computeSpent(layout, S), [layout]);
  const fees = programCost(effectiveProgram);
  const buildBudget = capital - fees;
  const validation = useMemo(() => validateForSimulation(layout, effectiveProgram, S, capital), [layout, effectiveProgram, capital]);
  const signature = designSignature(layout, effectiveProgram, draft.seed, demand.visitors, draft.ticketPrice);
  const stages = layout.facilities.filter((f) => f.type === 'stage');
  const selected = layout.facilities.find((f) => f.id === selectedId) ?? null;
  const bankrupt = isBankrupt(campaign);

  // ── Simulatie ────────────────────────────────────────────────────────────
  const onReport = useCallback((report: FinalReport, state: SimulationState) => {
    const meta = runMeta.current;
    if (!meta.trial) {
      const input = state.input;
      const runDraft: EditionDraft = { layout: input.layout, program: input.program, ticketPrice: input.demand.ticketPrice, seed: input.seed };
      setCampaign((c) => recordEdition(c, runDraft, report, new Date().toISOString()));
    }
    setRunReport({ report, trial: meta.trial, editionNumber: meta.trial ? null : meta.editionNumber });
    setShowHeat(true);
    setMode('report');
  }, []);
  const sim = useSimulation(onReport);

  // ── Opslaan ──────────────────────────────────────────────────────────────
  const applySave = useCallback(
    (s: SaveFile) => {
      sim.clear();
      setCampaign(s.campaign);
      setRunReport(null);
      setViewEdition(null);
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

  useEffect(() => {
    if (!restored) return;
    const id = window.setTimeout(() => {
      writeSave({ version: 2, name: AUTOSAVE_NAME, savedAt: new Date().toISOString(), campaign }).catch(() => undefined);
    }, 800);
    return () => window.clearTimeout(id);
  }, [restored, campaign]);

  // ── Hover-preview en dekking ─────────────────────────────────────────────
  const preview = useMemo(() => {
    if (mode !== 'build' || !hover) return { facility: null, path: null, reasons: null as string[] | null };
    if (tool.kind === 'facility') {
      const shape = tool.type === 'entrance' ? snapEntrance(layout.grid, hover.x, hover.y) : centeredCandidate(tool.type, facing, hover.x, hover.y);
      const r = validatePlacement(layout, S, shape, buildBudget);
      return { facility: { shape, ok: r.ok }, path: null, reasons: r.reasons };
    }
    if (tool.kind === 'path') {
      const r = validatePathPaint(layout, S, hover.x, hover.y, buildBudget);
      const already = layout.grid.tiles[hover.y * layout.grid.width + hover.x] === 'path';
      return { facility: null, path: { ...hover, ok: r.ok || already, erase: false }, reasons: r.ok || already ? null : [r.reason!] };
    }
    if (tool.kind === 'erase') return { facility: null, path: { ...hover, ok: true, erase: true }, reasons: null };
    return { facility: null, path: null, reasons: null };
  }, [mode, hover, tool, facing, layout, buildBudget]);

  const autoCoverage: PostType | null =
    coverageKind ??
    (tool.kind === 'facility' && isPost(tool.type) ? tool.type : null) ??
    (selected && isPost(selected.type) ? selected.type : null);
  const coverage = useMemo(
    () => (mode === 'build' && autoCoverage ? { kind: autoCoverage, minutes: coverageMinutes(layout, autoCoverage) } : null),
    [mode, autoCoverage, layout],
  );

  // ── Frame-input voor de render-loop ──────────────────────────────────────
  const frameRef = useRef<FrameInput | null>(null);
  const runnerRef = sim.runnerRef;
  const viewed = mode === 'editions' && viewEdition !== null ? campaign.editions.find((e) => e.number === viewEdition) ?? null : null;
  useLayoutEffect(() => {
    const live = mode === 'simulate' || mode === 'report';
    const runnerLayout = runnerRef.current?.state.input.layout;
    const shownLayout = viewed ? viewed.layout : live && runnerLayout ? runnerLayout : layout;
    const staticHeat = viewed ? viewed.report.heat : mode === 'report' && runReport ? runReport.report.heat : null;
    frameRef.current = {
      layout: shownLayout,
      tileSize: TILE,
      hover: mode === 'build' ? hover : null,
      facilityPreview: preview.facility,
      pathPreview: preview.path,
      selectedId: mode === 'build' ? selectedId : null,
      overlays: {
        reachability: mode === 'build' && showReach,
        heatmap: (live || viewed !== null) && showHeat,
        zones: (mode === 'build' || mode === 'program') && showZones,
      },
      analysis: validation.analysis,
      get sim() {
        return live ? (runnerRef.current?.state ?? null) : null;
      },
      get alpha() {
        return runnerRef.current?.alpha ?? 0;
      },
      get heat() {
        return staticHeat ?? (live ? (runnerRef.current?.state.metrics.heat ?? null) : null);
      },
      showAccess: mode === 'build',
      highlightTile: mode === 'report' || viewed ? highlightTile : null,
      coverage,
    };
  });

  // ── Interactie ───────────────────────────────────────────────────────────
  const applyPaint = useCallback(
    (tiles: Point[], erase: boolean) => {
      setLayout((prev) => tiles.reduce((acc, t) => (erase ? erasePath(acc, t.x, t.y) : paintPath(acc, S, t.x, t.y, buildBudget)), prev));
    },
    [setLayout, buildBudget],
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
        const r = validatePathPaint(layout, S, t.x, t.y, buildBudget);
        if (!r.ok && r.reason && !r.reason.startsWith('Hier ligt al')) notify(r.reason);
      }
      applyPaint([t], tool.kind === 'erase');
    } else {
      const shape = tool.type === 'entrance' ? snapEntrance(layout.grid, t.x, t.y) : centeredCandidate(tool.type, facing, t.x, t.y);
      const r = placeFacility(layout, S, shape, buildBudget);
      if (r.facility) {
        setLayout(r.layout);
        setSelectedId(r.facility.id);
        notify(`${r.facility.name} geplaatst · ${formatEuro(r.result.cost)} per editie`);
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
      if (f) notify(`${f.name} verwijderd`);
    },
    [layout, notify, setLayout],
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
  const currentInput = (): SimulationInput => ({
    layout,
    program: effectiveProgram,
    scenario: S,
    seed: draft.seed,
    demand,
    capitalStart: capital,
  });

  const goBuild = () => {
    sim.clear();
    setViewEdition(null);
    setMode('build');
  };
  const goProgram = () => {
    sim.clear();
    setViewEdition(null);
    setMode('program');
  };
  const goSimulate = (asTrial: boolean, autostart = false) => {
    if (!validation.ok) {
      notify(validation.issues.find((i) => i.severity === 'error')?.message ?? 'Ontwerp is nog niet klaar.');
      return;
    }
    runMeta.current = { trial: asTrial, editionNumber };
    setTrial(asTrial);
    sim.load(currentInput(), sim.speed);
    setSelectedId(null);
    setTool({ kind: 'select' });
    setShowHeat(false);
    setViewEdition(null);
    setMode('simulate');
    if (autostart) sim.start();
  };
  const resetRun = () => {
    const input = sim.runnerRef.current?.state.input ?? currentInput();
    sim.load(input, sim.speed);
  };
  const newSeries = () => {
    if (!window.confirm('Nieuwe reeks starten? Alle edities van deze reeks worden gewist; het huidige ontwerp blijft staan als concept.')) return;
    sim.clear();
    setCampaign((c) => createCampaign(c.name, S, { layout: c.draft.layout, program: c.draft.program, seed: c.draft.seed, ticketPrice: c.draft.ticketPrice }));
    setRunReport(null);
    setViewEdition(null);
    setMode('build');
    notify(`Nieuwe reeks gestart met ${formatEuro(S.startCapital)}`);
  };

  const steps: { id: Mode; label: string; enabled: boolean }[] = [
    { id: 'build', label: '1 · Terrein', enabled: true },
    { id: 'program', label: '2 · Programma', enabled: true },
    { id: 'simulate', label: '3 · Simulatie', enabled: validation.ok },
    { id: 'report', label: '4 · Rapport', enabled: runReport !== null },
    { id: 'editions', label: `Edities (${campaign.editions.length})`, enabled: true },
  ];

  // ── KPI-balk ─────────────────────────────────────────────────────────────
  const last = lastEdition(campaign);
  const st = sim.stats;
  let kpis: KpiItem[];
  if (mode === 'simulate' && st) {
    kpis = [
      { label: 'Klok', value: st.clock, tone: 'accent' },
      { label: 'Op terrein', value: `${st.onSite} / ${st.visitorTotal}` },
      { label: 'Tevredenheid', value: st.onSite ? formatDecimal(st.avgSatisfaction, 0) : '–', hint: 'Gemiddelde, 0–100' },
      { label: 'Omzet', value: formatEuro(st.revenue.total), tone: 'good' },
      { label: 'Open meldingen', value: st.incidents.open, tone: st.incidents.open ? 'bad' : 'default' },
      { label: 'Zonder doel', value: st.noGoal, tone: st.noGoal ? 'bad' : 'default', hint: 'Behoefte zonder bereikbare voorziening' },
    ];
  } else if (mode === 'report' && runReport) {
    const r = runReport.report;
    kpis = [
      { label: runReport.trial ? 'Proefrun' : `Editie ${runReport.editionNumber}`, value: formatEuro(r.finance.result), tone: r.finance.result >= 0 ? 'good' : 'bad', hint: 'Resultaat' },
      { label: 'Kapitaal na afloop', value: formatEuro(r.finance.capitalEnd), tone: 'accent' },
      { label: 'Bezoekers', value: r.visitorCount },
      { label: 'Tevredenheid', value: formatDecimal(r.avgSatisfaction, 0) },
      { label: 'Gem. wachttijd', value: `${formatDecimal(averageWait(r))} min` },
      { label: 'Niet geholpen', value: r.incidents.reduce((a, i) => a + i.unhandled, 0) },
    ];
  } else {
    kpis = [
      { label: 'Volgende editie', value: editionNumber, tone: 'accent' },
      { label: 'Kapitaal', value: formatEuro(capital), tone: capital > 0 ? 'default' : 'bad' },
      { label: 'Vaste kosten', value: formatEuro(rent + fees), tone: rent + fees > capital ? 'bad' : 'default', hint: 'Huur terrein + gages' },
      { label: 'Ticketprijs', value: formatEuro(draft.ticketPrice) },
      { label: 'Verwachte bezoekers', value: `${demand.visitors}${demand.soldOut ? ' (vol)' : ''}` },
      {
        label: 'Vorige editie',
        value: last ? formatEuro(last.report.finance.result) : '–',
        tone: last ? (last.report.finance.result >= 0 ? 'good' : 'bad') : 'default',
        hint: 'Resultaat van de laatste editie',
      },
    ];
  }

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
        ? 'Het terrein is vergrendeld tijdens de simulatie · gekleurde vierkantjes zijn medewerkers, ringen zijn open meldingen'
        : mode === 'report' || viewed
          ? 'Heatmap: cumulatieve tegelbezetting (bezoekersminuten)'
          : mode === 'editions'
            ? 'Kies een editie om het ontwerp en de heatmap ervan te zien'
            : 'Stel ticketprijs en programma in';

  // ── Rapport-weergave ─────────────────────────────────────────────────────
  let reportView: React.ReactNode = null;
  if (mode === 'report' && runReport) {
    const n = runReport.editionNumber;
    const previous = runReport.trial ? (last?.report ?? null) : n !== null && n > 1 ? (campaign.editions[n - 2]?.report ?? null) : null;
    const previousLabel = runReport.trial ? (last ? `editie ${last.number}` : null) : n !== null && n > 1 ? `editie ${n - 1}` : null;
    reportView = (
      <ReportPanel
        report={runReport.report}
        title={runReport.trial ? 'Proefrun (niet vastgelegd)' : `Editie ${n} · vastgelegd`}
        previous={previous}
        previousLabel={previousLabel}
        scenario={S}
        outdated={runReport.trial && runReport.report.signature !== signature}
        primaryAction={{ label: runReport.trial ? 'Ontwerp aanpassen' : `Editie ${editionNumber} voorbereiden`, onClick: goBuild }}
        secondaryAction={
          runReport.trial
            ? { label: `Editie ${editionNumber} nu draaien`, onClick: () => goSimulate(false, true) }
            : { label: 'Alle edities', onClick: () => setMode('editions') }
        }
        onHighlightTile={setHighlightTile}
        showHeat={showHeat}
        setShowHeat={setShowHeat}
      />
    );
  } else if (viewed) {
    const prev = campaign.editions.find((e) => e.number === viewed.number - 1) ?? null;
    reportView = (
      <ReportPanel
        report={viewed.report}
        title={`Editie ${viewed.number}`}
        previous={prev?.report ?? null}
        previousLabel={prev ? `editie ${prev.number}` : null}
        scenario={S}
        outdated={false}
        primaryAction={{ label: '← Alle edities', onClick: () => setViewEdition(null) }}
        secondaryAction={{
          label: 'Dit ontwerp als concept gebruiken',
          onClick: () => {
            updateDraft(() => ({ layout: viewed.layout, program: viewed.program, ticketPrice: viewed.ticketPrice, seed: viewed.seed }));
            notify(`Ontwerp van editie ${viewed.number} staat klaar als concept`);
          },
        }}
        onHighlightTile={setHighlightTile}
        showHeat={showHeat}
        setShowHeat={setShowHeat}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <header className="border-b border-white/5 bg-slate-950/60">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div>
            <h1 className="text-lg font-bold tracking-tight text-amber-200">Festival Architect</h1>
            <p className="text-xs text-slate-400">
              {campaign.name} · editie {editionNumber} · fictieve game
            </p>
          </div>
          <nav className="flex flex-wrap gap-1.5">
            {steps.map((s) => (
              <Button
                key={s.id}
                variant={mode === s.id ? 'primary' : 'ghost'}
                disabled={!s.enabled}
                onClick={() => {
                  if (s.id === mode) {
                    if (s.id === 'editions') setViewEdition(null);
                    return;
                  }
                  if (s.id === 'build') goBuild();
                  else if (s.id === 'program') goProgram();
                  else if (s.id === 'simulate') goSimulate(false);
                  else if (s.id === 'report') {
                    setShowHeat(true);
                    setMode('report');
                  } else {
                    setViewEdition(null);
                    setShowHeat(true);
                    setMode('editions');
                  }
                }}
              >
                {s.label}
              </Button>
            ))}
          </nav>
          <div className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300 tabular-nums ring-1 ring-white/10">
            Kapitaal <span className={capital > 0 ? 'text-emerald-300' : 'text-rose-300'}>{formatEuro(capital)}</span>
          </div>
        </div>
        {bankrupt && (
          <div className="bg-rose-600/20 px-4 py-1.5 text-center text-sm text-rose-100">
            Het kapitaal is op: deze festivalreeks is failliet. Start een nieuwe reeks via het tabblad Edities.
          </div>
        )}
      </header>

      <main className="mx-auto flex max-w-[1500px] flex-col gap-4 px-4 py-4 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1">
          <KpiStrip items={kpis} />
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

        <aside className="w-full shrink-0 lg:w-[420px]">
          {mode === 'build' && (
            <div className="flex flex-col gap-3">
              <BuildPanel
                layout={layout}
                capital={capital}
                rentCosts={rent}
                actFees={fees}
                pathTileCost={S.pathTileCost}
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
                coverageKind={coverageKind}
                setCoverageKind={setCoverageKind}
                onLoadExample={() => {
                  const ex = createExampleDesign(S);
                  updateDraft((d) => ({ ...d, layout: ex.layout, program: ex.program }));
                  setSelectedId(null);
                  notify('Voorbeeldontwerp geladen');
                }}
                onClear={() => {
                  updateDraft((d) => ({ ...d, layout: createEmptyLayout(S), program: { performances: [] } }));
                  setSelectedId(null);
                  notify('Terrein leeggemaakt');
                }}
                onNext={goProgram}
              />
              <SavePanel
                defaultName={campaign.name}
                onSave={async (name) => {
                  const named = { ...campaign, name };
                  setCampaign(named);
                  await writeSave({ version: 2, name, savedAt: new Date().toISOString(), campaign: named });
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
              scenario={S}
              editionNumber={editionNumber}
              stages={stages}
              program={effectiveProgram}
              setProgram={setProgram}
              seed={draft.seed}
              setSeed={(seed) => updateDraft((d) => ({ ...d, seed }))}
              ticketPrice={draft.ticketPrice}
              setTicketPrice={(ticketPrice) => updateDraft((d) => ({ ...d, ticketPrice }))}
              demand={demand}
              previousSatisfaction={prevSat}
              capital={capital}
              fixedCosts={rent + fees}
              issues={validation.issues}
              canSimulate={validation.ok}
              onBack={goBuild}
              onSimulate={(asTrial) => goSimulate(asTrial)}
            />
          )}
          {mode === 'simulate' && (
            <SimPanel
              stats={sim.stats}
              status={sim.status}
              speed={sim.speed}
              seed={sim.runnerRef.current?.state.input.seed ?? draft.seed}
              trial={trial}
              editionNumber={runMeta.current.editionNumber}
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
          {(mode === 'report' || viewed) && reportView}
          {mode === 'editions' && !viewed && (
            <EditionsPanel
              campaign={campaign}
              onOpen={(n) => {
                setViewEdition(n);
                setShowHeat(true);
              }}
              onContinue={goBuild}
              onNewSeries={newSeries}
            />
          )}
        </aside>
      </main>
    </div>
  );
}
