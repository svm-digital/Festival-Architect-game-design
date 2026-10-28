import { ACTS, GENRE_COLORS, GENRE_LABELS, GENRES, getAct } from '../model/catalog';
import type { ValidationIssue } from '../model/reachability';
import type { Facility, Genre, Program, ScenarioSettings } from '../model/types';
import { slotLabel } from '../sim/clock';
import { Button, Section } from './components';
import { IssueList } from './IssueList';

interface Props {
  scenario: ScenarioSettings;
  stages: Facility[];
  program: Program;
  setProgram: (p: Program) => void;
  seed: number;
  setSeed: (n: number) => void;
  visitorCount: number;
  setVisitorCount: (n: number) => void;
  issues: ValidationIssue[];
  canSimulate: boolean;
  onBack: () => void;
  onSimulate: () => void;
}

export function ProgramPanel(p: Props) {
  const assignment = (stageId: string, slot: number) =>
    p.program.performances.find((x) => x.stageId === stageId && x.slot === slot)?.actId ?? '';
  const usedActs = new Set(p.program.performances.map((x) => x.actId));

  const setCell = (stageId: string, slot: number, actId: string) => {
    const rest = p.program.performances.filter((x) => !(x.stageId === stageId && x.slot === slot));
    p.setProgram({ performances: actId ? [...rest, { stageId, slot, actId }] : rest });
  };

  return (
    <div className="flex flex-col gap-3">
      <Section title="Programma">
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
                                  {a.name} · pop. {a.popularity}
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
              Pop. = populariteit (1–10). Elke act kan één keer geboekt worden. Alle acts zijn fictief. Bezoekers kiezen een podium op populariteit,
              eigen genrevoorkeur (één genre per bezoeker, gelijk verdeeld) en afstand.
            </p>
          </div>
        )}
      </Section>

      <Section title="Simulatie-instellingen">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-400">Seed</span>
            <input
              type="number"
              className="rounded-md bg-slate-800 px-2 py-1 text-slate-100 ring-1 ring-white/10"
              value={p.seed}
              onChange={(e) => {
                const n = Number.parseInt(e.target.value, 10);
                if (Number.isFinite(n)) p.setSeed(n);
              }}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-400">Bezoekers (max {p.scenario.maxVisitors})</span>
            <input
              type="number"
              min={10}
              max={p.scenario.maxVisitors}
              className="rounded-md bg-slate-800 px-2 py-1 text-slate-100 ring-1 ring-white/10"
              value={p.visitorCount}
              onChange={(e) => {
                const n = Number.parseInt(e.target.value, 10);
                if (Number.isFinite(n)) p.setVisitorCount(Math.max(10, Math.min(p.scenario.maxVisitors, n)));
              }}
            />
          </label>
        </div>
        <p className="mt-2 text-[11px] text-slate-500">Zelfde ontwerp + programma + seed = exact dezelfde uitkomst.</p>
      </Section>

      <Section title="Controle vóór simulatie">
        <IssueList issues={p.issues} />
      </Section>

      <div className="flex flex-wrap gap-2">
        <Button variant="ghost" onClick={p.onBack}>
          ← Terrein
        </Button>
        <Button variant="primary" onClick={p.onSimulate} disabled={!p.canSimulate}>
          Naar simulatie →
        </Button>
      </div>
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
