import { useState } from 'react';
import { averageWait, compareKpis, currentCapital, type Campaign } from '../game/campaign';
import { formatDecimal, formatEuro } from '../model/catalog';
import { Button, Section } from './components';
import { DeltaBadge, formatKpi } from './ReportPanel';

interface Props {
  campaign: Campaign;
  onOpen: (editionNumber: number) => void;
  onContinue: () => void;
  onNewSeries: () => void;
}

export function EditionsPanel({ campaign, onOpen, onContinue, onNewSeries }: Props) {
  const eds = campaign.editions;
  const capital = currentCapital(campaign);
  const total = eds.reduce((a, e) => a + e.report.finance.result, 0);
  const [a, setA] = useState<number | null>(null);
  const [b, setB] = useState<number | null>(null);
  const ea = eds.find((e) => e.number === (a ?? eds.length - 1)) ?? null;
  const eb = eds.find((e) => e.number === (b ?? eds.length)) ?? null;

  return (
    <div className="flex flex-col gap-3">
      <Section title={`Festivalreeks · ${campaign.name}`}>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-slate-900/60 py-2">
            <div className="text-[11px] text-slate-400">Edities</div>
            <div className="text-lg font-semibold text-slate-100 tabular-nums">{eds.length}</div>
          </div>
          <div className="rounded-lg bg-slate-900/60 py-2">
            <div className="text-[11px] text-slate-400">Kapitaal nu</div>
            <div className={`text-lg font-semibold tabular-nums ${capital > 0 ? 'text-amber-200' : 'text-rose-300'}`}>{formatEuro(capital)}</div>
          </div>
          <div className="rounded-lg bg-slate-900/60 py-2">
            <div className="text-[11px] text-slate-400">Totaal resultaat</div>
            <div className={`text-lg font-semibold tabular-nums ${total >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{formatEuro(total)}</div>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="primary" onClick={onContinue} disabled={capital <= 0}>
            Editie {eds.length + 1} voorbereiden
          </Button>
          <Button variant="ghost" onClick={onNewSeries}>
            Nieuwe reeks starten
          </Button>
        </div>
        {capital <= 0 && <p className="mt-2 text-xs text-rose-300">Het kapitaal is op: deze reeks is failliet. Start een nieuwe reeks.</p>}
      </Section>

      {eds.length === 0 ? (
        <Section title="Nog geen edities">
          <p className="text-sm text-slate-400">
            Draai een editie vanuit het programmascherm. Een proefrun telt niet mee. Elke editie start met het kapitaal en het ontwerp van de vorige.
          </p>
        </Section>
      ) : (
        <>
          <Section title="Verloop per editie">
            <div className="grid grid-cols-3 gap-2">
              <MiniChart
                label="Kapitaal"
                values={[campaign.startCapital, ...eds.map((e) => e.report.finance.capitalEnd)]}
                labels={['start', ...eds.map((e) => String(e.number))]}
                format={formatEuro}
                color="#fbbf24"
              />
              <MiniChart label="Tevredenheid" values={eds.map((e) => e.report.avgSatisfaction)} labels={eds.map((e) => String(e.number))} format={(v) => formatDecimal(v, 0)} color="#38bdf8" />
              <MiniChart label="Bezoekers" values={eds.map((e) => e.report.visitorCount)} labels={eds.map((e) => String(e.number))} format={(v) => String(v)} color="#34d399" />
            </div>
          </Section>

          <Section title="Alle edities">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[22rem] text-left text-xs">
                <thead className="text-slate-400">
                  <tr>
                    <th className="py-1 font-medium">#</th>
                    <th className="font-medium">Prijs</th>
                    <th className="font-medium">Bez.</th>
                    <th className="font-medium">Tevr.</th>
                    <th className="font-medium">Wacht</th>
                    <th className="text-right font-medium">Resultaat</th>
                    <th />
                  </tr>
                </thead>
                <tbody className="text-slate-200 tabular-nums">
                  {eds.map((e, i) => {
                    const prev = i > 0 ? eds[i - 1].report : null;
                    const d = compareKpis(e.report, prev);
                    const k = (key: string) => d.find((x) => x.key === key)!;
                    return (
                      <tr key={e.number} className="border-t border-white/5 align-top">
                        <td className="py-1 font-semibold">{e.number}</td>
                        <td>{formatEuro(e.ticketPrice)}</td>
                        <td>
                          {e.report.visitorCount}
                          <div>
                            <DeltaBadge k={k('visitors')} />
                          </div>
                        </td>
                        <td>
                          {formatDecimal(e.report.avgSatisfaction, 0)}
                          <div>
                            <DeltaBadge k={k('satisfaction')} />
                          </div>
                        </td>
                        <td>
                          {formatDecimal(averageWait(e.report))}
                          <div>
                            <DeltaBadge k={k('wait')} />
                          </div>
                        </td>
                        <td className={`text-right ${e.report.finance.result >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                          {formatEuro(e.report.finance.result)}
                        </td>
                        <td className="text-right">
                          <button type="button" className="text-amber-200 underline decoration-dotted hover:text-amber-100" onClick={() => onOpen(e.number)}>
                            rapport
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-1.5 text-[11px] text-slate-500">▲ = beter dan de editie ervoor, ▼ = slechter.</p>
          </Section>

          {eds.length >= 2 && ea && eb && (
            <Section title="Twee edities vergelijken">
              <div className="mb-2 flex items-center gap-2 text-sm">
                <EditionSelect value={ea.number} count={eds.length} onChange={setA} />
                <span className="text-slate-400">tegenover</span>
                <EditionSelect value={eb.number} count={eds.length} onChange={setB} />
              </div>
              <table className="w-full text-left text-xs">
                <thead className="text-slate-400">
                  <tr>
                    <th className="py-1 font-medium">Kerncijfer</th>
                    <th className="text-right font-medium">Ed. {ea.number}</th>
                    <th className="text-right font-medium">Ed. {eb.number}</th>
                    <th className="w-24 text-right font-medium">Verschil</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {compareKpis(eb.report, ea.report).map((k) => (
                    <tr key={k.key} className="border-t border-white/5">
                      <td className="py-1 text-slate-300">{k.label}</td>
                      <td className="text-right text-slate-400">{k.previous === null ? '–' : formatKpi(k, k.previous)}</td>
                      <td className="text-right text-slate-100">{formatKpi(k, k.value)}</td>
                      <td className="text-right">
                        <DeltaBadge k={k} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>
          )}
        </>
      )}
    </div>
  );
}

function EditionSelect({ value, count, onChange }: { value: number; count: number; onChange: (n: number) => void }) {
  return (
    <select
      className="rounded-md bg-slate-800 px-2 py-1 text-sm text-slate-100 ring-1 ring-white/10"
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
    >
      {Array.from({ length: count }, (_, i) => (
        <option key={i + 1} value={i + 1}>
          Editie {i + 1}
        </option>
      ))}
    </select>
  );
}

function MiniChart({
  label,
  values,
  labels,
  format,
  color,
}: {
  label: string;
  values: number[];
  labels: string[];
  format: (v: number) => string;
  color: string;
}) {
  const W = 120;
  const H = 50;
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 1);
  const span = max - min || 1;
  const x = (i: number) => (values.length === 1 ? W / 2 : 6 + (i / (values.length - 1)) * (W - 12));
  const y = (v: number) => H - 6 - ((v - min) / span) * (H - 12);
  const last = values[values.length - 1];
  return (
    <div className="rounded-lg bg-slate-900/60 p-2">
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] text-slate-400">{label}</span>
        <span className="text-xs font-semibold text-slate-100 tabular-nums">{format(last)}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-1 h-12 w-full" role="img" aria-label={`${label} per editie`}>
        {min < 0 && <line x1={0} x2={W} y1={y(0)} y2={y(0)} stroke="#475569" strokeDasharray="2 2" />}
        <polyline fill="none" stroke={color} strokeWidth="2" points={values.map((v, i) => `${x(i)},${y(v)}`).join(' ')} />
        {values.map((v, i) => (
          <circle key={i} cx={x(i)} cy={y(v)} r={2.5} fill={color}>
            <title>{`${labels[i]}: ${format(v)}`}</title>
          </circle>
        ))}
      </svg>
    </div>
  );
}
