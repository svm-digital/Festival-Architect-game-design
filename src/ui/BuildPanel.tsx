import { POST_SHORT, CATEGORY_LABELS, FACILITY_DEFS, FACILITY_ORDER, formatEuro, isPost, type FacilityCategory, lowerLabel } from '../model/catalog';
import type { ReachabilityAnalysis, ValidationIssue } from '../model/reachability';
import type { Facility, FacilityType, Facing, FestivalLayout, PostType } from '../model/types';
import { Bar, Button, Section, Toggle } from './components';
import { IssueList } from './IssueList';

export type Tool = { kind: 'select' } | { kind: 'path' } | { kind: 'erase' } | { kind: 'facility'; type: FacilityType };

export const FACING_LABEL: Record<Facing, string> = { south: 'zuid ↓', west: 'west ←', north: 'noord ↑', east: 'oost →' };

interface Props {
  layout: FestivalLayout;
  capital: number;
  rentCosts: number;
  actFees: number;
  pathTileCost: number;
  tool: Tool;
  setTool: (t: Tool) => void;
  facing: Facing;
  rotate: () => void;
  hoverReasons: string[] | null;
  selected: Facility | null;
  onDelete: (id: string) => void;
  analysis: ReachabilityAnalysis;
  issues: ValidationIssue[];
  onFocusFacility: (id: string) => void;
  showReach: boolean;
  setShowReach: (v: boolean) => void;
  showZones: boolean;
  setShowZones: (v: boolean) => void;
  coverageKind: PostType | null;
  setCoverageKind: (k: PostType | null) => void;
  onLoadExample: () => void;
  onClear: () => void;
  onNext: () => void;
}

const CATEGORIES: FacilityCategory[] = ['basis', 'horeca', 'comfort', 'verkoop', 'zorg'];

