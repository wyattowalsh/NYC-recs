import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isMarkerActivationKey } from './mapInteraction.ts';

test('map markers use button activation keys without treating other keys as activation', () => {
  assert.equal(isMarkerActivationKey('Enter'), true);
  assert.equal(isMarkerActivationKey(' '), true);
  assert.equal(isMarkerActivationKey('Spacebar'), true);
  assert.equal(isMarkerActivationKey('Escape'), false);
  assert.equal(isMarkerActivationKey('ArrowRight'), false);
});
