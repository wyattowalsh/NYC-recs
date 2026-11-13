export const AREA_ORDER = [
  'Queens',
  'Central Manhattan',
  'Downtown Manhattan',
  'Brooklyn',
  'Uptown',
  'Waterfront / islands',
] as const;
export type Area = typeof AREA_ORDER[number];

export const TYPE_ORDER = ['food', 'drinks', 'music', 'activity', 'outdoors'] as const;
export type PlaceType = typeof TYPE_ORDER[number];

export const TYPE_META: Record<PlaceType, { label: string; short: string }> = {
  food: { label: 'Food', short: 'F' },
  drinks: { label: 'Drinks', short: 'D' },
  music: { label: 'Music', short: 'M' },
  activity: { label: 'Activity', short: 'A' },
  outdoors: { label: 'Outside', short: 'O' },
};

export const TRAITS = [
  { id: 'hiddenish', label: 'Hidden-ish' },
  { id: 'lowkey', label: 'Low-key' },
  { id: 'group', label: 'Group' },
  { id: 'views', label: 'Views' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'rainy', label: 'Rain-safe' },
  { id: 'polished', label: 'Polished' },
] as const;
export type TraitId = typeof TRAITS[number]['id'];

export interface SiteLink {
  label: string;
  url: string;
}

export interface Rec {
  id: string;
  name: string;
  area: Area;
  where: string;
  vibe: string;
  type: PlaceType;
  typeLabel: string;
  tags: string[];
  blurb: string;
  fit: string;
  gmaps: string;
  siteLinks: SiteLink[];
  lat: number;
  lon: number;
  places?: string;
  primaryPlace?: string;
  statusChecked?: string;
  searchText: string;
}

export interface Filters {
  query: string;
  areas: Area[];
  types: PlaceType[];
  traits: TraitId[];
  pick: string | null;
}

export const EMPTY_FILTERS: Filters = { query: '', areas: [], types: [], traits: [], pick: null };
export const normalize = (value: string) => value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
export const areaLabel = (area: Area) => area.replace('Central Manhattan', 'Central').replace('Downtown Manhattan', 'Downtown').replace('Waterfront / islands', 'Waterfront');
export const closureLabel = (rec: Rec) => rec.tags.includes('permanently-closed') ? 'Permanently closed' : rec.tags.includes('temporarily-closed') ? 'Temporarily closed' : null;
export const mapLinkLabel = (rec: Rec, compact = false) => rec.primaryPlace ? `Maps to ${rec.primaryPlace}` : compact ? 'Maps' : 'Google Maps';
export const distanceLabel = (rec: Rec, miles: number) => rec.primaryPlace ? `${miles.toFixed(1)} mi from ${rec.primaryPlace}` : `${miles.toFixed(1)} mi away`;