export function BuildPanel(p: Props) {
  const remaining = p.capital - p.rentCosts - p.actFees;
  const toolIs = (t: Tool) =>
    p.tool.kind === t.kind && (t.kind !== 'facility' || (p.tool.kind === 'facility' && p.tool.type === t.type));
  const errors = p.issues.filter((i) => i.severity === 'error');

  return (
    <div className="flex flex-col gap-3">
      <Section title="Kapitaal deze editie" aside={<span className="text-xs text-slate-400">{formatEuro(p.capital)}</span>}>
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded-lg bg-slate-900/60 py-1.5">
            <div className="text-slate-400">Huur terrein</div>
            <div className="font-semibold text-slate-100 tabular-nums">{formatEuro(p.rentCosts)}</div>
          </div>
          <div className="rounded-lg bg-slate-900/60 py-1.5">
            <div className="text-slate-400">Gages</div>
            <div className="font-semibold text-slate-100 tabular-nums">{formatEuro(p.actFees)}</div>
          </div>
          <div className="rounded-lg bg-slate-900/60 py-1.5">
            <div className="text-slate-400">Vrij</div>
            <div className={`font-semibold tabular-nums ${remaining < 0 ? 'text-rose-300' : 'text-emerald-300'}`}>{formatEuro(remaining)}</div>
          </div>
        </div>
        <div className="mt-2">
          <Bar value={p.rentCosts + p.actFees} max={Math.max(1, p.capital)} tone={remaining < 0 ? 'rose' : 'amber'} />
        </div>
        <p className="mt-1.5 text-[11px] text-slate-500">Alle prijzen zijn huur per editie, inclusief bezetting. Inkomsten komen pas tijdens het festival binnen.</p>
      </Section>

      <Section title="Bouwen" aside={<span className="text-[11px] text-slate-500">R = draaien · Esc = selecteren</span>}>
        <div className="grid grid-cols-3 gap-1.5">
          <ToolButton active={toolIs({ kind: 'select' })} onClick={() => p.setTool({ kind: 'select' })} label="Selecteren" sub="klik voorziening" />
          <ToolButton
            active={toolIs({ kind: 'path' })}
            onClick={() => p.setTool({ kind: 'path' })}
            label="Pad tekenen"
            sub={`${formatEuro(p.pathTileCost)}/tegel`}
            swatch="#dcc597"
          />
          <ToolButton active={toolIs({ kind: 'erase' })} onClick={() => p.setTool({ kind: 'erase' })} label="Pad wissen" sub="geld terug" />
        </div>
        <div className="mt-2 space-y-2">
          {CATEGORIES.map((cat) => (
            <div key={cat}>
              <div className="mb-1 text-[11px] font-medium text-slate-400">{CATEGORY_LABELS[cat]}</div>
              <div className="grid grid-cols-1 gap-1">
                {FACILITY_ORDER.filter((t) => FACILITY_DEFS[t].category === cat).map((type) => {
                  const def = FACILITY_DEFS[type];
                  const count = p.layout.facilities.filter((f) => f.type === type).length;
                  const full = def.maxCount !== null && count >= def.maxCount;
                  const tooExpensive = def.cost > remaining;
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => p.setTool({ kind: 'facility', type })}
                      className={`flex items-center gap-2.5 rounded-lg px-2.5 py-1 text-left transition-colors ${
                        toolIs({ kind: 'facility', type }) ? 'bg-amber-400/20 ring-2 ring-amber-300' : 'bg-slate-900/50 hover:bg-slate-700/60'
                      }`}
                    >
                      <span className="h-5 w-5 shrink-0 rounded" style={{ background: FACILITY_SWATCH[type] }} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-slate-100">
                          {def.label}
                          <span className="ml-1.5 text-xs font-normal text-slate-500">
                            {def.width}×{def.height}
                            {def.maxCount !== null ? ` · ${count}/${def.maxCount}` : count > 0 ? ` · ${count}×` : ''}
                          </span>
                        </span>
                        <span className="block truncate text-[11px] text-slate-400">{def.description}</span>
                      </span>
                      <span className={`text-sm tabular-nums ${full || tooExpensive ? 'text-rose-300' : 'text-amber-200'}`}>{formatEuro(def.cost)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        {p.tool.kind === 'facility' && (
          <div className="mt-2 flex items-center justify-between rounded-lg bg-slate-900/50 px-2.5 py-1.5 text-sm">
            <span className="text-slate-300">Toegang: {p.tool.type === 'entrance' ? 'automatisch naar binnen' : FACING_LABEL[p.facing]}</span>
            <Button variant="ghost" onClick={p.rotate} disabled={p.tool.type === 'entrance'}>
              Draai (R)
            </Button>
          </div>
        )}
        {p.hoverReasons && p.hoverReasons.length > 0 && (
          <ul className="mt-2 space-y-0.5 rounded-lg bg-rose-500/10 px-2.5 py-1.5 text-xs text-rose-200 ring-1 ring-rose-400/30">
            {p.hoverReasons.map((r) => (
              <li key={r}>• {r}</li>
            ))}
          </ul>
        )}
      </Section>

      {p.selected && (
        <Section title="Geselecteerd">
          <SelectedCard facility={p.selected} analysis={p.analysis} onDelete={p.onDelete} />
        </Section>
      )}

      <Section title="Terreincontrole">
        <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1">
          <Toggle label="Bereikbaarheid" checked={p.showReach} onChange={p.setShowReach} />
          <Toggle label="Publiekszones" checked={p.showZones} onChange={p.setShowZones} />
        </div>
        <div className="mb-2 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-slate-400">Dekking hulpposten:</span>
          {(['firstaid', 'security', 'awareness'] as PostType[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => p.setCoverageKind(p.coverageKind === k ? null : k)}
              className={`rounded-md px-2 py-0.5 ${p.coverageKind === k ? 'bg-amber-400 text-slate-900' : 'bg-slate-700 text-slate-200 hover:bg-slate-600'}`}
            >
              {POST_SHORT[k]}
            </button>
          ))}
        </div>
        {p.coverageKind && (
          <p className="mb-2 text-[11px] text-slate-400">
            Aanlooptijd vanaf de dichtstbijzijnde {lowerLabel(p.coverageKind)}:{' '}
            <span className="text-emerald-300">≤ 3 min</span> · <span className="text-amber-300">≤ 6 min</span> ·{' '}
            <span className="text-rose-300">langer</span>.
          </p>
        )}
        <IssueList issues={p.issues} onFocus={p.onFocusFacility} />
      </Section>

      <div className="flex flex-wrap gap-2">
        <Button variant="primary" onClick={p.onNext} disabled={errors.length > 0} title={errors.map((e) => e.message).join('\n')}>
          Verder naar programma →
        </Button>
        <Button variant="ghost" onClick={p.onLoadExample}>
          Voorbeeldontwerp
        </Button>
        <Button variant="ghost" onClick={p.onClear}>
          Leegmaken
        </Button>
      </div>
    </div>
  );
}

export const FACILITY_SWATCH: Record<FacilityType, string> = {
  entrance: 'repeating-linear-gradient(90deg,#f97316 0 4px,#fde68a 4px 8px)',
  stage: '#3a3f57',
  food: 'repeating-linear-gradient(90deg,#dc2626 0 4px,#fff7ed 4px 8px)',
  bar: '#b7791f',
  toilet: '#60a5fa',
  seating: '#c8a36b',
  merch: '#6d28d9',
  firstaid: '#15803d',
  security: '#1e293b',
  awareness: '#a21caf',
};

function ToolButton({ active, onClick, label, sub, swatch }: { active: boolean; onClick: () => void; label: string; sub: string; swatch?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-2 py-1.5 text-left transition-colors ${active ? 'bg-amber-400/20 ring-2 ring-amber-300' : 'bg-slate-900/50 hover:bg-slate-700/60'}`}
    >
      <span className="flex items-center gap-1.5 text-sm font-medium text-slate-100">
        {swatch && <span className="h-3 w-3 rounded-sm" style={{ background: swatch }} />}
        {label}
      </span>
      <span className="block text-[11px] text-slate-400">{sub}</span>
    </button>
  );
}

function SelectedCard({ facility, analysis, onDelete }: { facility: Facility; analysis: ReachabilityAnalysis; onDelete: (id: string) => void }) {
  const def = FACILITY_DEFS[facility.type];
  const reach = analysis.facilities[facility.id];
  return (
    <div className="space-y-2 text-sm">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-slate-100">{facility.name}</span>
        <span className="text-slate-400">{formatEuro(def.cost)} per editie</span>
      </div>
      <div className="text-xs text-slate-400">
        Positie ({facility.x}, {facility.y}) · toegang {FACING_LABEL[facility.facing]}
        {def.capacity !== null && (isPost(facility.type) ? ` · ${def.capacity} medewerkers` : ` · capaciteit ${def.capacity}`)}
        {def.serviceMinutes !== null && ` · ${def.serviceMinutes} min per bezoeker`}
      </div>
      {facility.type !== 'entrance' &&
        (reach?.reachable ? (
          <div className="text-xs text-emerald-300">✓ Bereikbaar vanaf de ingang</div>
        ) : (
          <div className="rounded-md bg-rose-500/10 px-2 py-1.5 text-xs text-rose-200 ring-1 ring-rose-400/30">{reach?.explanation}</div>
        ))}
      <Button variant="danger" onClick={() => onDelete(facility.id)}>
        Verwijderen (Del)
      </Button>
    </div>
  );
}
