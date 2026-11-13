import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EMPTY_FILTERS } from './guide.ts';
import { buildGuidePath, createCoalescedHistoryWriter } from './urlState.ts';

test('guide paths own only guide state while preserving the path and hash', () => {
  assert.equal(buildGuidePath({ ...EMPTY_FILTERS, query: ' cafe ', areas: ['Queens'] }, '/guide', '#places'), '/guide?q=cafe&area=Queens#places');
});

test('history writes coalesce, skip identical URLs, and contain failures', () => {
  let current = '/';
  let nextHandle = 0;
  const tasks = new Map<number, () => void>();
  const writes: string[] = [];
  const errors: unknown[] = [];
  const writer = createCoalescedHistoryWriter({
    getCurrentUrl: () => current,
    replaceUrl: (url) => { writes.push(url); current = url; },
    scheduleTask: (callback) => { const handle = ++nextHandle; tasks.set(handle, callback); return handle; },
    cancelTask: (handle) => { tasks.delete(handle); },
    onError: (error) => errors.push(error),
  });

  writer.schedule('/?q=a');
  writer.schedule('/?q=ab');
  assert.equal(tasks.size, 1);
  const scheduled = [...tasks.entries()][0];
  tasks.delete(scheduled[0]);
  scheduled[1]();
  assert.deepEqual(writes, ['/?q=ab']);

  writer.schedule('/?q=ab');
  assert.equal(tasks.size, 0);

  const failure = new DOMException('blocked', 'SecurityError');
  writer.schedule('/?q=error');
  const task = [...tasks.values()][0];
  tasks.clear();
  const failingWriter = createCoalescedHistoryWriter({
    getCurrentUrl: () => current,
    replaceUrl: () => { throw failure; },
    scheduleTask: (callback) => { const handle = ++nextHandle; tasks.set(handle, callback); return handle; },
    cancelTask: (handle) => { tasks.delete(handle); },
    onError: (error) => errors.push(error),
  });
  writer.cancel();
  task();
  assert.deepEqual(writes, ['/?q=ab']);
  failingWriter.schedule('/?q=error');
  [...tasks.values()][0]();
  assert.deepEqual(errors, [failure]);
});

test('navigation cancellation prevents an older scheduled edit from winning', () => {
  let current = '/?q=restored';
  let staleTask: (() => void) | undefined;
  const writes: string[] = [];
  const writer = createCoalescedHistoryWriter({
    getCurrentUrl: () => current,
    replaceUrl: (url) => writes.push(url),
    scheduleTask: (callback) => { staleTask = callback; return 1; },
    cancelTask: () => undefined,
  });

  current = '/';
  writer.schedule('/?q=pending');
  writer.cancel();
  current = '/?q=restored';
  staleTask?.();
  assert.deepEqual(writes, []);
});
