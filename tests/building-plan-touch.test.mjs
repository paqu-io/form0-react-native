import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BuildingPlanCanvasController,
  createBuildingPlanSession,
  expandBuildingPlanSchema,
  writeBuildingPlanRecord,
} from 'form0-core';
import { createBuildingPlanTouchController } from '../src/building-plan/touch-controller.js';

function fixture(shared = false) {
  const { buildingPlanMeta } = expandBuildingPlanSchema({
    form: {
      elements: [
        {
          type: 'BuildingPlanSection',
          key: 'plan',
          data_name: 'plan',
          node_overrides: null,
        },
      ],
    },
  });
  const meta = buildingPlanMeta[0];
  const session = createBuildingPlanSession();
  const floorId = session.apply({ type: 'create_floor' }).created.id;
  session.apply({
    type: 'create_room',
    floorId,
    rectangle: { x: 0, y: 0, width: 5, height: 4 },
  });
  if (shared) {
    session.apply({
      type: 'create_room',
      floorId,
      rectangle: { x: 3, y: 4.2, width: 5, height: 4 },
    });
    const floor = session.getSnapshot().floors[0];
    assert.equal(
      session.apply({
        type: 'bind_faces',
        floorId,
        referenceFaceId: floor.rooms[0].faces[2].id,
        faceId: floor.rooms[1].faces[0].id,
      }).status,
      'applied'
    );
  }
  let record = writeBuildingPlanRecord({ meta, plan: session.getSnapshot() });
  let commits = 0,
    focused = 0;
  const controller = new BuildingPlanCanvasController({
    meta,
    readRecord: () => record,
    writeRecord: (next) => {
      commits++;
      record = next;
    },
    focusRow: () => {
      focused++;
    },
  });
  const touch = createBuildingPlanTouchController({ controller });
  return {
    controller,
    touch,
    record: () => structuredClone(record),
    commits: () => commits,
    focused: () => focused,
  };
}
test('touch movement previews without form writes and commits once at release', async () => {
  const f = fixture();
  const before = f.record();
  f.touch.begin([{ x: 80, y: 70 }]);
  for (let i = 1; i <= 10; i++) f.touch.move([{ x: 80 + i * 2, y: 70 }]);
  assert.deepEqual(f.record(), before);
  assert.equal(f.focused(), 0);
  await f.touch.end([{ x: 100, y: 70 }]);
  assert.equal(f.commits(), 1);
  assert.equal(f.focused(), 0);
  assert.equal(f.controller.getSnapshot().rooms[0].rect.x, 20);
});
test('touch termination discards the complete preview without committing or navigating', () => {
  const f = fixture();
  const before = f.record();
  f.touch.begin([{ x: 80, y: 70 }]);
  f.touch.move([{ x: 120, y: 70 }]);
  f.touch.cancel();
  assert.deepEqual(f.record(), before);
  assert.equal(f.commits(), 0);
  assert.equal(f.controller.getSnapshot().rooms[0].rect.x, 0);
});
test('a tap navigates to the ordinary row while two-finger pan and zoom never edit records', async () => {
  const f = fixture();
  f.touch.begin([{ x: 80, y: 70 }]);
  await f.touch.end([{ x: 80, y: 70 }]);
  assert.equal(f.focused(), 1);
  const before = f.record();
  f.touch.begin([
    { x: 80, y: 70 },
    { x: 130, y: 70 },
  ]);
  f.touch.move([
    { x: 90, y: 80 },
    { x: 190, y: 80 },
  ]);
  await f.touch.end();
  assert.equal(f.touch.getViewport().scale, 2);
  assert.deepEqual(f.record(), before);
  assert.equal(f.commits(), 0);
});
test('native drawing tools create canonical room-owned columns and beams, and one hosted opening', async () => {
  const f = fixture();
  f.touch.setMode('column');
  f.touch.begin([{ x: 70, y: 60 }]);
  await f.touch.end([{ x: 70, y: 60 }]);
  f.touch.setMode('beam');
  f.touch.begin([{ x: 40, y: 40 }]);
  f.touch.move([{ x: 90, y: 40 }]);
  await f.touch.end([{ x: 90, y: 40 }]);
  f.touch.setMode('door');
  f.touch.begin([{ x: 50, y: 20 }]);
  await f.touch.end([{ x: 50, y: 20 }]);
  const view = f.controller.getSnapshot();
  assert.equal(view.columns.length, 1);
  assert.equal(view.beams.length, 1);
  assert.equal(view.doors.length, 1);
  assert.equal(f.commits(), 3);
});

test('touch edits preview the complete partial shared layout and cancellation restores both rooms', () => {
  const f = fixture(true);
  const before = f.record();
  f.touch.begin([{ x: 100, y: 100 }]);
  f.touch.move([{ x: 100, y: 110 }]);
  assert.ok(f.controller.getSnapshot().rooms[1].vertices.length > 4);
  assert.deepEqual(f.record(), before);
  assert.equal(f.commits(), 0);
  f.touch.cancel();
  assert.equal(f.controller.getSnapshot().rooms[1].vertices.length, 4);
  assert.deepEqual(f.record(), before);
});
test('structural touch edits render their full preview before the single accepted operation', async () => {
  const f = fixture();
  f.touch.setMode('column');
  f.touch.begin([{ x: 70, y: 60 }]);
  await f.touch.end([{ x: 70, y: 60 }]);
  const before = f.record();
  f.touch.setMode('select');
  f.touch.begin([{ x: 70, y: 60 }]);
  f.touch.move([{ x: 80, y: 60 }]);
  assert.equal(f.controller.getSnapshot().columns[0].centerU, 0.6);
  assert.deepEqual(f.record(), before);
  await f.touch.end([{ x: 80, y: 60 }]);
  assert.equal(f.controller.getSnapshot().columns[0].centerU, 0.6);
  assert.equal(f.commits(), 2);
});
