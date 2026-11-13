import { test } from 'node:test';
import assert from 'node:assert/strict';
import { panPopupIntoView } from './mapGeometry.ts';

test('clipped popups move fully inside the map without animation under reduced motion', () => {
  const calls: unknown[] = [];
  const map = { panBy: (...args: unknown[]) => { calls.push(args); } };
  panPopupIntoView(map, { left: 30, right: 290, top: -50, bottom: 120 }, { left: 0, right: 300, top: 0, bottom: 340 }, true);
  assert.deepEqual(calls, [[[6, -66], { animate: false, duration: .2 }]]);
});
test('normal motion can pan and an already visible popup leaves the map alone', () => {
  const calls: unknown[] = [];
  const map = { panBy: (...args: unknown[]) => { calls.push(args); } };
  const viewport = { left: 0, right: 400, top: 0, bottom: 400 };
  panPopupIntoView(map, { left: 50, right: 350, top: 30, bottom: 200 }, viewport, false);
  assert.equal(calls.length, 0);
  panPopupIntoView(map, { left: -10, right: 290, top: 30, bottom: 200 }, viewport, false);
  assert.deepEqual(calls, [[[-26, 0], { animate: true, duration: .2 }]]);
});
