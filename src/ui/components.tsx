import type { ReactNode } from 'react';

export function Section({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="rounded-xl bg-slate-800/70 p-3 ring-1 ring-white/5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-xs font-semibold tracking-wider text-amber-200/90 uppercase">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-amber-400 text-slate-900 hover:bg-amber-300 disabled:bg-slate-600 disabled:text-slate-400',
  secondary: 'bg-slate-700 text-slate-100 hover:bg-slate-600 disabled:opacity-40',
  ghost: 'bg-transparent text-slate-300 hover:bg-slate-700/60 disabled:opacity-40',
  danger: 'bg-rose-500/90 text-white hover:bg-rose-500 disabled:opacity-40',
};

export function Button({
  children,
  onClick,
  variant = 'secondary',
  disabled,
  active,
  title,
  className = '',
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: Variant;
  disabled?: boolean;
  active?: boolean;
  title?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed ${VARIANTS[variant]} ${
        active ? 'ring-2 ring-amber-300' : ''
      } ${className}`}
    >
      {children}
    </button>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="rounded-lg bg-slate-900/60 px-3 py-2" title={hint}>
      <div className="text-[11px] text-slate-400">{label}</div>
      <div className="text-lg font-semibold text-slate-100 tabular-nums">{value}</div>
    </div>
  );
}

export function Bar({ value, max, tone = 'amber' }: { value: number; max: number; tone?: 'amber' | 'rose' | 'sky' }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const color = tone === 'rose' ? 'bg-rose-400' : tone === 'sky' ? 'bg-sky-400' : 'bg-amber-400';
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-700">
      <div className={`h-full ${color} transition-[width]`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-300">
      <input type="checkbox" className="accent-amber-400" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

export const MODEL_DISCLAIMER =
  'Uitkomst van een vereenvoudigd spelmodel. Geen crowd-safetyanalyse, geen uitspraak over veilige bezoekerscapaciteit.';
