import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BuildingPlanCanvasController,
  createBuildingPlanSession,
  expandBuildingPlanSchema,
  writeBuildingPlanRecord,
  readBuildingPlanRecord,
} from 'form0-core';
import { createBuildingPlanTouchController } from '../src/building-plan/touch-controller.js';
const contains = (point, polygon) => {
  const sides = polygon.map((a, i) => {
    const b = polygon[(i + 1) % polygon.length];
    return (b.x - a.x) * (point.y - a.y) - (b.y - a.y) * (point.x - a.x);
  });
  return sides.every((value) => value >= -1e-6) || sides.every((value) => value <= 1e-6);
};

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

test('touch jog creation shares the existing adjacent physical wall with one thickness', async () => {
  const f = fixture(true),
    initial = f.controller.getSnapshot();
  f.controller.setEditingPolicy({ snapping: false, edgeAutoPan: false });
  const touch = createBuildingPlanTouchController({
    controller: f.controller,
    scopeRoomId: () => initial.rooms[0].id,
  });
  touch.setViewport({ x: 0, y: 0, scale: 1 });
  const right = initial.walls.find(
    (w) => w.roomId === initial.rooms[0].id && w.index === 1
  ).physicalWallId;
  touch.begin([{ x: 40, y: 80 }]);
  touch.move([{ x: 40, y: 92 }]);
  await touch.end([{ x: 40, y: 92 }]);
  const scene = f.controller.getSnapshot(),
    footprint = scene.wallFootprints.find((w) => w.id === right);
  assert.ok(
    scene.walls.some((w) => w.roomId === initial.rooms[1].id && w.physicalWallId === right)
  );
  assert.ok(footprint.polygons.some((p) => contains({ x: 102, y: 88 }, p)));
  assert.ok(
    !scene.wallFootprints.some((w) => w.polygons.some((p) => contains({ x: 98, y: 88 }, p)))
  );
  assert.equal(f.commits(), 1);
});

test('touch room detachment trims the unbound stationary wall extent', async () => {
  const f = fixture(true),
    initial = f.controller.getSnapshot();
  f.controller.setEditingPolicy({ snapping: false, edgeAutoPan: false });
  const wallId = initial.walls.find(
    (w) => w.roomId === initial.rooms[0].id && w.index === 2
  ).physicalWallId;
  f.touch.setViewport({ x: 0, y: 0, scale: 1 });
  f.touch.begin([{ x: 40, y: 40 }]);
  f.touch.move([{ x: -160, y: 40 }]);
  await f.touch.end([{ x: -160, y: 40 }]);
  const plan = readBuildingPlanRecord({
    meta: f.controller.meta,
    record: f.record(),
  });
  const wall = plan.floors[0].walls.find((w) => w.id === wallId);
  assert.deepEqual([wall.segments[0].start.x, wall.segments[0].end.x], [8, 3]);
  assert.equal(f.commits(), 1);
});

test('touch Split previews a node, commits on release, cancels cleanly and Rejoins without row navigation', async () => {
  const f = fixture(true);
  f.controller.setEditingPolicy({ snapping: false });
  f.touch.setViewport({ x: 0, y: 0, scale: 1 });
  f.touch.setMode('split');
  f.touch.begin([{ x: 80, y: 80 }]);
  f.touch.move([{ x: 70, y: 80 }]);
  assert.equal(f.commits(), 0);
  f.touch.cancel();
  assert.equal(f.commits(), 0);
  f.touch.begin([{ x: 70, y: 80 }]);
  await f.touch.end([{ x: 70, y: 80 }]);
  assert.equal(f.commits(), 1);
  assert.ok(f.controller.getSnapshot().editingCuts.length >= 2);
  assert.equal(f.focused(), 0);
  f.touch.setMode('rejoin');
  f.touch.begin([{ x: 70, y: 80 }]);
  await f.touch.end([{ x: 70, y: 80 }]);
  assert.equal(f.commits(), 2);
  assert.equal(f.controller.getSnapshot().editingCuts.length, 0);
});

