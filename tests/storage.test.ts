import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { designSignature } from '../src/model/layout';
import { buildReport } from '../src/sim/report';
import { createSimulation, hashState, runToEnd } from '../src/sim/simulation';
import { AUTOSAVE_NAME, deleteSave, listSaves, parseSave, readSave, SaveFormatError, writeSave, type SaveFile } from '../src/storage/saves';
import { exampleInput } from './helpers';

function makeSave(name: string, withReport: boolean): SaveFile {
  const input = exampleInput();
  return {
    version: 1,
    name,
    savedAt: '2026-10-28T12:00:00.000Z',
    layout: input.layout,
    program: input.program,
    scenario: input.scenario,
    seed: input.seed,
    lastReport: withReport ? buildReport(runToEnd(createSimulation(input))) : null,
  };
}

describe('opslaan en herladen (criterium 8)', () => {
  beforeEach(() => {
    globalThis.indexedDB = new IDBFactory();
  });

  it('bewaart terrein, programma, instellingen, seed en eindrapport', async () => {
    const save = makeSave('Test', true);
    await writeSave(save);
    const loaded = await readSave('Test');
    expect(loaded).toEqual(save);
  });

  it('een herladen ontwerp geeft dezelfde simulatie-uitkomst', async () => {
    const save = makeSave('Repro', true);
    await writeSave(save);
    const loaded = (await readSave('Repro'))!;
    const s = runToEnd(createSimulation({ layout: loaded.layout, program: loaded.program, scenario: loaded.scenario, seed: loaded.seed }));
    expect(hashState(s)).toBe(hashState(runToEnd(createSimulation(exampleInput()))));
    expect(buildReport(s)).toEqual(loaded.lastReport);
    expect(designSignature(loaded.layout, loaded.program, loaded.seed, 150)).toBe(loaded.lastReport!.signature);
  });

  it('lijst, overschrijft en verwijdert saves; autosave staat niet in de lijst', async () => {
    await writeSave(makeSave('A', false));
    await writeSave({ ...makeSave('B', false), savedAt: '2026-10-28T13:00:00.000Z' });
    await writeSave(makeSave(AUTOSAVE_NAME, false));
    expect((await listSaves()).map((s) => s.name)).toEqual(['B', 'A']);
    await writeSave({ ...makeSave('A', false), seed: 99 });
    expect((await readSave('A'))!.seed).toBe(99);
    await deleteSave('A');
    expect(await readSave('A')).toBeNull();
    expect((await listSaves()).map((s) => s.name)).toEqual(['B']);
  });

  it('weigert beschadigde of onbekende savebestanden', () => {
    const good = JSON.parse(JSON.stringify(makeSave('X', false)));
    expect(() => parseSave(good)).not.toThrow();
    expect(() => parseSave(null)).toThrow(SaveFormatError);
    expect(() => parseSave({ ...good, version: 2 })).toThrow(/saveversie/);
    expect(() => parseSave({ ...good, layout: { ...good.layout, grid: { ...good.layout.grid, tiles: [] } } })).toThrow(/Rasterafmetingen/);
    expect(() => parseSave({ ...good, seed: 'abc' })).toThrow(/Seed/);
  });
});
