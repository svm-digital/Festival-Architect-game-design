import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it } from 'vitest';
import { createCampaign, currentCapital, previousSatisfaction, recordEdition, type Campaign } from '../src/game/campaign';
import { computeDemand } from '../src/model/economy';
import { buildReport } from '../src/sim/report';
import { createSimulation, runToEnd } from '../src/sim/simulation';
import { AUTOSAVE_NAME, deleteSave, listSaves, parseSave, readSave, SaveFormatError, writeSave, type SaveFile } from '../src/storage/saves';
import { example, S } from './helpers';

function campaignWithEdition(): Campaign {
  const { layout, program } = example();
  let c = createCampaign('Test', S, { layout, program, seed: 7, ticketPrice: 40 });
  const demand = computeDemand(S, program, 40, previousSatisfaction(c));
  const report = buildReport(runToEnd(createSimulation({ layout, program, scenario: S, seed: 7, demand, capitalStart: currentCapital(c) })));
  c = recordEdition(c, c.draft, report, '2026-10-30T10:00:00.000Z');
  return c;
}

const save = (name: string, campaign: Campaign, savedAt = '2026-10-30T12:00:00.000Z'): SaveFile => ({ version: 2, name, savedAt, campaign });

describe('opslaan en herladen (criterium 8)', () => {
  beforeEach(() => {
    globalThis.indexedDB = new IDBFactory();
  });

  it('bewaart de hele reeks: edities, rapporten, kapitaal en concept', async () => {
    const c = campaignWithEdition();
    await writeSave(save('Reeks', c));
    const loaded = (await readSave('Reeks'))!;
    expect(loaded.campaign).toEqual(c);
    expect(currentCapital(loaded.campaign)).toBe(currentCapital(c));
  });

  it('een herladen editie geeft opnieuw exact hetzelfde rapport', async () => {
    const c = campaignWithEdition();
    await writeSave(save('Repro', c));
    const loaded = (await readSave('Repro'))!.campaign;
    const e = loaded.editions[0];
    const demand = computeDemand(S, e.program, e.ticketPrice, null);
    const again = buildReport(runToEnd(createSimulation({ layout: e.layout, program: e.program, scenario: S, seed: e.seed, demand, capitalStart: S.startCapital })));
    expect(again).toEqual(e.report);
  });

  it('lijst, overschrijft en verwijdert saves; autosave staat niet in de lijst', async () => {
    const c = campaignWithEdition();
    await writeSave(save('A', c));
    await writeSave(save('B', c, '2026-10-30T13:00:00.000Z'));
    await writeSave(save(AUTOSAVE_NAME, c));
    const list = await listSaves();
    expect(list.map((s) => s.name)).toEqual(['B', 'A']);
    expect(list[0].editions).toBe(1);
    await deleteSave('A');
    expect(await readSave('A')).toBeNull();
  });

  it('zet een v1-save (los ontwerp) om naar een nieuwe reeks', () => {
    const { layout, program } = example();
    const v1 = { version: 1, name: 'Oud', savedAt: 'x', layout, program, scenario: { id: 'compact-festival' }, seed: 5, lastReport: null };
    const parsed = parseSave(JSON.parse(JSON.stringify(v1)));
    expect(parsed.version).toBe(2);
    expect(parsed.campaign.editions).toEqual([]);
    expect(parsed.campaign.draft.seed).toBe(5);
    expect(parsed.campaign.draft.layout.facilities).toHaveLength(layout.facilities.length);
    expect(currentCapital(parsed.campaign)).toBe(S.startCapital);
  });

  it('weigert beschadigde of onbekende savebestanden', () => {
    const good = JSON.parse(JSON.stringify(save('X', campaignWithEdition())));
    expect(() => parseSave(good)).not.toThrow();
    expect(() => parseSave(null)).toThrow(SaveFormatError);
    expect(() => parseSave({ ...good, version: 3 })).toThrow(/saveversie/);
    const badGrid = structuredClone(good);
    badGrid.campaign.draft.layout.grid.tiles = [];
    expect(() => parseSave(badGrid)).toThrow(/Rasterafmetingen/);
    const badEdition = structuredClone(good);
    delete badEdition.campaign.editions[0].report.finance;
    expect(() => parseSave(badEdition)).toThrow(/editie/);
  });
});
