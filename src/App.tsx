import { MapPin } from 'lucide-react';
import rawRecs from '@/data/recs';
import { Button } from '@/components/ui/button';
import { GuideView } from '@/components/GuideView';
import { useGuideController } from '@/hooks/useGuideController';
import { prepareRecs, type Rec } from '@/lib/guide';

let loadError = false;
let allRecs: Rec[] = [];
try { allRecs = prepareRecs(rawRecs); } catch { loadError = true; }

export default function App() {
  const controller = useGuideController(allRecs);
  if (loadError) return <main className="fatal-state"><MapPin size={32} /><h1>The guide couldn’t load.</h1><p>Please refresh to try again.</p><Button onClick={() => window.location.reload()}>Refresh guide</Button></main>;
  return <GuideView allRecs={allRecs} {...controller} />;
}
