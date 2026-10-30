import assert from 'node:assert/strict';
import { test } from 'node:test';
import { defaultDockState, movePanel, readDockState, PANEL_IDS } from '../src/ui/dock-state.ts';

test('participantes e campanha movem separadamente; reordenação não duplica painéis', () => {
  const initial = defaultDockState();
  const moved = movePanel(initial, 'participants', 'right', 'properties');
  assert.deepEqual(moved.left, ['campaign']);
  assert.deepEqual(moved.right, ['participants', 'properties']);
  assert.deepEqual(initial.left, ['campaign', 'participants']);
  const bottom = movePanel(moved, 'campaign', 'bottom');
  assert.deepEqual(bottom.bottom, ['history', 'campaign']);
  assert.equal(new Set([...bottom.left, ...bottom.right, ...bottom.bottom, ...bottom.hidden]).size, PANEL_IDS.length);
});
test('painéis ocultos podem ser restaurados e layout salvo é validado', () => {
  let state = defaultDockState();
  for (const id of PANEL_IDS) state = movePanel(state, id, 'hidden');
  assert.equal(state.hidden.length, 4);
  state = movePanel(state, 'participants', 'left');
  assert.deepEqual(readDockState(JSON.parse(JSON.stringify(state))), state);
  assert.deepEqual(readDockState({ ...state, right: ['participants'] }), defaultDockState());
  assert.deepEqual(readDockState({ ...state, hidden: ['unknown'] }), defaultDockState());
  assert.equal(readDockState({ ...state, leftWidth: 900 }).leftWidth, 400);
});
