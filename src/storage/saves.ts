// IndexedDB-opslag voor ontwerpen. Een lopende simulatie wordt bewust NIET opgeslagen:
// na herladen start de simulatie opnieuw vanaf het begin met dezelfde seed.

import type { FestivalLayout, Program, ScenarioSettings } from '../model/types';
import type { FinalReport } from '../sim/types';

export const DB_NAME = 'festival-architect';
export const STORE = 'saves';
export const AUTOSAVE_NAME = '__autosave__';

export interface SaveFile {
  version: 1;
  name: string;
  savedAt: string;
  layout: FestivalLayout;
  program: Program;
  scenario: ScenarioSettings;
  seed: number;
  lastReport: FinalReport | null;
}

export interface SaveSummary {
  name: string;
  savedAt: string;
  hasReport: boolean;
}

export class SaveFormatError extends Error {}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

/** Controleert de vorm van een (mogelijk oud of beschadigd) savebestand. */
export function parseSave(raw: unknown): SaveFile {
  if (!isObj(raw)) throw new SaveFormatError('Geen geldig savebestand.');
  if (raw.version !== 1) throw new SaveFormatError(`Onbekende saveversie: ${String(raw.version)}.`);
  const layout = raw.layout;
  if (!isObj(layout) || !isObj(layout.grid) || !Array.isArray(layout.facilities)) {
    throw new SaveFormatError('Terrein ontbreekt of is beschadigd.');
  }
  const grid = layout.grid as Record<string, unknown>;
  const w = grid.width;
  const h = grid.height;
  if (typeof w !== 'number' || typeof h !== 'number' || !Array.isArray(grid.tiles) || grid.tiles.length !== w * h) {
    throw new SaveFormatError('Rasterafmetingen kloppen niet.');
  }
  if (!Array.isArray(grid.obstacleKinds) || grid.obstacleKinds.length !== w * h) {
    throw new SaveFormatError('Obstakelgegevens kloppen niet.');
  }
  for (const t of grid.tiles) {
    if (t !== 'grass' && t !== 'path' && t !== 'obstacle') throw new SaveFormatError(`Onbekend tegeltype: ${String(t)}.`);
  }
  for (const f of layout.facilities as unknown[]) {
    if (!isObj(f) || typeof f.id !== 'string' || typeof f.type !== 'string' || typeof f.x !== 'number' || typeof f.y !== 'number') {
      throw new SaveFormatError('Een voorziening is beschadigd.');
    }
  }
  if (!isObj(raw.program) || !Array.isArray(raw.program.performances)) throw new SaveFormatError('Programma ontbreekt.');
  if (!isObj(raw.scenario) || typeof raw.scenario.id !== 'string') throw new SaveFormatError('Scenario ontbreekt.');
  if (typeof raw.seed !== 'number' || !Number.isFinite(raw.seed)) throw new SaveFormatError('Seed ontbreekt.');
  if (typeof raw.name !== 'string') throw new SaveFormatError('Naam ontbreekt.');
  return raw as unknown as SaveFile;
}

function openDb(factory: IDBFactory = indexedDB): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = factory.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'name' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
  factory?: IDBFactory,
): Promise<T> {
  return openDb(factory).then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = run(t.objectStore(STORE));
        t.oncomplete = () => {
          db.close();
          resolve(req.result);
        };
        t.onerror = () => {
          db.close();
          reject(t.error ?? req.error);
        };
      }),
  );
}

export async function writeSave(save: SaveFile, factory?: IDBFactory): Promise<void> {
  // Via JSON, zodat typed arrays e.d. nooit per ongeluk meegaan.
  const plain = JSON.parse(JSON.stringify(save)) as SaveFile;
  await tx('readwrite', (s) => s.put(plain), factory);
}

export async function readSave(name: string, factory?: IDBFactory): Promise<SaveFile | null> {
  const raw = await tx<unknown>('readonly', (s) => s.get(name), factory);
  return raw === undefined ? null : parseSave(raw);
}

export async function listSaves(factory?: IDBFactory): Promise<SaveSummary[]> {
  const all = await tx<unknown[]>('readonly', (s) => s.getAll(), factory);
  return all
    .filter(isObj)
    .filter((r) => r.name !== AUTOSAVE_NAME)
    .map((r) => ({ name: String(r.name), savedAt: String(r.savedAt), hasReport: r.lastReport != null }))
    .sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

export async function deleteSave(name: string, factory?: IDBFactory): Promise<void> {
  await tx('readwrite', (s) => s.delete(name), factory);
}
