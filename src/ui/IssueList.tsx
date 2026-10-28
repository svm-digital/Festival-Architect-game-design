import type { ValidationIssue } from '../model/reachability';

export function IssueList({ issues, onFocus }: { issues: ValidationIssue[]; onFocus?: (id: string) => void }) {
  if (issues.length === 0) {
    return <p className="text-sm text-emerald-300">✓ Terrein is klaar voor simulatie.</p>;
  }
  return (
    <ul className="space-y-1.5">
      {issues.map((i, n) => (
        <li
          key={`${i.code}-${i.facilityId ?? n}`}
          className={`rounded-md px-2 py-1.5 text-xs ring-1 ${
            i.severity === 'error' ? 'bg-rose-500/10 text-rose-200 ring-rose-400/30' : 'bg-amber-500/10 text-amber-100 ring-amber-400/25'
          }`}
        >
          <span className="font-semibold">{i.severity === 'error' ? 'Blokkeert simulatie: ' : 'Let op: '}</span>
          {i.message}
          {i.facilityId && onFocus && (
            <button type="button" className="ml-1 underline decoration-dotted hover:text-white" onClick={() => onFocus(i.facilityId!)}>
              toon
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
