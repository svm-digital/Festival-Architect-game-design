import { formatEuro, GENRE_COLORS, GENRE_LABELS, GENRES, POST_SHORT } from '../model/catalog';
import type { Speed } from '../sim/runner';
import { STAFF_COLORS } from '../render/renderer';
import { Bar, Button, MODEL_DISCLAIMER, Section, Toggle } from './components';
import type { LiveStats, SimStatus } from './useSimulation';

interface Props {
  stats: LiveStats | null;
  status: SimStatus;
  speed: Speed;
  seed: number;
  trial: boolean;
  editionNumber: number;
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
      <Section
        title={p.trial ? 'Proefrun' : `Editie ${p.editionNumber}`}
        aside={<span className="text-xs text-slate-400">seed {p.seed}</span>}
      >
        <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
          <span>
            {p.status === 'running' && 'loopt'}
            {p.status === 'paused' && 'gepauzeerd — spelklok staat stil'}
            {p.status === 'finished' && 'afgelopen'}
          </span>
          <span>{p.trial ? 'telt niet mee voor kapitaal' : 'wordt na afloop vastgelegd'}</span>
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
          <Button variant="ghost" onClick={p.onBackToBuild}>
            ← Ontwerp
          </Button>
          {p.status === 'finished' && (
            <Button variant="secondary" onClick={p.onShowReport}>
              Rapport
            </Button>
          )}
        </div>
        <p className="mt-2 text-[11px] text-slate-500">Pauzeren bevriest de run. Terug naar ontwerp sluit deze run af zonder vast te leggen.</p>
      </Section>

      {s && (
        <>
          <Section title="Omzet tot nu toe" aside={<span className="text-sm font-semibold text-amber-200 tabular-nums">{formatEuro(s.revenue.total)}</span>}>
            <div className="grid grid-cols-4 gap-1.5 text-center text-xs">
              {(
                [
                  ['Tickets', s.revenue.tickets],
                  ['Drank', s.revenue.bar],
                  ['Eten', s.revenue.food],
                  ['Merch', s.revenue.merch],
                ] as const
              ).map(([label, v]) => (
                <div key={label} className="rounded-lg bg-slate-900/60 py-1.5">
                  <div className="text-slate-400">{label}</div>
                  <div className="font-semibold text-slate-100 tabular-nums">{formatEuro(v)}</div>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Wachtrijen">
            {s.queues.length === 0 && s.seating.length === 0 ? (
              <p className="text-sm text-slate-400">Geen voorzieningen met een wachtrij.</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {s.queues.map((q) => (
                  <li key={q.id} className="grid grid-cols-[1fr_5rem_4.5rem] items-center gap-2">
                    <span className={`truncate ${q.reachable ? 'text-slate-200' : 'text-rose-300'}`}>
                      {q.name}
                      {!q.reachable && ' (onbereikbaar)'}
                    </span>
                    <Bar value={q.waiting} max={15} tone={q.waiting >= 8 ? 'rose' : 'sky'} />
                    <span className="text-right text-xs text-slate-400 tabular-nums">
                      <span className={q.waiting >= 8 ? 'font-semibold text-rose-300' : 'text-slate-200'}>{q.waiting}</span> · {q.serving}/{q.capacity}
                    </span>
                  </li>
                ))}
                {s.seating.map((q) => (
                  <li key={q.id} className="grid grid-cols-[1fr_5rem_4.5rem] items-center gap-2">
                    <span className={`truncate ${q.reachable ? 'text-slate-200' : 'text-rose-300'}`}>{q.name}</span>
                    <Bar value={q.used} max={q.capacity} tone="amber" />
                    <span className="text-right text-xs text-slate-400 tabular-nums">
                      {q.used}/{q.capacity} zit
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-1.5 text-[11px] text-slate-500">Wachtend · in bediening / capaciteit</p>
          </Section>

          <Section
            title="Zorg en veiligheid"
            aside={
              <span className="text-xs text-slate-400 tabular-nums">
                {s.incidents.handled} geholpen · {s.incidents.unhandled} niet
              </span>
            }
          >
            {s.posts.length === 0 ? (
              <p className="text-sm text-slate-400">Geen hulpposten geplaatst.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {s.posts.map((post) => (
                  <li key={post.id} className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-slate-200">
                      <span className="h-2.5 w-2.5 rounded-sm" style={{ background: STAFF_COLORS[post.type] }} />
                      {post.name}
                    </span>
                    <span className="flex gap-1" title={`${post.busy} van ${post.staff} bezig`}>
                      {Array.from({ length: post.staff }, (_, i) => (
                        <span key={i} className={`h-2.5 w-4 rounded-sm ${i < post.busy ? 'bg-rose-400' : 'bg-slate-600'}`} />
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-1.5 text-[11px] text-slate-500">
              Rood = medewerker onderweg of aan het helpen. Incidenten zijn een fictieve spelmechaniek.
            </p>
          </Section>

          <Section title="Podia">
            <ul className="space-y-2">
              {s.stages.map((st) => (
                <li key={st.id}>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-200">
                      {st.name} <span className="text-[11px] text-slate-500">{st.actName ?? 'geen optreden'}</span>
                    </span>
                    <span className="text-slate-300 tabular-nums">{st.watching}</span>
                  </div>
                  <Bar value={st.watching} max={Math.max(1, s.visitorTotal)} tone="sky" />
                </li>
              ))}
            </ul>
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
              {(['firstaid', 'security', 'awareness'] as const).map((k) => (
                <span key={k} className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ background: STAFF_COLORS[k] }} />
                  {POST_SHORT[k]}
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
