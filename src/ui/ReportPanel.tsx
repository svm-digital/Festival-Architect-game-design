import { FACILITY_DEFS, formatDecimal, formatEuro } from '../model/catalog';
import type { ScenarioSettings } from '../model/types';
import { slotLabel } from '../sim/clock';
import type { FinalReport } from '../sim/types';
import { Button, MODEL_DISCLAIMER, Section, Stat, Toggle } from './components';
import { GenreDot } from './ProgramPanel';

interface Props {
  report: FinalReport;
  scenario: ScenarioSettings;
  outdated: boolean;
  onEdit: () => void;
  onRerun: () => void;
  onHighlightTile: (tile: number | null) => void;
  showHeat: boolean;
  setShowHeat: (v: boolean) => void;
}

const fmtMin = (m: number | null) => (m === null ? '–' : `${formatDecimal(m)} min`);

export function ReportPanel({ report: r, scenario, outdated, onEdit, onRerun, onHighlightTile, showHeat, setShowHeat }: Props) {
  const popular = r.stages.find((s) => s.id === r.popularStageId);
  const problems = r.facilities.filter((f) => !f.reachable || f.underused);
  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-xl bg-amber-400/10 px-3 py-2 text-[11px] text-amber-100 ring-1 ring-amber-300/30">{MODEL_DISCLAIMER}</div>
      {outdated && (
        <div className="rounded-xl bg-sky-500/10 px-3 py-2 text-xs text-sky-100 ring-1 ring-sky-300/30">
          Dit rapport hoort bij een eerdere versie van ontwerp, programma of seed. Simuleer opnieuw om het bij te werken.
        </div>
      )}

      <Section title="Eindrapport" aside={<span className="text-xs text-slate-400">seed {r.seed} · {r.visitorCount} bezoekers</span>}>
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Tevredenheid" value={r.avgSatisfaction.toFixed(0)} hint="Gemiddelde eindwaarde, 0–100" />
          <Stat label="Populairst" value={popular?.name ?? '–'} />
          <Stat label="Vroeg weg" value={r.leftEarly} />
        </div>
        <Timeline report={r} />
        <div className="mt-2 flex flex-wrap gap-2">
          <Button variant="primary" onClick={onEdit}>
            Ontwerp aanpassen
          </Button>
          <Button variant="secondary" onClick={onRerun}>
            ↺ Opnieuw simuleren (seed {r.seed})
          </Button>
        </div>
      </Section>

      <Section title="Verbeterpunten">
        <ol className="list-decimal space-y-1.5 pl-4 text-sm text-slate-200">
          {r.advice.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ol>
      </Section>

      <Section title="Wachttijd per voorziening">
        <table className="w-full text-left text-xs">
          <thead className="text-slate-400">
            <tr>
              <th className="py-1 font-medium">Voorziening</th>
              <th className="font-medium">Gem. wacht</th>
              <th className="font-medium">Bediend</th>
              <th className="font-medium">Max rij</th>
              <th className="font-medium">Afgehaakt</th>
            </tr>
          </thead>
          <tbody className="text-slate-200 tabular-nums">
            {r.facilities.map((f) => (
              <tr key={f.id} className="border-t border-white/5">
                <td className="py-1">
                  {f.name}
                  {!f.reachable && <span className="ml-1 text-rose-300">onbereikbaar</span>}
                  {f.underused && <span className="ml-1 text-amber-300">onderbenut</span>}
                </td>
                <td>{f.type === 'seating' ? '–' : fmtMin(f.avgWaitMinutes)}</td>
                <td>{f.served}</td>
                <td>{f.type === 'seating' ? `${f.turnedAway}× vol` : f.maxQueue}</td>
                <td>{f.type === 'seating' ? '–' : f.abandoned}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="Podia">
        <div className="space-y-2">
          {r.stages.map((st) => (
            <div key={st.id} className="rounded-lg bg-slate-900/50 p-2">
              <div className="flex justify-between text-sm">
                <span className="font-medium text-slate-100">
                  {st.name} {st.id === r.popularStageId && <span className="text-amber-300">★</span>}
                </span>
                <span className="text-xs text-slate-400">{Math.round(st.watchMinutes).toLocaleString('nl-NL')} kijkminuten</span>
              </div>
              <ul className="mt-1 space-y-0.5 text-xs text-slate-300">
                {st.performances.map((p) => (
                  <li key={p.slot} className="flex items-center justify-between gap-2">
                    <span>
                      {slotLabel(scenario, p.slot)} · {p.actName} <GenreDot genre={p.genre} />
                    </span>
                    <span className="tabular-nums text-slate-400">
                      gem. {p.avgAudience.toFixed(0)} · piek {p.peakAudience}
                    </span>
                  </li>
                ))}
                {st.performances.length === 0 && <li className="text-slate-500">Geen optredens</li>}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Momenten met hoge bezetting" aside={<Toggle label="Heatmap" checked={showHeat} onChange={setShowHeat} />}>
        <ul className="space-y-1 text-sm">
          {r.peaks.map((p) => (
            <li
              key={p.minute}
              className="flex cursor-default justify-between rounded-md px-1.5 py-0.5 hover:bg-slate-700/50"
              onMouseEnter={() => onHighlightTile(p.tile)}
              onMouseLeave={() => onHighlightTile(null)}
            >
              <span className="text-slate-200">
                {p.clock} · bij {p.near}
              </span>
              <span className="text-slate-400 tabular-nums">{p.count} in 3×3 tegels</span>
            </li>
          ))}
        </ul>
        <p className="mt-1 text-[11px] text-slate-500">Drukte is een spelindicator: het aantal bezoekers in het drukste 3×3-tegelvak per minuut.</p>
      </Section>

      <Section title="Onbereikbaar of onderbenut">
        {problems.length === 0 ? (
          <p className="text-sm text-emerald-300">Alle voorzieningen waren bereikbaar en werden gebruikt.</p>
        ) : (
          <ul className="space-y-1 text-sm text-slate-200">
            {problems.map((f) => (
              <li key={f.id}>
                {f.name} — {!f.reachable ? 'niet bereikbaar' : `onderbenut (${f.served}× gebruikt)`}
              </li>
            ))}
          </ul>
        )}
        {(r.noGoal.food > 0 || r.noGoal.toilet > 0 || r.noGoal.seating > 0) && (
          <p className="mt-1 text-xs text-rose-200">
            Zonder bereikbaar doel: eten {r.noGoal.food} · toilet {r.noGoal.toilet} · zitplek {r.noGoal.seating} bezoekers
          </p>
        )}
        <p className="mt-1 text-xs text-slate-400">{Math.round(r.grassShare * 100)}% van de looptijd over gras.</p>
      </Section>

      <Section title="Budget">
        <table className="w-full text-left text-xs">
          <tbody className="text-slate-200 tabular-nums">
            {r.budget.lines.map((l) => (
              <tr key={l.label} className="border-t border-white/5">
                <td className="py-1">{l.label}</td>
                <td className="text-slate-400">
                  {l.count} × {formatEuro(l.unitCost)}
                </td>
                <td className="text-right">{formatEuro(l.total)}</td>
              </tr>
            ))}
            <tr className="border-t border-white/20 font-semibold">
              <td className="py-1">Totaal</td>
              <td className="text-slate-400">budget {formatEuro(r.budget.budget)}</td>
              <td className="text-right">{formatEuro(r.budget.spent)}</td>
            </tr>
            <tr>
              <td className="py-1">Over</td>
              <td />
              <td className={`text-right ${r.budget.remaining < 0 ? 'text-rose-300' : 'text-emerald-300'}`}>{formatEuro(r.budget.remaining)}</td>
            </tr>
          </tbody>
        </table>
        <p className="mt-1 text-[11px] text-slate-500">
          Prijzen per stuk: {(['stage', 'food', 'toilet', 'seating'] as const).map((t) => `${FACILITY_DEFS[t].label.toLowerCase()} ${formatEuro(FACILITY_DEFS[t].cost)}`).join(' · ')}
        </p>
      </Section>
    </div>
  );
}

function Timeline({ report }: { report: FinalReport }) {
  const pts = report.timeline;
  if (pts.length < 2) return null;
  const W = 300;
  const H = 60;
  const maxX = pts[pts.length - 1].minute || 1;
  const maxOn = Math.max(1, report.visitorCount);
  const line = (f: (p: (typeof pts)[number]) => number, max: number) =>
    pts.map((p) => `${((p.minute / maxX) * W).toFixed(1)},${(H - (f(p) / max) * (H - 4) - 2).toFixed(1)}`).join(' ');
  return (
    <div className="mt-3">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-16 w-full rounded-md bg-slate-900/60">
        <polyline fill="none" stroke="#38bdf8" strokeWidth="1.5" points={line((p) => p.onSite, maxOn)} />
        <polyline fill="none" stroke="#fbbf24" strokeWidth="1.5" points={line((p) => p.avgSatisfaction, 100)} />
      </svg>
      <div className="mt-1 flex gap-3 text-[11px] text-slate-400">
        <span className="text-sky-300">— bezoekers op terrein</span>
        <span className="text-amber-300">— gem. tevredenheid</span>
      </div>
    </div>
  );
}
