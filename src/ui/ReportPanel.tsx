import { useState } from 'react';
import { compareKpis, type KpiDelta } from '../game/campaign';
import { FACILITY_DEFS, formatDecimal, formatEuro, PRODUCTS, lowerLabel } from '../model/catalog';
import type { ScenarioSettings } from '../model/types';
import { slotLabel } from '../sim/clock';
import { INCIDENT_LABEL } from '../sim/report';
import type { FinalReport } from '../sim/types';
import { Button, MODEL_DISCLAIMER, Section, Toggle } from './components';
import { GenreDot } from './ProgramPanel';

type Tab = 'overview' | 'money' | 'facilities' | 'care' | 'program';

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overzicht' },
  { id: 'money', label: 'Geld' },
  { id: 'facilities', label: 'Voorzieningen' },
  { id: 'care', label: 'Zorg' },
  { id: 'program', label: 'Programma' },
];

interface Props {
  report: FinalReport;
  title: string;
  previous: FinalReport | null;
  previousLabel: string | null;
  scenario: ScenarioSettings;
  outdated: boolean;
  primaryAction: { label: string; onClick: () => void } | null;
  secondaryAction: { label: string; onClick: () => void } | null;
  onHighlightTile: (tile: number | null) => void;
  showHeat: boolean;
  setShowHeat: (v: boolean) => void;
}

const fmtMin = (m: number | null) => (m === null ? '–' : `${formatDecimal(m)} min`);

export function formatKpi(k: { format: KpiDelta['format'] }, v: number): string {
  switch (k.format) {
    case 'euro':
      return formatEuro(v);
    case 'minutes':
      return `${formatDecimal(v)} min`;
    case 'percent':
      return `${Math.round(v * 100)}%`;
    case 'number':
      return Number.isInteger(v) ? String(v) : formatDecimal(v);
  }
}

export function DeltaBadge({ k }: { k: KpiDelta }) {
  if (k.delta === null) return null;
  if (k.improved === null) return <span className="text-[11px] text-slate-500">gelijk</span>;
  const sign = k.delta > 0 ? '+' : '−';
  const abs = Math.abs(k.delta);
  return (
    <span className={`text-[11px] tabular-nums ${k.improved ? 'text-emerald-300' : 'text-rose-300'}`}>
      {k.improved ? '▲' : '▼'} {sign}
      {formatKpi(k, abs)}
    </span>
  );
}

