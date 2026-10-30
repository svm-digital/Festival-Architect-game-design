import type { ReactNode } from 'react';

export interface KpiItem {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: 'default' | 'good' | 'bad' | 'accent';
}

const TONE: Record<NonNullable<KpiItem['tone']>, string> = {
  default: 'text-slate-100',
  good: 'text-emerald-300',
  bad: 'text-rose-300',
  accent: 'text-amber-200',
};

/** Compacte rij kerncijfers boven het terrein. */
export function KpiStrip({ items }: { items: KpiItem[] }) {
  return (
    <div className="mb-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
      {items.map((k) => (
        <div key={k.label} className="rounded-xl bg-slate-800/80 px-3 py-2 ring-1 ring-white/5" title={k.hint}>
          <div className="truncate text-[11px] text-slate-400">{k.label}</div>
          <div className={`truncate text-lg font-semibold tabular-nums ${TONE[k.tone ?? 'default']}`}>{k.value}</div>
        </div>
      ))}
    </div>
  );
}
