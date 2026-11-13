import { useEffect, useMemo, useRef, useState } from 'react';
import type { GuideViewProps } from '@/components/GuideView';
import { EMPTY_FILTERS, copyTextForRec, filterRecs, readFilters, type Filters, type Rec } from '@/lib/guide';
import { buildGuidePath, createCoalescedHistoryWriter } from '@/lib/urlState';

function useReducedMotion() {
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const changed = () => setReduced(media.matches);
    media.addEventListener('change', changed);
    return () => media.removeEventListener('change', changed);
  }, []);
  return reduced;
}

export function useGuideController(allRecs: Rec[]): Omit<GuideViewProps, 'allRecs'> {
  const reducedMotion = useReducedMotion();
    const [filters, setFilters] = useState<Filters>(() => readFilters(window.location.search, allRecs));
    const [mobileView, setMobileView] = useState<'map' | 'list'>('map');
    const [focusRequest, setFocusRequest] = useState(0);
    const [zoomToSelection, setZoomToSelection] = useState(true);
    const [focusSelection, setFocusSelection] = useState(false);
    const [fitRequest, setFitRequest] = useState(0);
    const [toast, setToast] = useState('');
    const [mapError, setMapError] = useState('');
    const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
    const [locating, setLocating] = useState(false);
    const [sheetOpen, setSheetOpen] = useState(false);
    const toastTimer = useRef<number | undefined>(undefined);
    const locationRequest = useRef(0);
    const mapPanel = useRef<HTMLElement>(null);
    const historyWriter = useRef<ReturnType<typeof createCoalescedHistoryWriter<number>> | null>(null);
    if (!historyWriter.current) {
      historyWriter.current = createCoalescedHistoryWriter({
        getCurrentUrl: () => `${window.location.pathname}${window.location.search}${window.location.hash}`,
        replaceUrl: (url) => window.history.replaceState(window.history.state, '', url),
        scheduleTask: (callback, delayMs) => window.setTimeout(callback, delayMs),
        cancelTask: (handle) => window.clearTimeout(handle),
        onError: (error) => console.warn('Could not persist guide state in the address bar.', error),
      });
    }
    const visibleRecs = useMemo(() => filterRecs(allRecs, filters), [filters.query, filters.areas, filters.types, filters.traits]);
    const selected = visibleRecs.find((rec) => rec.id === filters.pick) || null;
    const activeCount = filters.areas.length + filters.types.length + filters.traits.length;
    const isFiltered = !!(activeCount || filters.query.trim());
  
    useEffect(() => {
      if (filters.pick && !visibleRecs.some((rec) => rec.id === filters.pick)) setFilters((current) => ({ ...current, pick: null }));
    }, [visibleRecs, filters.pick]);
    useEffect(() => {
      historyWriter.current?.schedule(buildGuidePath({ ...filters, pick: selected?.id || null }, window.location.pathname, window.location.hash));
    }, [filters, selected]);
    useEffect(() => {
      const restore = () => {
        historyWriter.current?.cancel();
        setFocusSelection(false);
        setZoomToSelection(true);
        setFocusRequest((request) => request + 1);
        setFilters(readFilters(window.location.search, allRecs));
      };
      window.addEventListener('popstate', restore);
      return () => window.removeEventListener('popstate', restore);
    }, []);
    useEffect(() => () => {
      historyWriter.current?.cancel();
      locationRequest.current += 1;
      window.clearTimeout(toastTimer.current);
    }, []);
  
    function notify(message: string) {
      setToast(message);
      window.clearTimeout(toastTimer.current);
      toastTimer.current = window.setTimeout(() => setToast(''), 3600);
    }
    function toggleFilter(group: 'areas' | 'types' | 'traits', value: string) {
      setFilters((current) => {
        if (group === 'areas') {
          const candidate = value as Filters['areas'][number];
          return { ...current, pick: null, areas: current.areas.includes(candidate) ? current.areas.filter((item) => item !== candidate) : [...current.areas, candidate] };
        }
        if (group === 'types') {
          const candidate = value as Filters['types'][number];
          return { ...current, pick: null, types: current.types.includes(candidate) ? current.types.filter((item) => item !== candidate) : [...current.types, candidate] };
        }
        const candidate = value as Filters['traits'][number];
        return { ...current, pick: null, traits: current.traits.includes(candidate) ? current.traits.filter((item) => item !== candidate) : [...current.traits, candidate] };
      });
    }
    function clearFilters() { setFilters({ ...EMPTY_FILTERS }); }
    function selectRec(id: string, source: 'map' | 'list' | 'details', keyboard = false) {
      setFilters((current) => ({ ...current, pick: id }));
      setZoomToSelection(source === 'list');
      setFocusSelection(keyboard && source !== 'details');
      setFocusRequest((request) => request + 1);
      if (source === 'details') {
        setMobileView('list');
        requestAnimationFrame(() => {
          const card = document.getElementById(`pick-${id}`);
          card?.querySelector<HTMLButtonElement>('.place-title')?.focus({ preventScroll: true });
          card?.scrollIntoView({ behavior: reducedMotion ? 'instant' : 'smooth', block: 'nearest' });
        });
      } else if (source === 'list') {
        setMobileView('map');
        requestAnimationFrame(() => {
          if (keyboard) mapPanel.current?.focus({ preventScroll: true });
          if (window.matchMedia('(max-width: 800px)').matches) mapPanel.current?.scrollIntoView({ behavior: reducedMotion ? 'instant' : 'smooth', block: 'start' });
        });
      } else if (window.matchMedia('(min-width: 801px)').matches) {
        document.getElementById(`pick-${id}`)?.scrollIntoView({ behavior: reducedMotion ? 'instant' : 'smooth', block: 'nearest' });
      }
    }
    function fitMap() { setFilters((current) => ({ ...current, pick: null })); setFitRequest((request) => request + 1); }
    async function copy(text: string, message: string) {
      try {
        await navigator.clipboard.writeText(text);
        notify(message);
      } catch { notify('Copy is unavailable in this browser. You can still open and share the original links.'); }
    }
    function copyRec(rec: Rec) { void copy(copyTextForRec(rec), `${rec.name} copied`); }
    async function shareView() {
      const relativeUrl = buildGuidePath({ ...filters, pick: selected?.id || null }, window.location.pathname, window.location.hash);
      const shareData = { title: 'Wyatt’s NYC Recs', text: 'A friend’s guide to food, drinks, music, and a good day in NYC.', url: new URL(relativeUrl, window.location.origin).href };
      if (navigator.share) {
        try { await navigator.share(shareData); return; }
        catch (error) { if (error instanceof DOMException && error.name === 'AbortError') return; }
      }
      await copy(shareData.url, 'Link to this view copied');
    }
    function showDistances() {
      if (!navigator.geolocation) { notify('Location is unavailable in this browser.'); return; }
      if (window.matchMedia('(max-width: 800px)').matches) setMobileView('list');
      const request = ++locationRequest.current;
      setLocating(true);
      navigator.geolocation.getCurrentPosition((position) => {
        if (request !== locationRequest.current) return;
        setCoords({ lat: position.coords.latitude, lon: position.coords.longitude });
        setLocating(false);
        notify('Distances added to the places in your list');
      }, () => {
        if (request !== locationRequest.current) return;
        setLocating(false);
        notify('Location wasn’t available. You can keep exploring the guide.');
      }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 });
    }

  return { activeCount, clearFilters, coords, copy, copyRec, filters, fitMap, fitRequest, focusRequest, focusSelection, isFiltered, locating, mapError, mapPanel, mobileView, reducedMotion, selectRec, selected, setFilters, setMapError, setMobileView, setSheetOpen, shareView, sheetOpen, showDistances, toast, toggleFilter, visibleRecs, zoomToSelection };
}
