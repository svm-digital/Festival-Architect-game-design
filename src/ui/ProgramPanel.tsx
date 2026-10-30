import { actFee, ACTS, formatDecimal, formatEuro, GENRE_COLORS, GENRE_LABELS, GENRES, getAct } from '../model/catalog';
import { ECONOMY, type DemandBreakdown } from '../model/economy';
import type { ValidationIssue } from '../model/reachability';
import type { Facility, Genre, Program, ScenarioSettings } from '../model/types';
import { slotLabel } from '../sim/clock';
import { Button, Section } from './components';
import { IssueList } from './IssueList';

interface Props {
  scenario: ScenarioSettings;
  editionNumber: number;
  stages: Facility[];
  program: Program;
  setProgram: (p: Program) => void;
  seed: number;
  setSeed: (n: number) => void;
  ticketPrice: number;
  setTicketPrice: (n: number) => void;
  demand: DemandBreakdown;
  previousSatisfaction: number | null;
  capital: number;
  fixedCosts: number;
  issues: ValidationIssue[];
  canSimulate: boolean;
  onBack: () => void;
  onSimulate: (trial: boolean) => void;
}

export function ProgramPanel(p: Props) {
  const assignment = (stageId: string, slot: number) =>
    p.program.performances.find((x) => x.stageId === stageId && x.slot === slot)?.actId ?? '';
  const usedActs = new Set(p.program.performances.map((x) => x.actId));
  const d = p.demand;

  const setCell = (stageId: string, slot: number, actId: string) => {
    const rest = p.program.performances.filter((x) => !(x.stageId === stageId && x.slot === slot));
    p.setProgram({ performances: actId ? [...rest, { stageId, slot, actId }] : rest });
  };

  return (
    <div className="flex flex-col gap-3">
      <Section title={`Tickets · editie ${p.editionNumber}`}>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={ECONOMY.ticketPrice.min}
            max={ECONOMY.ticketPrice.max}
            step={1}
            value={p.ticketPrice}
            onChange={(e) => p.setTicketPrice(Number(e.target.value))}
            className="flex-1 accent-amber-400"
            aria-label="Ticketprijs"
          />
          <input
            type="number"
            min={ECONOMY.ticketPrice.min}
            max={ECONOMY.ticketPrice.max}
            value={p.ticketPrice}
            onChange={(e) => {
              const n = Number.parseInt(e.target.value, 10);
              if (Number.isFinite(n)) p.setTicketPrice(Math.max(ECONOMY.ticketPrice.min, Math.min(ECONOMY.ticketPrice.max, n)));
            }}
            className="w-20 rounded-md bg-slate-800 px-2 py-1 text-right text-sm text-slate-100 ring-1 ring-white/10"
            aria-label="Ticketprijs in euro"
          />
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
          <Factor label="Prijs" value={d.priceFactor} />
          <Factor label="Line-up" value={d.lineupFactor} />
          <Factor label="Reputatie" value={d.reputationFactor} />
        </div>
        <div className="mt-2 flex items-baseline justify-between rounded-lg bg-slate-900/60 px-3 py-2">
          <span className="text-sm text-slate-300">
            Bezoekers: <span className="text-lg font-semibold text-slate-100 tabular-nums">{d.visitors}</span>
            {d.soldOut && <span className="ml-2 rounded bg-emerald-500/20 px-1.5 py-0.5 text-[11px] text-emerald-300">uitverkocht</span>}
          </span>
          <span className="text-sm text-slate-300">
            Tickets <span className="font-semibold text-amber-200 tabular-nums">{formatEuro(d.visitors * p.ticketPrice)}</span>
          </span>
        </div>
        <p className="mt-2 text-[11px] text-slate-500">
          Bezoekers = {p.scenario.maxVisitors} × prijs × line-up × reputatie (max {p.scenario.maxVisitors}).{' '}
          {p.previousSatisfaction === null
            ? 'Editie 1 heeft een neutrale reputatie.'
            : `Reputatie komt uit de tevredenheid van de vorige editie (${formatDecimal(p.previousSatisfaction, 0)}).`}
        </p>
      </Section>

      <Section title="Programma" aside={<span className="text-xs text-slate-400">gage = populariteit × {formatEuro(actFee({ id: '', name: '', genre: 'pop', popularity: 1 }))}</span>}>
        {p.stages.length === 0 ? (
          <p className="text-sm text-slate-400">Plaats eerst een podium in de bouwmodus.</p>
        ) : (
          <div className="space-y-3">
            {p.scenario.slots.map((sl) => (
              <div key={sl.index} className="rounded-lg bg-slate-900/50 p-2">
                <div className="mb-1.5 text-xs font-medium text-slate-300">
                  Tijdslot {sl.index + 1} · {slotLabel(p.scenario, sl.index)}
                </div>
                <div className="space-y-1.5">
                  {p.stages.map((st) => {
                    const current = assignment(st.id, sl.index);
                    const act = current ? getAct(current) : undefined;
                    return (
                      <label key={st.id} className="flex items-center gap-2">
                        <span className="w-16 shrink-0 text-xs text-slate-400">{st.name}</span>
                        <select
                          className="min-w-0 flex-1 rounded-md bg-slate-800 px-2 py-1 text-sm text-slate-100 ring-1 ring-white/10"
                          value={current}
                          onChange={(e) => setCell(st.id, sl.index, e.target.value)}
                        >
                          <option value="">— geen optreden —</option>
                          {GENRES.map((g) => (
                            <optgroup key={g} label={GENRE_LABELS[g]}>
                              {ACTS.filter((a) => a.genre === g).map((a) => (
                                <option key={a.id} value={a.id} disabled={usedActs.has(a.id) && a.id !== current}>
                                  {a.name} · pop. {a.popularity} · {formatEuro(actFee(a))}
                                  {usedActs.has(a.id) && a.id !== current ? ' (geboekt)' : ''}
                                </option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                        <span className="w-24 shrink-0">{act && <GenreDot genre={act.genre} />}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
            <p className="text-[11px] text-slate-500">
              Pop. = populariteit (1–10). Elke act kan één keer geboekt worden. Alle acts zijn fictief. Een populaire line-up trekt
              meer bezoekers en kijkers, maar kost meer gage.
            </p>
          </div>
        )}
      </Section>

      <Section title="Kosten en seed">
        <div className="mb-2 flex justify-between text-sm">
          <span className="text-slate-300">Vaste kosten (huur + gages)</span>
          <span className={`tabular-nums ${p.fixedCosts > p.capital ? 'text-rose-300' : 'text-slate-100'}`}>
            {formatEuro(p.fixedCosts)} van {formatEuro(p.capital)}
          </span>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-xs text-slate-400">Seed</span>
          <input
            type="number"
            className="w-28 rounded-md bg-slate-800 px-2 py-1 text-slate-100 ring-1 ring-white/10"
            value={p.seed}
            onChange={(e) => {
              const n = Number.parseInt(e.target.value, 10);
              if (Number.isFinite(n)) p.setSeed(n);
            }}
          />
          <span className="text-[11px] text-slate-500">zelfde ontwerp + prijs + seed = zelfde uitkomst</span>
        </label>
      </Section>

      <Section title="Controle vóór simulatie">
        <IssueList issues={p.issues} />
      </Section>

      <div className="flex flex-wrap gap-2">
        <Button variant="ghost" onClick={p.onBack}>
          ← Terrein
        </Button>
        <Button variant="secondary" onClick={() => p.onSimulate(true)} disabled={!p.canSimulate} title="Telt niet als editie; kapitaal verandert niet">
          Proefrun
        </Button>
        <Button variant="primary" onClick={() => p.onSimulate(false)} disabled={!p.canSimulate}>
          Editie {p.editionNumber} draaien →
        </Button>
      </div>
    </div>
  );
}

function Factor({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-slate-900/60 py-1.5">
      <div className="text-slate-400">{label}</div>
      <div className={`font-semibold tabular-nums ${value >= 1 ? 'text-emerald-300' : 'text-amber-200'}`}>× {formatDecimal(value, 2)}</div>
    </div>
  );
}

export function GenreDot({ genre }: { genre: Genre }) {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-slate-300" title={GENRE_LABELS[genre]}>
      <span className="h-2.5 w-2.5 rounded-full ring-1 ring-black/40" style={{ background: GENRE_COLORS[genre] }} />
      {GENRE_LABELS[genre]}
    </span>
  );
}
