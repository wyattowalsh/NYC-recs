import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { TYPE_META, closureNotice, mapLinkLabel, type Rec } from '@/lib/guide';
import { isMarkerActivationKey } from '@/lib/mapInteraction';
import { panPopupIntoView } from '@/lib/mapGeometry';

interface Props {
  recs: Rec[];
  selectedId: string | null;
  focusRequest: number;
  zoomToSelection: boolean;
  focusSelection: boolean;
  fitRequest: number;
  reducedMotion: boolean;
  viewMode: 'map' | 'list';
  onSelect: (id: string, source: 'map' | 'list' | 'details', keyboard?: boolean) => void;
  onError: (message: string) => void;
}

function markerIcon(rec: Rec, selected: boolean, dimmed: boolean) {
  return L.divIcon({
    className: 'rec-marker-container',
    html: `<span aria-hidden="true" class="rec-marker ${rec.type}${selected ? ' selected' : ''}${dimmed ? ' dimmed' : ''}"></span>`,
    iconSize: [44, 44],
    iconAnchor: [22, 38],
    popupAnchor: [0, -37],
  });
}

function keepPopupInView(map: L.Map, popup: L.Popup, reducedMotion: boolean) {
  const popupElement = popup.getElement();
  if (!popupElement) return;
  panPopupIntoView(map, popupElement.getBoundingClientRect(), map.getContainer().getBoundingClientRect(), reducedMotion);
}

function labelMarker(marker: L.Marker, rec: Rec) {
  const markerElement = marker.getElement();
  markerElement?.setAttribute('aria-label', `${rec.name}, show place details`);
  markerElement?.setAttribute('data-rec-id', rec.id);
}

