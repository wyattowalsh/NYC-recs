import { ArrowUpRight, Copy, MapPin, Navigation, TriangleAlert, Utensils, Wine, Music2, Ticket, Trees } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TYPE_META, closureNotice, distanceLabel, mapLinkLabel, type Rec } from '@/lib/guide';

export const placeIcons = { food: Utensils, drinks: Wine, music: Music2, activity: Ticket, outdoors: Trees };

export function ExternalLinks({ rec, compact = false }: { rec: Rec; compact?: boolean }) {
  return <>
    {rec.gmaps && <a className="external-link" href={rec.gmaps} target="_blank" rel="noopener noreferrer">{mapLinkLabel(rec, compact)}<ArrowUpRight aria-hidden="true" size={14} /></a>}
    {rec.siteLinks.map((link) => <a className="external-link" key={`${link.label}-${link.url}`} href={link.url} target="_blank" rel="noopener noreferrer">{link.label || 'Site'}<ArrowUpRight aria-hidden="true" size={14} /></a>)}
  </>;
}

export function ClosureNotice({ rec }: { rec: Rec }) {
  const notice = closureNotice(rec);
  return notice ? <p className="closure-notice"><TriangleAlert size={14} aria-hidden="true" /><span>{notice}</span></p> : null;
}

export function PlaceCard({ rec, selected, distance, onSelect, onCopy }: { rec: Rec; selected: boolean; distance?: number; onSelect: (id: string, source: 'map' | 'list' | 'details', keyboard?: boolean) => void; onCopy: (rec: Rec) => void }) {
  const Icon = placeIcons[rec.type];
  return <article className={`place-card ${selected ? 'is-selected' : ''}`} id={`pick-${rec.id}`} data-id={rec.id} data-type={rec.type} aria-labelledby={`title-${rec.id}`}>
    <div className="card-eyebrow"><span className={`place-category ${rec.type}`}><Icon size={13} aria-hidden="true" />{TYPE_META[rec.type].label}</span>{distance !== undefined && <span className="distance"><Navigation size={11} aria-hidden="true" />{distanceLabel(rec, distance)}</span>}</div>
    <h3 id={`title-${rec.id}`}><button className="place-title" type="button" onClick={(event) => onSelect(rec.id, 'list', event.detail === 0)} aria-label={`Show ${rec.name} on the map`}>{rec.name}<ArrowUpRight size={20} aria-hidden="true" /></button></h3>
    <ClosureNotice rec={rec} />
    <p className="place-meta">{rec.where}<span aria-hidden="true"> / </span>{rec.vibe}</p>
    <p className="place-blurb">{rec.blurb}</p>
    <p className="good-for"><span>GOOD FOR</span>{rec.fit}</p>
    <div className="place-tags">{rec.tags.slice(0, 5).map((tag) => <Badge key={tag} variant="outline" className="place-tag">{tag.replaceAll('-', ' ')}</Badge>)}</div>
    <div className="card-actions">
      <Button variant={selected ? 'default' : 'outline'} className="locate-button" onClick={(event) => onSelect(rec.id, 'list', event.detail === 0)}><MapPin size={14} aria-hidden="true" />{selected ? 'On the map' : 'Show on map'}</Button>
      <div className="card-links"><ExternalLinks rec={rec} compact /><Button variant="ghost" size="icon" className="copy-button" onClick={() => onCopy(rec)} aria-label={`Copy ${rec.name}`} title={`Copy ${rec.name}`}><Copy size={15} /></Button></div>
    </div>
  </article>;
}