export function closureNotice(rec: Rec): string | null {
  const label = closureLabel(rec);
  if (!label) return null;
  if (!rec.statusChecked) return `${label} on Google Maps`;
  const checked = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${rec.statusChecked}T00:00:00Z`));
  return `${label} on Google Maps · checked ${checked}`;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function fail(index: number, id: string | undefined, field: string, message: string): never {
  const place = id ? ` (${id})` : '';
  throw new Error(`Recommendation ${index + 1}${place}: ${field} ${message}.`);
}

function requiredString(record: Record<string, unknown>, key: string, index: number, id?: string): string {
  const value = record[key];
  if (typeof value !== 'string' || !value.trim()) fail(index, id, key, 'must be a non-empty string');
  return value;
}

function optionalString(record: Record<string, unknown>, key: string, index: number, id?: string): string | undefined {
  const value = record[key];
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !value.trim()) fail(index, id, key, 'must be a non-empty string when provided');
  return value;
}


function optionalIsoDate(record: Record<string, unknown>, key: string, index: number, id?: string): string | undefined {
  const value = optionalString(record, key, index, id);
  if (!value) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) fail(index, id, key, 'must use YYYY-MM-DD');
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    fail(index, id, key, 'must be a real calendar date');
  }
  return value;
}

function httpsUrl(record: Record<string, unknown>, key: string, index: number, id?: string): string {
  const value = requiredString(record, key, index, id);
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    fail(index, id, key, 'must be a valid HTTPS URL');
  }
  if (parsed.protocol !== 'https:') fail(index, id, key, 'must use HTTPS');
  return value;
}

function stringArray(record: Record<string, unknown>, key: string, index: number, id?: string): string[] {
  const value = record[key];
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || !item.trim())) {
    fail(index, id, key, 'must be an array of non-empty strings');
  }
  return [...value] as string[];
}

function siteLinks(record: Record<string, unknown>, index: number, id?: string): SiteLink[] {
  const value = record.siteLinks;
  if (!Array.isArray(value)) fail(index, id, 'siteLinks', 'must be an array');
  return value.map((link, linkIndex) => {
    if (!isObject(link)) fail(index, id, `siteLinks[${linkIndex}]`, 'must be an object');
    const label = requiredString(link, 'label', index, id);
    const url = httpsUrl(link, 'url', index, id);
    return { label, url };
  });
}

function coordinate(record: Record<string, unknown>, key: 'lat' | 'lon', index: number, id?: string): number {
  const value = record[key];
  const [minimum, maximum] = key === 'lat' ? [-90, 90] : [-180, 180];
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum || value > maximum) {
    fail(index, id, key, `must be a finite number from ${minimum} to ${maximum}`);
  }
  return value;
}

export function prepareRecs(raw: unknown): Rec[] {
  if (!Array.isArray(raw) || !raw.length) throw new Error('No recommendations found.');
  const ids = new Set<string>();

  return raw.map((value, index) => {
    if (!isObject(value)) fail(index, undefined, 'record', 'must be an object');
    const id = requiredString(value, 'id', index);
    if (ids.has(id)) fail(index, id, 'id', 'must be unique');
    ids.add(id);

    const areaValue = requiredString(value, 'area', index, id);
    if (!AREA_ORDER.includes(areaValue as Area)) fail(index, id, 'area', `must be one of ${AREA_ORDER.join(', ')}`);
    const typeValue = requiredString(value, 'type', index, id);
    if (!TYPE_ORDER.includes(typeValue as PlaceType)) fail(index, id, 'type', `must be one of ${TYPE_ORDER.join(', ')}`);

    const name = requiredString(value, 'name', index, id);
    const area = areaValue as Area;
    const where = requiredString(value, 'where', index, id);
    const vibe = requiredString(value, 'vibe', index, id);
    const type = typeValue as PlaceType;
    const typeLabel = requiredString(value, 'typeLabel', index, id);
    const tags = stringArray(value, 'tags', index, id);
    const blurb = requiredString(value, 'blurb', index, id);
    const fit = requiredString(value, 'fit', index, id);
    const gmaps = httpsUrl(value, 'gmaps', index, id);
    const links = siteLinks(value, index, id);
    const lat = coordinate(value, 'lat', index, id);
    const lon = coordinate(value, 'lon', index, id);
    const places = optionalString(value, 'places', index, id);
    const primaryPlace = optionalString(value, 'primaryPlace', index, id);
    const statusChecked = optionalIsoDate(value, 'statusChecked', index, id);

    const rec: Rec = {
      id, name, area, where, vibe, type, typeLabel, tags, blurb, fit, gmaps,
      siteLinks: links, lat, lon, places, primaryPlace, statusChecked,
      searchText: '',
    };
    rec.searchText = normalize([
      name, area, where, vibe, type, typeLabel, blurb, fit,
      places ?? '', primaryPlace ?? '', ...tags, ...links.map((link) => link.label),
    ].join(' '));
    return rec;
  });
}

export function traitMatches(trait: TraitId, rec: Rec): boolean {
  const tags = new Set(rec.tags.map(normalize));
  const has = (...names: string[]) => names.some((name) => tags.has(name));
  const hay = rec.searchText;
  switch (trait) {
    case 'hiddenish': return has('hidden-ish', 'hidden', 'low-key', 'quirky') || hay.includes('speakeasy');
    case 'lowkey': return has('low-key', 'easy', 'local', 'casual', 'cafe');
    case 'group': return has('group', 'group-friendly') || hay.includes('group');
    case 'views': return has('views', 'rooftop', 'outside') || rec.type === 'outdoors';
    case 'calendar': return has('calendar', 'concert', 'dancing') || rec.type === 'music';
    case 'rainy': return has('rainy', 'indoors', 'books', 'museum', 'activity') || rec.type === 'activity';
    case 'polished': return has('polished', 'date-y', 'wine', 'intimate') || hay.includes('speakeasy') || hay.includes('cocktail');
  }
}

export function filterRecs(recs: Rec[], filters: Filters) {
  const query = normalize(filters.query.trim());
  return recs.filter((rec) => (!query || rec.searchText.includes(query))
    && (!filters.areas.length || filters.areas.includes(rec.area))
    && (!filters.types.length || filters.types.includes(rec.type))
    && (!filters.traits.length || filters.traits.some((trait) => traitMatches(trait, rec))));
}

export function readFilters(search: string, recs: Rec[]): Filters {
  const params = new URLSearchParams(search);
  const split = <T extends string>(key: string, valid: readonly T[]): T[] => [...new Set((params.get(key) || '').split(',').map((value) => value.trim()).filter((value): value is T => valid.includes(value as T)))];
  const pick = params.get('pick');
  return {
    query: params.get('q') || '',
    areas: split('area', AREA_ORDER),
    types: split('type', TYPE_ORDER),
    traits: split('vibe', TRAITS.map((trait) => trait.id)),
    pick: recs.some((rec) => rec.id === pick) ? pick : null,
  };
}

export function filtersToSearch(filters: Filters) {
  const params = new URLSearchParams();
  if (filters.query.trim()) params.set('q', filters.query.trim());
  if (filters.areas.length) params.set('area', filters.areas.join(','));
  if (filters.types.length) params.set('type', filters.types.join(','));
  if (filters.traits.length) params.set('vibe', filters.traits.join(','));
  if (filters.pick) params.set('pick', filters.pick);
  return params.toString();
}

export function copyTextForRec(rec: Rec) {
  const links = [`${mapLinkLabel(rec)}: ${rec.gmaps}`, ...rec.siteLinks.map((link) => `${link.label}: ${link.url}`)].join(' | ');
  return `• ${rec.name} — ${rec.where} — ${rec.vibe}\n  ${rec.blurb}\n  Good for: ${rec.fit}\n  ${links}`;
}

export function distanceMiles(aLat: number, aLon: number, bLat: number, bLon: number) {
  const rad = (value: number) => value * Math.PI / 180;
  const dLat = rad(bLat - aLat);
  const dLon = rad(bLon - aLon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 3958.8 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}
