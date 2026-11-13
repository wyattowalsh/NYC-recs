import { Check } from 'lucide-react';
import { Toggle } from '@/components/ui/toggle';

export function FilterGroup({ title, subtitle, values, selected, onToggle }: { title: string; subtitle: string; values: { value: string; label: string; count: number }[]; selected: string[]; onToggle: (value: string) => void }) {
  return <fieldset className="filter-group"><legend>{title}</legend><p>{subtitle}</p><div>{values.map((item) => <Toggle key={item.value} variant="outline" pressed={selected.includes(item.value)} onPressedChange={() => onToggle(item.value)} aria-label={`${item.label}, ${item.count} places`}><span>{item.label}</span><span className="filter-option-count">{item.count}</span>{selected.includes(item.value) && <Check size={12} aria-hidden="true" />}</Toggle>)}</div></fieldset>;
}
