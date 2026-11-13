import { lazy, Suspense, type RefObject } from 'react';
import { ArrowDown, ArrowUpRight, ChevronRight, Copy, Map as MapIcon, MapPin, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LocalBoundary } from '@/components/LocalBoundary';
import { ClosureNotice, ExternalLinks, PlaceCard } from '@/components/PlaceCard';
import { AREA_ORDER, closureLabel, distanceMiles, type Rec } from '@/lib/guide';

const GuideMap = lazy(() => import('@/components/GuideMap').then((module) => ({ default: module.GuideMap })));

export interface GuideResultsProps {
  allRecs: Rec[];
  clearFilters: () => void;
  coords: { lat: number; lon: number } | null;
  copyRec: (rec: Rec) => void;
  fitMap: () => void;
  fitRequest: number;
  focusRequest: number;
  focusSelection: boolean;
  mapError: string;
  mapPanel: RefObject<HTMLElement | null>;
  mobileView: 'map' | 'list';
  reducedMotion: boolean;
  selectRec: (id: string, source: 'map' | 'list' | 'details', keyboard?: boolean) => void;
  selected: Rec | null;
  setMapError: (value: string) => void;
  setMobileView: (value: 'map' | 'list') => void;
  visibleRecs: Rec[];
  zoomToSelection: boolean;
}

export function GuideResults({
  allRecs, clearFilters, coords, copyRec, fitMap, fitRequest, focusRequest, focusSelection,
  mapError, mapPanel, mobileView, reducedMotion, selectRec, selected, setMapError,
  setMobileView, visibleRecs, zoomToSelection,
}: GuideResultsProps) {
  return <div className="main-grid">
        <aside className="map-panel" ref={mapPanel} tabIndex={-1} aria-label="Explore the map"><div className="map-toolbar"><span><span className="live-dot" />THE LAY OF THE LAND</span><Button variant="ghost" onClick={fitMap}><MapIcon size={14} aria-hidden="true" />Fit map</Button></div>
          <LocalBoundary fallback={<div className="map-canvas map-loading" role="status"><MapPin size={24} aria-hidden="true" /><strong>The map couldn’t load.</strong><p>Every place and its original Google Maps link is still in the list.</p><Button onClick={() => { setMobileView('list'); requestAnimationFrame(() => { const list = document.getElementById('places'); list?.focus({ preventScroll: true }); list?.scrollIntoView({ block: 'start' }); }); }}>Browse the list<ChevronRight size={15} aria-hidden="true" /></Button></div>}><Suspense fallback={<div className="map-canvas map-loading" role="status"><MapPin size={22} aria-hidden="true" /><span>Unfolding the map…</span></div>}><GuideMap key={reducedMotion ? 'reduced' : 'motion'} recs={visibleRecs} selectedId={selected?.id || null} focusRequest={focusRequest} zoomToSelection={zoomToSelection} focusSelection={focusSelection} fitRequest={fitRequest} reducedMotion={reducedMotion} viewMode={mobileView} onSelect={selectRec} onError={setMapError} /></Suspense></LocalBoundary>
          {mapError && <p className="map-error" role="status">{mapError}<button type="button" aria-label="Dismiss map message" onClick={() => setMapError('')}><X size={14} /></button></p>}
          <div className={`focus-dock ${selected ? 'has-selection' : ''}`} aria-live="polite">{selected ? <><div className="focus-info"><span className={`place-category ${selected.type}`}><MapPin size={12} aria-hidden="true" />{closureLabel(selected) ? 'VENUE REFERENCE' : 'YOUR NEXT STOP?'}</span><h2>{selected.name}</h2><ClosureNotice rec={selected} /><p>{selected.where} · {selected.vibe}</p></div><div className="focus-actions"><ExternalLinks rec={selected} /><Button size="icon" variant="ghost" onClick={() => copyRec(selected)} aria-label={`Copy ${selected.name}`}><Copy size={15} /></Button><Button size="icon" variant="ghost" onClick={fitMap} aria-label="Clear focus"><X size={18} /></Button></div></> : <><MapPin size={20} aria-hidden="true" /><p>{visibleRecs.length ? 'A good day starts with a pin.' : 'A little too specific?'}<span>{visibleRecs.length ? 'Tap a place to see what’s good.' : 'Clear a filter to find your next stop.'}</span></p><span className="map-instruction" aria-hidden="true">↗</span></>}</div>
        </aside>

        <section className="list-panel" id="places" tabIndex={-1} aria-labelledby="places-title"><div className="list-heading"><div><p className="eyebrow">THE SHORTLIST</p><h2 id="places-title">Somewhere good.</h2></div><div className="result-count" role="status"><span className="sr-only">{visibleRecs.length} of {allRecs.length} places shown</span><span aria-hidden="true">{visibleRecs.length}<small> / {allRecs.length}</small><span className="count-label">PLACES</span></span></div></div>
          {!visibleRecs.length ? <div className="empty-state"><Search size={27} aria-hidden="true" /><h3>No places match just yet.</h3><p>Try another neighborhood, loosen a filter, or start fresh.</p><Button onClick={clearFilters}>Show all places<ArrowUpRight size={15} aria-hidden="true" /></Button></div> : <div className="area-sections">{AREA_ORDER.map((area) => { const places = visibleRecs.filter((rec) => rec.area === area); if (!places.length) return null; return <section key={area} className="area-section" aria-labelledby={`area-${AREA_ORDER.indexOf(area)}`}><div className="area-heading"><h2 id={`area-${AREA_ORDER.indexOf(area)}`}>{area}</h2><span>{String(places.length).padStart(2, '0')}</span></div>{places.map((rec) => <PlaceCard key={rec.id} rec={rec} selected={selected?.id === rec.id} distance={coords ? distanceMiles(coords.lat, coords.lon, rec.lat, rec.lon) : undefined} onSelect={selectRec} onCopy={copyRec} />)}</section>; })}</div>}
          <div className="list-footer"><span className="nyc-mark" aria-hidden="true">W.</span><p>Good company makes the place.<br /><span>Check a spot’s site for hours, reservations, and what’s on.</span></p><Button variant="ghost" size="icon" onClick={() => window.scrollTo({ top: 0, behavior: reducedMotion ? 'instant' : 'smooth' })} aria-label="Back to top"><ArrowDown className="back-up" size={18} /></Button></div>
        </section>
      </div>;
}