export function GuideMap({
  recs,
  selectedId,
  focusRequest,
  zoomToSelection,
  focusSelection,
  fitRequest,
  reducedMotion,
  viewMode,
  onSelect,
  onError,
}: Props) {
  const element = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markers = useRef(new Map<string, L.Marker>());
  const onSelectRef = useRef(onSelect);
  const onErrorRef = useRef(onError);
  const reducedMotionRef = useRef(reducedMotion);
  const latestView = useRef({ recs, selectedId });
  const [failed, setFailed] = useState(false);

  onSelectRef.current = onSelect;
  onErrorRef.current = onError;
  reducedMotionRef.current = reducedMotion;
  latestView.current = { recs, selectedId };

  useEffect(() => {
    if (!element.current) return;
    const container = element.current;
    let map: L.Map | undefined;
    let observer: ResizeObserver | undefined;

    const activateMarkerFromKeyboard = (event: KeyboardEvent) => {
      if (!isMarkerActivationKey(event.key)) return;
      const target = event.target instanceof Element
        ? event.target.closest<HTMLElement>('.leaflet-marker-icon[data-rec-id]')
        : null;
      const id = target?.dataset.recId;
      if (!id) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      onSelectRef.current(id, 'map', true);
    };

    try {
      // Leaflet ignores new camera requests during animated zoom; Clear and Fit must always win.
      map = L.map(container, {
        center: [40.735, -73.972],
        zoom: 12,
        scrollWheelZoom: false,
        zoomControl: false,
        zoomAnimation: false,
        fadeAnimation: !reducedMotion,
        markerZoomAnimation: false,
      });
      mapRef.current = map;
      L.control.zoom({ position: 'bottomleft' }).addTo(map);
      map.on('popupopen', (event: L.PopupEvent) => {
        keepPopupInView(map!, event.popup, reducedMotionRef.current);
        const popupElement = event.popup.getElement();
        const content = event.popup.getContent();
        const id = content instanceof HTMLElement ? content.dataset.recId : undefined;
        const closeButton = popupElement?.querySelector<HTMLElement>('.leaflet-popup-close-button');
        if (!id || !closeButton) return;
        closeButton.addEventListener('click', () => {
          window.setTimeout(() => {
            const markerElement = markers.current.get(id)?.getElement();
            if (markerElement?.isConnected && markerElement.offsetParent !== null) {
              markerElement.focus({ preventScroll: true });
            }
          }, 0);
        }, { once: true });
      });

      let tileFailures = 0;
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
      }).on('tileerror', () => {
        tileFailures += 1;
        if (tileFailures === 3) {
          onErrorRef.current('Some map tiles could not load. Try again or use a place’s Google Maps link.');
        }
      }).addTo(map);

      observer = new ResizeObserver(() => {
        if (!container.offsetWidth || !container.offsetHeight || !map) return;
        map.invalidateSize({ pan: false });
        const view = latestView.current;
        const selected = view.recs.find((rec) => rec.id === view.selectedId);
        if (selected) {
          map.setView([selected.lat, selected.lon], map.getZoom(), { animate: false });
          const popup = markers.current.get(selected.id)?.getPopup();
          if (popup && map.hasLayer(popup)) keepPopupInView(map, popup, true);
        } else if (view.recs.length) {
          map.fitBounds(
            L.latLngBounds(view.recs.map((rec) => [rec.lat, rec.lon] as [number, number])),
            { padding: [35, 35], maxZoom: view.recs.length === 1 ? 16 : 14, animate: false },
          );
        }
      });
      observer.observe(container);
      container.addEventListener('keydown', activateMarkerFromKeyboard, true);
    } catch {
      setFailed(true);
      onErrorRef.current('The map could not load. Every place still has its original Google Maps link.');
    }

    return () => {
      container.removeEventListener('keydown', activateMarkerFromKeyboard, true);
      observer?.disconnect();
      map?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markers.current.forEach((marker) => marker.remove());
    markers.current.clear();

    for (const rec of recs) {
      const popup = document.createElement('div');
      popup.className = 'place-popup';
      popup.dataset.recId = rec.id;

      const name = document.createElement('strong');
      name.textContent = rec.name;
      const meta = document.createElement('p');
      meta.textContent = `${rec.where} · ${TYPE_META[rec.type].label}`;
      const actions = document.createElement('div');
      actions.className = 'popup-links';

      const links = [
        { label: `${mapLinkLabel(rec)} ↗`, url: rec.gmaps },
        ...rec.siteLinks.slice(0, 1),
      ];
      for (const link of links) {
        const anchor = document.createElement('a');
        anchor.href = link.url;
        anchor.textContent = link.label;
        anchor.target = '_blank';
        anchor.rel = 'noopener noreferrer';
        actions.appendChild(anchor);
      }

      const card = document.createElement('button');
      card.type = 'button';
      card.textContent = 'See details';
      card.addEventListener('click', () => onSelectRef.current(rec.id, 'details'));
      actions.appendChild(card);
      popup.append(name, meta, actions);

      const noticeText = closureNotice(rec);
      if (noticeText) {
        const notice = document.createElement('p');
        notice.className = 'closure-notice';
        notice.textContent = noticeText;
        meta.before(notice);
      }

      const marker = L.marker([rec.lat, rec.lon], {
        icon: markerIcon(rec, false, false),
        title: rec.name,
        alt: rec.name,
        keyboard: true,
        riseOnHover: true,
      }).bindPopup(popup, {
        maxWidth: 265,
        minWidth: 190,
        closeButton: true,
        autoPan: false,
        className: 'guide-popup',
      });
      marker.on('click', () => onSelectRef.current(rec.id, 'map'));
      marker.addTo(map);
      labelMarker(marker, rec);
      markers.current.set(rec.id, marker);
    }

    return () => {
      markers.current.forEach((marker) => marker.remove());
      markers.current.clear();
    };
  }, [recs]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !element.current?.offsetWidth || !element.current?.offsetHeight) return;
    map.stop();
    map.invalidateSize({ pan: false });

    for (const rec of recs) {
      const marker = markers.current.get(rec.id);
      marker?.setIcon(markerIcon(rec, selectedId === rec.id, !!selectedId && selectedId !== rec.id));
      if (marker) labelMarker(marker, rec);
      marker?.setZIndexOffset(selectedId === rec.id ? 1000 : 0);
    }

    if (selectedId) {
      const selected = recs.find((rec) => rec.id === selectedId);
      if (!selected) return;
      if (zoomToSelection) map.setView([selected.lat, selected.lon], 16, { animate: false });
      const pending = window.setTimeout(() => {
        const marker = markers.current.get(selectedId);
        marker?.openPopup();
        if (focusSelection) {
          marker?.getPopup()?.getElement()?.querySelector<HTMLElement>('a, button')?.focus({ preventScroll: true });
        }
      }, reducedMotion ? 0 : 220);
      return () => window.clearTimeout(pending);
    }

    map.closePopup();
    if (recs.length) {
      const bounds = L.latLngBounds(recs.map((rec) => [rec.lat, rec.lon] as [number, number]));
      map.fitBounds(bounds, {
        padding: [35, 35],
        maxZoom: recs.length === 1 ? 16 : 14,
        animate: false,
      });
    }
  }, [recs, selectedId, focusRequest, zoomToSelection, focusSelection, fitRequest, reducedMotion, viewMode]);

  return <div
    ref={element}
    className="map-canvas"
    id="map"
    role="region"
    aria-label="Interactive map of the visible NYC recommendations"
  >
    {failed && <div className="map-fallback">The map couldn’t load. Find every place using its Google Maps link in the list.</div>}
  </div>;
}
