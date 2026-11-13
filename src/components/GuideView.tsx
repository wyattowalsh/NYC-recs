import { type Dispatch, type ReactNode, type RefObject, type SetStateAction } from 'react';
import { Check, ChevronRight, Copy, LocateFixed, Map as MapIcon, Search, Share2, SlidersHorizontal, X, List } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Toggle } from '@/components/ui/toggle';
import { FilterGroup } from '@/components/FilterGroup';
import { placeIcons } from '@/components/PlaceCard';
import { GuideResults } from '@/components/GuideResults';
import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter, SheetClose } from '@/components/ui/sheet';
import { AREA_ORDER, TYPE_ORDER, TYPE_META, TRAITS, areaLabel, copyTextForRec, traitMatches, type Filters, type Rec } from '@/lib/guide';

function Entrance({ reducedMotion, children }: { reducedMotion: boolean; children: ReactNode }) {
  return <div className={reducedMotion ? undefined : 'entrance'}>{children}</div>;
}

export interface GuideViewProps {
  activeCount: number;
  allRecs: Rec[];
  clearFilters: () => void;
  coords: { lat: number; lon: number } | null;
  copy: (text: string, message: string) => Promise<void>;
  copyRec: (rec: Rec) => void;
  filters: Filters;
  fitMap: () => void;
  fitRequest: number;
  focusRequest: number;
  focusSelection: boolean;
  isFiltered: boolean;
  locating: boolean;
  mapError: string;
  mapPanel: RefObject<HTMLElement | null>;
  mobileView: 'map' | 'list';
  reducedMotion: boolean;
  selectRec: (id: string, source: 'map' | 'list' | 'details', keyboard?: boolean) => void;
  selected: Rec | null;
  setFilters: Dispatch<SetStateAction<Filters>>;
  setMapError: Dispatch<SetStateAction<string>>;
  setMobileView: Dispatch<SetStateAction<'map' | 'list'>>;
  setSheetOpen: Dispatch<SetStateAction<boolean>>;
  shareView: () => Promise<void>;
  sheetOpen: boolean;
  showDistances: () => void;
  toast: string;
  toggleFilter: (group: 'areas' | 'types' | 'traits', value: string) => void;
  visibleRecs: Rec[];
  zoomToSelection: boolean;
}

