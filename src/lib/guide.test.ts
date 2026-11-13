import { test } from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/recs';
import {
  AREA_ORDER,
  EMPTY_FILTERS,
  closureNotice,
  copyTextForRec,
  distanceMiles,
  filterRecs,
  filtersToSearch,
  mapLinkLabel,
  prepareRecs,
  readFilters,
} from './guide.ts';

const recs = prepareRecs(data);
const fixture = () => structuredClone(data[0]) as Record<string, unknown>;

test('all original destinations and site links pass through unchanged', () => {
  assert.equal(recs.length, 60);
  for (const rec of recs) {
    const original = data.find((value) => value.id === rec.id)!;
    assert.equal(rec.gmaps, original.gmaps);
    assert.deepEqual(rec.siteLinks, original.siteLinks);
    assert.ok(copyTextForRec(rec).includes(original.gmaps));
  }
  assert.equal(AREA_ORDER.flatMap((area) => recs.filter((rec) => rec.area === area)).length, recs.length);
});

test('combined groups use AND and choices within a group use OR', () => {
  const filters = { ...EMPTY_FILTERS, areas: ['Queens'] as const, types: ['food'] as const, traits: ['lowkey', 'group'] as const };
  const visible = filterRecs(recs, { ...filters, areas: [...filters.areas], types: [...filters.types], traits: [...filters.traits] });
  assert.ok(visible.length > 0);
  assert.ok(visible.every((rec) => filters.areas.includes(rec.area as 'Queens') && rec.type === 'food'));
  const lowkey = filterRecs(recs, { ...EMPTY_FILTERS, areas: ['Queens'], types: ['food'], traits: ['lowkey'] });
  const group = filterRecs(recs, { ...EMPTY_FILTERS, areas: ['Queens'], types: ['food'], traits: ['group'] });
  assert.deepEqual(new Set(visible.map((rec) => rec.id)), new Set([...lowkey, ...group].map((rec) => rec.id)));
});

test('accented searches and empty states remain meaningful', () => {
  assert.ok(filterRecs(recs, { ...EMPTY_FILTERS, query: 'bonte' }).some((rec) => rec.name === 'Madame Bonté'));
  assert.equal(filterRecs(recs, { ...EMPTY_FILTERS, query: 'xyznothinghere' }).length, 0);
});

test('shared URLs round-trip all filter groups and selected place, rejecting unknown values', () => {
  const filters = { query: 'cafe', areas: ['Queens'] as const, types: ['food'] as const, traits: ['lowkey'] as const, pick: recs[0].id };
  assert.deepEqual(readFilters(filtersToSearch({ ...filters, areas: [...filters.areas], types: [...filters.types], traits: [...filters.traits] }), recs), filters);
  assert.deepEqual(readFilters('?area=Moon&type=nope&vibe=wrong&pick=missing', recs), EMPTY_FILTERS);
});

test('distance calculation returns miles with identity and symmetry', () => {
  assert.equal(distanceMiles(40.7, -74, 40.7, -74), 0);
  assert.ok(Math.abs(distanceMiles(40.7, -74, 40.8, -73.9) - distanceMiles(40.8, -73.9, 40.7, -74)) < 1e-9);
});

test('content validation rejects broken consumer contracts with field context', () => {
  assert.throws(() => prepareRecs([{ ...fixture(), area: 'Queeens' }]), /area must be one of/);
  assert.throws(() => prepareRecs([{ ...fixture(), tags: ['food', 42] }]), /tags must be an array/);
  assert.throws(() => prepareRecs([{ ...fixture(), lat: 999 }]), /lat must be a finite number/);
  assert.throws(() => prepareRecs([{ ...fixture(), siteLinks: [{ label: 'Site', url: 'http:\/\/example.com' }] }]), /must use HTTPS/);
  assert.throws(() => prepareRecs([{ ...fixture(), statusChecked: '2026-02-30' }]), /must be a real calendar date/);
  const duplicate = fixture();
  assert.throws(() => prepareRecs([duplicate, structuredClone(duplicate)]), /id must be unique/);
});

test('paired recommendations name the mapped stop and closure references carry review dates', () => {
  const paired = recs.filter((rec) => rec.primaryPlace);
  assert.ok(paired.length >= 5);
  assert.ok(paired.every((rec) => mapLinkLabel(rec).includes(rec.primaryPlace!)));
  const closureReferences = recs.filter((rec) => closureNotice(rec));
  assert.equal(closureReferences.length, 3);
  assert.ok(closureReferences.every((rec) => rec.statusChecked === '2026-11-11' && closureNotice(rec)?.includes('checked Nov 11, 2026')));
});