export function ReportPanel(p: Props) {
  const [tab, setTab] = useState<Tab>('overview');
  const r = p.report;
  const f = r.finance;
  const kpis = compareKpis(r, p.previous);
  const kpi = (key: string) => kpis.find((k) => k.key === key)!;

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-xl bg-amber-400/10 px-3 py-2 text-[11px] text-amber-100 ring-1 ring-amber-300/30">{MODEL_DISCLAIMER}</div>
      {p.outdated && (
        <div className="rounded-xl bg-sky-500/10 px-3 py-2 text-xs text-sky-100 ring-1 ring-sky-300/30">
          Het huidige concept wijkt af van deze run (ontwerp, programma, prijs of seed).
        </div>
      )}

      <Section title={p.title} aside={<span className="text-xs text-slate-400">seed {r.seed} · {r.visitorCount} bezoekers</span>}>
        <div className="grid grid-cols-2 gap-2">
          {(['result', 'satisfaction', 'visitors', 'wait'] as const).map((key) => {
            const k = kpi(key);
            const tone = key === 'result' ? (k.value >= 0 ? 'text-emerald-300' : 'text-rose-300') : 'text-slate-100';
            return (
              <div key={key} className="rounded-lg bg-slate-900/60 px-3 py-2">
                <div className="text-[11px] text-slate-400">{k.label}</div>
                <div className={`text-lg font-semibold tabular-nums ${tone}`}>{formatKpi(k, k.value)}</div>
                <DeltaBadge k={k} />
              </div>
            );
          })}
        </div>
        {p.previousLabel && <p className="mt-1.5 text-[11px] text-slate-500">Verschillen ten opzichte van {p.previousLabel}.</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          {p.primaryAction && (
            <Button variant="primary" onClick={p.primaryAction.onClick}>
              {p.primaryAction.label}
            </Button>
          )}
          {p.secondaryAction && (
            <Button variant="secondary" onClick={p.secondaryAction.onClick}>
              {p.secondaryAction.label}
            </Button>
          )}
        </div>
      </Section>

      <div className="flex flex-wrap gap-1 rounded-xl bg-slate-800/70 p-1 ring-1 ring-white/5" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 rounded-lg px-2 py-1 text-xs font-medium whitespace-nowrap ${
              tab === t.id ? 'bg-amber-400 text-slate-900' : 'text-slate-300 hover:bg-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <>
          <Section title="Verbeterpunten">
            <ol className="list-decimal space-y-1.5 pl-4 text-sm text-slate-200">
              {r.advice.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ol>
          </Section>
          <Section title="Verloop">
            <Timeline report={r} />
          </Section>
          <Section title="Alle kerncijfers">
            <table className="w-full text-left text-xs">
              <tbody className="tabular-nums">
                {kpis.map((k) => (
                  <tr key={k.key} className="border-t border-white/5">
                    <td className="py-1 text-slate-300">{k.label}</td>
                    <td className="text-right text-slate-100">{formatKpi(k, k.value)}</td>
                    <td className="w-24 text-right">
                      <DeltaBadge k={k} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        </>
      )}

      {tab === 'money' && (
        <>
          <Section title="Resultaat" aside={<span className={`text-sm font-semibold tabular-nums ${f.result >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{formatEuro(f.result)}</span>}>
            <MoneyTable
              rows={[
                ['Kapitaal bij start', f.capitalStart, 'muted'],
                [`Tickets (${f.visitors} × ${formatEuro(f.ticketPrice)})`, f.revenue.tickets, 'in'],
                [`Drank (${f.units.bar} × ${formatEuro(PRODUCTS.bar.price)})`, f.revenue.bar, 'in'],
                [`Eten (${f.units.food} × ${formatEuro(PRODUCTS.food.price)})`, f.revenue.food, 'in'],
                [`Merchandise (${f.units.merch} × ${formatEuro(PRODUCTS.merch.price)})`, f.revenue.merch, 'in'],
                ['Inkoop verkochte producten', -f.purchaseCosts, 'out'],
                ...f.fixedCostLines.map((l) => [`${l.label} (${l.count}×)`, -l.total, 'out'] as [string, number, 'out']),
                ['Kapitaal na afloop', f.capitalEnd, 'total'],
              ]}
            />
          </Section>
          <Section title="Ticketvraag">
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              {(
                [
                  ['Prijs', r.demand.priceFactor],
                  ['Line-up', r.demand.lineupFactor],
                  ['Reputatie', r.demand.reputationFactor],
                ] as const
              ).map(([l, v]) => (
                <div key={l} className="rounded-lg bg-slate-900/60 py-1.5">
                  <div className="text-slate-400">{l}</div>
                  <div className="font-semibold text-slate-100 tabular-nums">× {formatDecimal(v, 2)}</div>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-slate-300">
              {r.demand.soldOut
                ? `Uitverkocht: ${r.demand.potential} wilden komen, ${r.visitorCount} pasten op het terrein.`
                : `${r.visitorCount} bezoekers bij ${formatEuro(r.demand.ticketPrice)}.`}
            </p>
          </Section>
        </>
      )}

      {tab === 'facilities' && (
        <>
          <Section title="Wachttijd en gebruik">
            <table className="w-full text-left text-xs">
              <thead className="text-slate-400">
                <tr>
                  <th className="py-1 font-medium">Voorziening</th>
                  <th className="font-medium">Wacht</th>
                  <th className="font-medium">Gebruik</th>
                  <th className="font-medium">Max rij</th>
                  <th className="text-right font-medium">Omzet</th>
                </tr>
              </thead>
              <tbody className="text-slate-200 tabular-nums">
                {r.facilities.map((x) => (
                  <tr key={x.id} className="border-t border-white/5">
                    <td className="py-1">
                      {x.name}
                      {!x.reachable && <span className="ml-1 text-rose-300">onbereikbaar</span>}
                      {x.underused && <span className="ml-1 text-amber-300">onderbenut</span>}
                      {x.abandoned > 0 && <span className="ml-1 text-rose-300">{x.abandoned} afgehaakt</span>}
                    </td>
                    <td>{x.type === 'seating' ? '–' : fmtMin(x.avgWaitMinutes)}</td>
                    <td>{x.served}</td>
                    <td>{x.type === 'seating' ? `${x.turnedAway}× vol` : x.maxQueue}</td>
                    <td className="text-right">{x.revenue ? formatEuro(x.revenue) : '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(r.noGoal.food > 0 || r.noGoal.drink > 0 || r.noGoal.toilet > 0 || r.noGoal.seating > 0) && (
              <p className="mt-2 text-xs text-rose-200">
                Zonder bereikbaar doel: drank {r.noGoal.drink} · eten {r.noGoal.food} · toilet {r.noGoal.toilet} · zitplek {r.noGoal.seating} bezoekers
              </p>
            )}
            <p className="mt-1 text-xs text-slate-400">{Math.round(r.grassShare * 100)}% van de looptijd over gras.</p>
          </Section>
          <Section title="Momenten met hoge bezetting" aside={<Toggle label="Heatmap" checked={p.showHeat} onChange={p.setShowHeat} />}>
            <ul className="space-y-1 text-sm">
              {r.peaks.map((pk) => (
                <li
                  key={pk.minute}
                  className="flex cursor-default justify-between rounded-md px-1.5 py-0.5 hover:bg-slate-700/50"
                  onMouseEnter={() => p.onHighlightTile(pk.tile)}
                  onMouseLeave={() => p.onHighlightTile(null)}
                >
                  <span className="text-slate-200">
                    {pk.clock} · bij {pk.near}
                  </span>
                  <span className="text-slate-400 tabular-nums">{pk.count} in 3×3</span>
                </li>
              ))}
            </ul>
            <p className="mt-1 text-[11px] text-slate-500">Spelindicator: aantal bezoekers in het drukste 3×3-tegelvak per minuut.</p>
          </Section>
        </>
      )}

      {tab === 'care' && (
        <>
          <Section title="Meldingen">
            <table className="w-full text-left text-xs">
              <thead className="text-slate-400">
                <tr>
                  <th className="py-1 font-medium">Soort</th>
                  <th className="font-medium">Totaal</th>
                  <th className="font-medium">Geholpen</th>
                  <th className="font-medium">Niet</th>
                  <th className="font-medium">Gem. aanloop</th>
                </tr>
              </thead>
              <tbody className="text-slate-200 tabular-nums">
                {r.incidents.map((i) => (
                  <tr key={i.kind} className="border-t border-white/5">
                    <td className="py-1">{INCIDENT_LABEL[i.kind]}</td>
                    <td>{i.total}</td>
                    <td>{i.handled}</td>
                    <td className={i.unhandled ? 'text-rose-300' : ''}>{i.unhandled}</td>
                    <td>{fmtMin(i.avgResponseMinutes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-1.5 text-[11px] text-slate-500">
              Aanlooptijd = tijd tot een medewerker bij de bezoeker is. Snel geholpen (≤ 5 min) verhoogt de tevredenheid licht; niet geholpen kost
              veel tevredenheid. Fictieve spelmechaniek.
            </p>
          </Section>
          <Section title="Hulpposten">
            {r.posts.length === 0 ? (
              <p className="text-sm text-slate-400">Geen hulpposten in dit ontwerp.</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {r.posts.map((post) => (
                  <li key={post.id} className="flex justify-between gap-2">
                    <span className="text-slate-200">
                      {post.name}
                      {!post.reachable && <span className="ml-1 text-rose-300">onbereikbaar</span>}
                    </span>
                    <span className="text-xs text-slate-400 tabular-nums">
                      {post.handled} geholpen · {Math.round(post.utilization * 100)}% bezet
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </>
      )}

      {tab === 'program' && (
        <Section title="Podia">
          <div className="space-y-2">
            {r.stages.map((st) => (
              <div key={st.id} className="rounded-lg bg-slate-900/50 p-2">
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-slate-100">
                    {st.name} {st.id === r.popularStageId && <span className="text-amber-300">★ populairst</span>}
                  </span>
                  <span className="text-xs text-slate-400">{Math.round(st.watchMinutes).toLocaleString('nl-NL')} kijkminuten</span>
                </div>
                <ul className="mt-1 space-y-0.5 text-xs text-slate-300">
                  {st.performances.map((pf) => (
                    <li key={pf.slot} className="flex items-center justify-between gap-2">
                      <span>
                        {slotLabel(p.scenario, pf.slot)} · {pf.actName} <GenreDot genre={pf.genre} />
                      </span>
                      <span className="text-slate-400 tabular-nums">
                        gem. {pf.avgAudience.toFixed(0)} · {formatEuro(pf.fee)}
                      </span>
                    </li>
                  ))}
                  {st.performances.length === 0 && <li className="text-slate-500">Geen optredens</li>}
                </ul>
              </div>
            ))}
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            Prijzen per stuk: {(['stage', 'bar', 'food', 'toilet', 'merch', 'firstaid'] as const).map((t) => `${lowerLabel(t)} ${formatEuro(FACILITY_DEFS[t].cost)}`).join(' · ')}
          </p>
        </Section>
      )}
    </div>
  );
}

function MoneyTable({ rows }: { rows: [string, number, 'in' | 'out' | 'muted' | 'total'][] }) {
  return (
    <table className="w-full text-left text-xs">
      <tbody className="tabular-nums">
        {rows.map(([label, v, kind]) => (
          <tr key={label} className={`border-t ${kind === 'total' ? 'border-white/20 font-semibold' : 'border-white/5'}`}>
            <td className={`py-1 ${kind === 'muted' ? 'text-slate-400' : 'text-slate-200'}`}>{label}</td>
            <td
              className={`text-right ${
                kind === 'in' ? 'text-emerald-300' : kind === 'out' ? 'text-rose-300' : kind === 'total' ? (v >= 0 ? 'text-emerald-300' : 'text-rose-300') : 'text-slate-400'
              }`}
            >
              {kind === 'in' ? '+' : ''}
              {formatEuro(v)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Timeline({ report }: { report: FinalReport }) {
  const pts = report.timeline;
  if (pts.length < 2) return null;
  const W = 300;
  const H = 70;
  const maxX = pts[pts.length - 1].minute || 1;
  const maxOn = Math.max(1, report.visitorCount);
  const maxRev = Math.max(1, ...pts.map((p) => p.revenue));
  const line = (f: (p: (typeof pts)[number]) => number, max: number) =>
    pts.map((p) => `${((p.minute / maxX) * W).toFixed(1)},${(H - (f(p) / max) * (H - 4) - 2).toFixed(1)}`).join(' ');
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-20 w-full rounded-md bg-slate-900/60" role="img" aria-label="Verloop van bezoekers, tevredenheid en omzet">
        <polyline fill="none" stroke="#38bdf8" strokeWidth="1.5" points={line((p) => p.onSite, maxOn)} />
        <polyline fill="none" stroke="#fbbf24" strokeWidth="1.5" points={line((p) => p.avgSatisfaction, 100)} />
        <polyline fill="none" stroke="#34d399" strokeWidth="1.5" strokeDasharray="3 2" points={line((p) => p.revenue, maxRev)} />
      </svg>
      <div className="mt-1 flex flex-wrap gap-3 text-[11px] text-slate-400">
        <span className="text-sky-300">— bezoekers op terrein</span>
        <span className="text-amber-300">— gem. tevredenheid</span>
        <span className="text-emerald-300">┄ omzet (cumulatief)</span>
      </div>
    </div>
  );
}