test('touch moves only a cut partition portion and magnetically straightens it before Rejoin', async () => {
  const f = fixture(true);
  f.touch.setViewport({ x: 0, y: 0, scale: 1 });
  const roomId = f.controller.getSnapshot().rooms[0].id;
  const partition = await f.controller.createWall(roomId, [
    { x: 20, y: 20 },
    { x: 80, y: 20 },
  ]);
  await f.controller.splitWall(partition.id, { offset: 1 });
  f.touch.begin([{ x: 60, y: 20 }]);
  f.touch.move([{ x: 66, y: 32 }]);
  await f.touch.end([{ x: 66, y: 32 }]);
  assert.equal(f.commits(), 3);
  assert.equal(f.controller.getSnapshot().walls.filter((wall) => !wall.isBoundary).length, 3);
  f.touch.begin([{ x: 60, y: 32 }]);
  f.touch.move([{ x: 60, y: 21 }]);
  await f.touch.end([{ x: 60, y: 21 }]);
  assert.equal(f.commits(), 4);
  const straight = f.controller.getSnapshot().walls.filter((wall) => !wall.isBoundary);
  assert.equal(straight.length, 2);
  assert.ok(straight.every((wall) => wall.points.every((point) => point.y === 20)));
  f.touch.setMode('rejoin');
  f.touch.begin([{ x: 40, y: 20 }]);
  await f.touch.end([{ x: 40, y: 20 }]);
  assert.equal(f.commits(), 5);
  assert.equal(f.controller.getSnapshot().walls.filter((wall) => !wall.isBoundary).length, 1);
});

test('touch selects the active room projection at the centre of a thick shared opening', async () => {
  const f = fixture(true);
  const initial = f.controller.getSnapshot();
  const face = initial.walls.find(
    (wall) => wall.roomId === initial.rooms[0].id && wall.index === 2
  );
  await f.controller.createDoor(face.id, { startRatio: 0.2, width: 0.9 });
  const scene = f.controller.getSnapshot();
  assert.equal(scene.physicalOpenings.length, 1);
  const roomId = scene.rooms[1].id;
  const projected = scene.doors.find((door) => door.roomId === roomId);
  const physical = scene.physicalOpenings[0];
  const center = {
    x: (physical.points[0].x + physical.points[1].x) / 2,
    y: (physical.points[0].y + physical.points[1].y) / 2,
  };
  const touch = createBuildingPlanTouchController({
    controller: f.controller,
    scopeRoomId: () => roomId,
  });
  touch.setViewport({ x: 0, y: 0, scale: 4 });
  const hit = touch.hitTest({ x: center.x * 4, y: center.y * 4 });
  assert.equal(hit.collection, 'doors');
  assert.equal(hit.item.id, projected.id);
  assert.equal(hit.item.roomId, roomId);
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

test('touch edge pan keeps the pointer location live and commits the entire drag once', async () => {
  const f = fixture();
  f.controller.setEditingPolicy({ snapping: false });
  const before = f.record();
  f.touch.begin([{ x: 80, y: 70 }]);
  f.touch.move([{ x: 118, y: 70 }]);
  for (let now = 0; now <= 320; now += 16) f.touch.tick({ width: 120, height: 160 }, now);
  assert.ok(f.touch.getViewport().x < 20);
  assert.deepEqual(f.record(), before);
  assert.equal(f.commits(), 0);
  const viewport = f.touch.getViewport();
  await f.touch.end();
  assert.equal(f.commits(), 1);
  assert.deepEqual(f.touch.getViewport(), viewport, 'Release must not recenter the viewport');
  f.touch.tick({ width: 120, height: 160 }, 500);
  assert.deepEqual(f.touch.getViewport(), viewport);
});

test('touch snapping and edge pan can be disabled independently', async () => {
  const f = fixture();
  f.controller.setEditingPolicy({ snapping: false, edgeAutoPan: false });
  f.touch.begin([{ x: 80, y: 70 }]);
  f.touch.move([{ x: 85, y: 70 }]);
  for (let now = 0; now <= 320; now += 16) f.touch.tick({ width: 90, height: 160 }, now);
  assert.equal(f.touch.getViewport().x, 20);
  await f.touch.end();
  assert.equal(f.controller.getSnapshot().rooms[0].rect.x, 5);
});

for (const remove of [false, true])
  test(`touch opening cut confirms only on release and ${remove ? 'removes' : 'preserves'} the opening`, async () => {
    const f = fixture(true);
    const first = f.controller.getSnapshot().rooms[0];
    const face = f.controller
      .getSnapshot()
      .walls.find((w) => w.roomId === first.id && w.points[0].y === 80 && w.points[1].y === 80);
    await f.controller.createDoor(face.id, { startRatio: 0.1, width: 0.9 });
    let prompts = 0;
    f.controller.confirmOpeningRemoval = () => {
      prompts++;
      return remove;
    };
    const before = f.record();
    f.touch.begin([{ x: 80, y: 150 }]);
    f.touch.move([{ x: 100, y: 150 }]);
    assert.equal(prompts, 0);
    assert.deepEqual(f.record(), before);
    await f.touch.end([{ x: 100, y: 150 }]);
    assert.equal(prompts, 1);
    assert.equal(f.commits(), remove ? 2 : 1);
    const plan = readBuildingPlanRecord({
      meta: f.controller.meta,
      record: f.record(),
    });
    assert.equal(plan.floors[0].walls.flatMap((w) => w.doors).length, remove ? 0 : 1);
  });