export function GuideView({
  activeCount, allRecs, clearFilters, coords, copy, copyRec, filters, fitMap, fitRequest,
  focusRequest, focusSelection, isFiltered, locating, mapError, mapPanel, mobileView,
  reducedMotion, selectRec, selected, setFilters, setMapError, setMobileView, setSheetOpen,
  shareView, sheetOpen, showDistances, toast, toggleFilter, visibleRecs, zoomToSelection,
}: GuideViewProps) {
  const filterGroups = <div className="filter-groups">
    <FilterGroup title="Area" subtitle="Start with a neighborhood" values={AREA_ORDER.filter((area) => allRecs.some((rec) => rec.area === area)).map((area) => ({ value: area, label: areaLabel(area), count: allRecs.filter((rec) => rec.area === area).length }))} selected={filters.areas} onToggle={(value) => toggleFilter('areas', value)} />
    <FilterGroup title="Type" subtitle="What are you in the mood for?" values={TYPE_ORDER.map((type) => ({ value: type, label: TYPE_META[type].label, count: allRecs.filter((rec) => rec.type === type).length }))} selected={filters.types} onToggle={(value) => toggleFilter('types', value)} />
    <FilterGroup title="Vibe" subtitle="Make it your kind of day" values={TRAITS.map((trait) => ({ value: trait.id, label: trait.label, count: allRecs.filter((rec) => traitMatches(trait.id, rec)).length }))} selected={filters.traits} onToggle={(value) => toggleFilter('traits', value)} />
  </div>;

  return <>
    <a className="skip-link" href="#places" onClick={(event) => { event.preventDefault(); setMobileView('list'); requestAnimationFrame(() => { const places = document.getElementById('places'); places?.focus({ preventScroll: true }); places?.scrollIntoView({ block: 'start' }); }); }}>Skip to places</a>
    <main className="guide-shell" data-mobile-view={mobileView}>
      <header className="masthead">
        <Entrance reducedMotion={reducedMotion}><div className="masthead-main">
          <div><p className="eyebrow"><span className="nyc-mark" aria-hidden="true">W.</span>A FRIEND’S GUIDE TO THE CITY</p><h1>Wyatt’s <span>NYC Recs</span><span className="title-period">.</span></h1><p className="intro">A few good places. A very good time.</p></div>
          <div className="masthead-side"><p>FOOD. DRINKS. MUSIC.<br />AND A LITTLE WANDERING.</p><Button variant="outline" className="share-button" onClick={shareView}><Share2 size={15} aria-hidden="true" />Share this guide</Button></div>
        </div></Entrance>
        <div className="city-ribbon" aria-hidden="true"><span /><span /><span /><span /></div>
      </header>

      <section className="guide-controls" aria-label="Find your next stop">
        <div className="search-row"><div className="search-box"><Search size={19} aria-hidden="true" /><label className="sr-only" htmlFor="searchInput">Search places, areas, and vibes</label><Input id="searchInput" type="search" autoComplete="off" spellCheck={false} placeholder="A place, a neighborhood, a vibe…" value={filters.query} onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value, pick: null }))} />{filters.query && <Button variant="ghost" size="icon" className="clear-search" aria-label="Clear search" onClick={() => setFilters((current) => ({ ...current, query: '', pick: null }))}><X size={17} /></Button>}</div>
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}><SheetTrigger asChild><Button variant="outline" className={`filter-trigger ${activeCount ? 'has-filters' : ''}`}><SlidersHorizontal size={16} aria-hidden="true" />Filters{activeCount > 0 && <span className="filter-count">{activeCount}</span>}</Button></SheetTrigger><SheetContent className="filter-sheet"><SheetHeader><SheetTitle>Find your kind of NYC.</SheetTitle><SheetDescription>Mix areas, types, and vibes. Choose a few, or leave room for a little wandering.</SheetDescription></SheetHeader>{filterGroups}<SheetFooter><Button variant="outline" onClick={clearFilters} disabled={!isFiltered}>Clear filters</Button><SheetClose asChild><Button>Show {visibleRecs.length} places<ChevronRight size={16} aria-hidden="true" /></Button></SheetClose></SheetFooter></SheetContent></Sheet>
          <Button variant="ghost" className="nearby-button" onClick={showDistances} disabled={locating}><LocateFixed size={17} aria-hidden="true" />{locating ? 'Finding you…' : coords ? 'Refresh distances' : 'Show distances'}</Button>
        </div>
        <div className="browse-row"><div className="type-filters" aria-label="Filter by type">{TYPE_ORDER.map((type) => { const Icon = placeIcons[type]; return <Toggle key={type} pressed={filters.types.includes(type)} onPressedChange={() => toggleFilter('types', type)} className={`type-toggle ${type}`} aria-label={`${TYPE_META[type].label} places`}><Icon size={15} aria-hidden="true" /><span>{TYPE_META[type].label}</span></Toggle>; })}</div><div className="browse-actions"><Button variant="ghost" onClick={() => void copy(`Wyatt’s NYC Recs\n${visibleRecs.map(copyTextForRec).join('\n\n')}`, `${visibleRecs.length} visible places copied`)}><Copy size={14} aria-hidden="true" /><span>Copy list</span></Button>{isFiltered && <Button variant="ghost" onClick={clearFilters} className="clear-filters"><X size={14} aria-hidden="true" />Clear all</Button>}</div></div>
        {(filters.areas.length > 0 || filters.traits.length > 0) && <div className="active-filters" aria-label="Selected filters">{filters.areas.map((value) => <Button variant="secondary" key={value} onClick={() => toggleFilter('areas', value)} aria-label={`Remove ${value} filter`}>{areaLabel(value)}<X size={12} aria-hidden="true" /></Button>)}{filters.traits.map((value) => <Button variant="secondary" key={value} onClick={() => toggleFilter('traits', value)} aria-label={`Remove ${TRAITS.find((v) => v.id === value)?.label} filter`}>{TRAITS.find((v) => v.id === value)?.label}<X size={12} aria-hidden="true" /></Button>)}</div>}
      </section>

      <div className="mobile-view-controls" aria-label="Choose map or list"><button type="button" aria-pressed={mobileView === 'map'} onClick={() => setMobileView('map')}><MapIcon size={16} aria-hidden="true" />The map</button><button type="button" aria-pressed={mobileView === 'list'} onClick={() => setMobileView('list')}><List size={16} aria-hidden="true" />The list<span>{visibleRecs.length}</span></button></div>
      <div className="mobile-utilities"><Button variant="ghost" onClick={showDistances} disabled={locating}><LocateFixed size={14} aria-hidden="true" />{locating ? 'Finding you…' : coords ? 'Refresh distances' : 'Show distances'}</Button><Button variant="ghost" onClick={() => void copy(`Wyatt’s NYC Recs\n${visibleRecs.map(copyTextForRec).join('\n\n')}`, `${visibleRecs.length} visible places copied`)}><Copy size={14} aria-hidden="true" />Copy list</Button>{isFiltered && <Button variant="ghost" onClick={clearFilters}><X size={14} aria-hidden="true" />Clear all</Button>}</div>

      <GuideResults
        allRecs={allRecs}
        clearFilters={clearFilters}
        coords={coords}
        copyRec={copyRec}
        fitMap={fitMap}
        fitRequest={fitRequest}
        focusRequest={focusRequest}
        focusSelection={focusSelection}
        mapError={mapError}
        mapPanel={mapPanel}
        mobileView={mobileView}
        reducedMotion={reducedMotion}
        selectRec={selectRec}
        selected={selected}
        setMapError={setMapError}
        setMobileView={setMobileView}
        visibleRecs={visibleRecs}
        zoomToSelection={zoomToSelection}
      />
    </main>
    {toast && <div className="toast" role="status"><Check size={16} aria-hidden="true" />{toast}</div>}
  </>;
}
