import { useCallback, useEffect, useState } from 'react';
import { deleteSave, listSaves, type SaveSummary } from '../storage/saves';
import { Button, Section } from './components';

interface Props {
  defaultName: string;
  onSave: (name: string) => Promise<void>;
  onLoad: (name: string) => Promise<void>;
}

export function SavePanel({ defaultName, onSave, onLoad }: Props) {
  const [saves, setSaves] = useState<SaveSummary[]>([]);
  const [name, setName] = useState(defaultName);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setSaves(await listSaves());
    } catch {
      setError('Opslag (IndexedDB) is niet beschikbaar in deze browser.');
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const run = async (fn: () => Promise<void>) => {
    setError(null);
    try {
      await fn();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Er ging iets mis.');
    }
  };

  return (
    <Section title="Reeks opslaan en laden">
      <div className="flex gap-2">
        <input
          className="min-w-0 flex-1 rounded-md bg-slate-800 px-2 py-1 text-sm text-slate-100 ring-1 ring-white/10"
          value={name}
          maxLength={40}
          onChange={(e) => setName(e.target.value)}
        />
        <Button variant="secondary" disabled={!name.trim()} onClick={() => run(() => onSave(name.trim()))}>
          Opslaan
        </Button>
      </div>
      {saves.length > 0 && (
        <ul className="mt-2 space-y-1">
          {saves.map((s) => (
            <li key={s.name} className="flex items-center justify-between gap-2 rounded-md bg-slate-900/50 px-2 py-1 text-sm">
              <span className="min-w-0 truncate text-slate-200">
                {s.name}
                <span className="ml-1.5 text-[11px] text-slate-500">
                  {new Date(s.savedAt).toLocaleString('nl-NL', { dateStyle: 'short', timeStyle: 'short' })}
                  {` · ${s.editions} ${s.editions === 1 ? 'editie' : 'edities'}`}
                </span>
              </span>
              <span className="flex shrink-0 gap-1">
                <Button variant="ghost" className="px-2! py-0.5!" onClick={() => run(() => onLoad(s.name))}>
                  Laden
                </Button>
                <Button variant="ghost" className="px-2! py-0.5!" onClick={() => run(() => deleteSave(s.name))}>
                  ✕
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="mt-2 text-xs text-rose-300">{error}</p>}
      <p className="mt-2 text-[11px] text-slate-500">
        Bewaart de hele festivalreeks: alle edities met rapporten, het kapitaal en het concept voor de volgende editie. Een
        simulatie die nog loopt wordt niet opgeslagen; die start na laden opnieuw vanaf 14:00. De reeks wordt ook automatisch
        bewaard in deze browser.
      </p>
    </Section>
  );
}
