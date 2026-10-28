import { GENRE_COLORS, GENRE_LABELS, GENRES } from '../model/catalog';
import type { Speed } from '../sim/runner';
import { Bar, Button, MODEL_DISCLAIMER, Section, Stat, Toggle } from './components';
import type { LiveStats, SimStatus } from './useSimulation';

interface Props {
  stats: LiveStats | null;
  status: SimStatus;
  speed: Speed;
  seed: number;
  visitorCount: number;
  onStart: () => void;
  onPause: () => void;
  onSpeed: (s: Speed) => void;
  onReset: () => void;
  onBackToBuild: () => void;
  onShowReport: () => void;
  showHeat: boolean;
  setShowHeat: (v: boolean) => void;
}

export function SimPanel(p: Props) {
  const s = p.stats;
  return (
    <div className="flex flex-col gap-3">
      <Section title="Simulatie" aside={<span className="text-xs text-slate-400">seed {p.seed}</span>}>
        <div className="mb-2 flex items-end justify-between">
          <div className="text-4xl font-bold text-amber-200 tabular-nums">{s?.clock ?? '--:--'}</div>
          <div className="text-right text-xs text-slate-400">
            {p.status === 'running' && 'loopt'}
            {p.status === 'paused' && 'gepauzeerd — spelklok staat stil'}
            {p.status === 'finished' && 'afgelopen'}
          </div>
        </div>
        <Bar value={s?.tick ?? 0} max={s?.totalTicks ?? 1} />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {p.status === 'running' ? (
            <Button variant="primary" onClick={p.onPause}>
              ❚❚ Pauze
            </Button>
          ) : (
            <Button variant="primary" onClick={p.onStart} disabled={p.status === 'finished'}>
              ▶ Start
            </Button>
          )}
          <div className="flex overflow-hidden rounded-lg ring-1 ring-white/10">
            {([1, 2, 4] as Speed[]).map((sp) => (
              <button
                key={sp}
                type="button"
                onClick={() => p.onSpeed(sp)}
                className={`px-2.5 py-1.5 text-sm tabular-nums ${p.speed === sp ? 'bg-amber-400 text-slate-900' : 'bg-slate-700 text-slate-200 hover:bg-slate-600'}`}
              >
                {sp}×
              </button>
            ))}
          </div>
          <Button variant="ghost" onClick={p.onReset} title="Terug naar 14:00 met dezelfde seed">
            ↺ Reset
          </Button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="ghost" onClick={p.onBackToBuild}>
            ← Ontwerp aanpassen
          </Button>
          {p.status === 'finished' && (
            <Button variant="secondary" onClick={p.onShowReport}>
              Rapport bekijken
            </Button>
          )}
        </div>
        <p className="mt-2 text-[11px] text-slate-500">
          Pauzeren bevriest de run. Bewerken van het terrein kan alleen in de bouwmodus; daarmee wordt deze run afgesloten.
        </p>
      </Section>

      {s && (
        <>
          <Section title="Nu op het terrein">
            <div className="grid grid-cols-3 gap-2">
              <Stat label="Bezoekers" value={`${s.onSite}`} hint={`${s.arrivedTotal} van ${p.visitorCount} gearriveerd`} />
              <Stat label="Tevredenheid" value={s.onSite ? s.avgSatisfaction.toFixed(0) : '–'} hint="Gemiddelde, schaal 0–100" />
              <Stat label="Zonder doel" value={<span className={s.noGoal ? 'text-rose-300' : ''}>{s.noGoal}</span>} hint="Bezoekers met een behoefte zonder bereikbare voorziening" />
            </div>
          </Section>

          <Section title="Podia">
            <ul className="space-y-2">
              {s.stages.map((st) => (
                <li key={st.id}>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-200">{st.name}</span>
                    <span className="text-slate-300 tabular-nums">{st.watching}</span>
                  </div>
                  <div className="mb-1 text-[11px] text-slate-500">{st.actName ?? 'geen optreden'}</div>
                  <Bar value={st.watching} max={p.visitorCount} tone="sky" />
                </li>
              ))}
            </ul>
          </Section>

          <Section title="Wachtrijen">
            {s.queues.length === 0 && s.seating.length === 0 ? (
              <p className="text-sm text-slate-400">Geen voorzieningen met een wachtrij.</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {s.queues.map((q) => (
                  <li key={q.id} className="flex items-center justify-between gap-2">
                    <span className={q.reachable ? 'text-slate-200' : 'text-rose-300'}>
                      {q.name}
                      {!q.reachable && ' (onbereikbaar)'}
                    </span>
                    <span className="text-xs text-slate-400 tabular-nums">
                      <span className={q.waiting >= 8 ? 'font-semibold text-rose-300' : 'text-slate-200'}>{q.waiting}</span> wachtend · {q.serving}/{q.capacity} bediend
                    </span>
                  </li>
                ))}
                {s.seating.map((q) => (
                  <li key={q.id} className="flex items-center justify-between gap-2">
                    <span className={q.reachable ? 'text-slate-200' : 'text-rose-300'}>{q.name}</span>
                    <span className="text-xs text-slate-400 tabular-nums">
                      {q.used}/{q.capacity} bezet
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Weergave">
            <Toggle label="Heatmap tegelbezetting (cumulatief)" checked={p.showHeat} onChange={p.setShowHeat} />
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
              {GENRES.map((g) => (
                <span key={g} className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: GENRE_COLORS[g] }} />
                  {GENRE_LABELS[g]}
                </span>
              ))}
              <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                <span className="h-2 w-2 rounded-full bg-rose-500" /> zonder bereikbaar doel
              </span>
            </div>
          </Section>
        </>
      )}
      <p className="text-[11px] text-slate-500">{MODEL_DISCLAIMER}</p>
    </div>
  );
}
