import { filtersToSearch, type Filters } from './guide.ts';

export function buildGuidePath(filters: Filters, pathname: string, hash: string) {
  const query = filtersToSearch(filters);
  return `${pathname}${query ? `?${query}` : ''}${hash}`;
}

interface HistoryWriterOptions<Handle> {
  getCurrentUrl: () => string;
  replaceUrl: (url: string) => void;
  scheduleTask: (callback: () => void, delayMs: number) => Handle;
  cancelTask: (handle: Handle) => void;
  delayMs?: number;
  onError?: (error: unknown) => void;
}

export interface CoalescedHistoryWriter {
  schedule: (url: string) => void;
  cancel: () => void;
}

export function createCoalescedHistoryWriter<Handle>({
  getCurrentUrl,
  replaceUrl,
  scheduleTask,
  cancelTask,
  delayMs = 120,
  onError,
}: HistoryWriterOptions<Handle>): CoalescedHistoryWriter {
  let handle: Handle | null = null;
  let generation = 0;

  const cancel = () => {
    generation += 1;
    if (handle !== null) cancelTask(handle);
    handle = null;
  };

  const schedule = (url: string) => {
    cancel();
    if (url === getCurrentUrl()) return;
    const scheduledGeneration = generation;
    handle = scheduleTask(() => {
      handle = null;
      if (scheduledGeneration !== generation || url === getCurrentUrl()) return;
      try {
        replaceUrl(url);
      } catch (error) {
        onError?.(error);
      }
    }, delayMs);
  };

  return { schedule, cancel };
}
