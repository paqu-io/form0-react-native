import test from "node:test";
import assert from "node:assert/strict";
import {
  BuildingPlanCanvasController,
  createBuildingPlanSession,
  expandBuildingPlanSchema,
  writeBuildingPlanRecord,
  readBuildingPlanRecord,
} from "form0-core";
import { createBuildingPlanTouchController } from "../src/building-plan/touch-controller.js";
const contains = (point, polygon) => {
  const sides = polygon.map((a, i) => {
    const b = polygon[(i + 1) % polygon.length];
    return (b.x - a.x) * (point.y - a.y) - (b.y - a.y) * (point.x - a.x);
  });
  return (
    sides.every((value) => value >= -1e-6) ||
    sides.every((value) => value <= 1e-6)
  );
};

function fixture(shared = false) {
  const { buildingPlanMeta } = expandBuildingPlanSchema({
    form: {
      elements: [
        {
          type: "BuildingPlanSection",
          key: "plan",
          data_name: "plan",
          node_overrides: null,
        },
      ],
    },
  });
  const meta = buildingPlanMeta[0];
  const session = createBuildingPlanSession();
  const floorId = session.apply({ type: "create_floor" }).created.id;
  session.apply({
    type: "create_room",
    floorId,
    rectangle: { x: 0, y: 0, width: 5, height: 4 },
  });
  if (shared) {
    session.apply({
      type: "create_room",
      floorId,
      rectangle: { x: 3, y: 4.2, width: 5, height: 4 },
    });
    const floor = session.getSnapshot().floors[0];
    assert.equal(
      session.apply({
        type: "bind_faces",
        floorId,
        referenceFaceId: floor.rooms[0].faces[2].id,
        faceId: floor.rooms[1].faces[0].id,
      }).status,
      "applied",
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

for (const pin of [false, true])
  test(`a shared touch corner keeps a jog's stationary wall and snaps back (${pin})`, async () => {
    const f = fixture(true);
    f.touch.setViewport({ x: 0, y: 0, scale: 1 });
    const scene = f.controller.getSnapshot(),
      room = scene.rooms[1],
      wall = scene.walls.find((w) => w.roomId === room.id && w.index === 0);
    await f.controller.updateWall(
      wall.id,
      wall.points.map((p) => ({ ...p, y: 64 })),
    );
    const before = f.controller.getSnapshot();
    const stationary = before.walls.find(
      (w) =>
        w.roomId === before.rooms[0].id && w.points.every((p) => p.y === 80),
    );
    assert.ok(stationary);
    if (pin) f.controller.toggleWallPin(stationary.id);
    f.touch.begin([{ x: 60, y: 64 }]);
    f.touch.move([{ x: 60, y: 48 }]);
    await f.touch.end([{ x: 60, y: 48 }]);
    const after = f.controller.getSnapshot(),
      same = after.walls.find((w) => w.id === stationary.id);
    assert.deepEqual(same.points, stationary.points);
    assert.deepEqual(
      after.rooms[0].vertices.slice(1, 3).map((p) => p.x),
      [100, 100],
    );
    f.touch.begin([{ x: 60, y: 48 }]);
    await f.touch.end([{ x: 60, y: 63 }]);
    assert.deepEqual(
      f.controller.getSnapshot().rooms.map((r) => r.vertices),
      before.rooms.map((r) => r.vertices),
    );
    assert.equal(f.commits(), 3);
    f.controller.dispose();
  });

test("touch corners use axis guidance, respect optional pins, commit once and keep wall drags parallel", async () => {
  const f = fixture();
  f.touch.setViewport({ x: 0, y: 0, scale: 1 });
  const before = f.controller.getSnapshot(),
    north = before.walls[0];
  f.controller.toggleWallPin(north.id);
  assert.equal(f.commits(), 0);
  f.touch.begin([{ x: 100, y: 80 }]);
  f.touch.move([{ x: 120, y: 83 }]);
  assert.equal(f.commits(), 0);
  await f.touch.end([{ x: 120, y: 83 }]);
  assert.equal(f.commits(), 1);
  const view = f.controller.getSnapshot();
  assert.deepEqual(view.rooms[0].vertices, [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 120, y: 80 },
    { x: 0, y: 80 },
  ]);
  assert.equal(view.walls.find((w) => w.id === north.id).pinned, true);
  f.controller.toggleWallPin(north.id);
  const east = view.walls[1],
    a = east.points[0],
    b = east.points[1];
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  f.touch.begin([mid]);
  f.touch.move([{ x: mid.x + 20, y: mid.y }]);
  await f.touch.end([{ x: mid.x + 20, y: mid.y }]);
  const next = f.controller.getSnapshot().walls.find((w) => w.id === east.id);
  assert.equal(f.controller.getSnapshot().rooms[0].vertices[1].y, 0);
  assert.equal(f.controller.getSnapshot().rooms[0].vertices[2].y, 80);
  assert.equal(f.commits(), 2);
  assert.ok(
    Math.abs(
      (b.x - a.x) * (next.points[1].y - next.points[0].y) -
        (b.y - a.y) * (next.points[1].x - next.points[0].x),
    ) < 1e-6,
  );
  f.controller.dispose();
});

for (const corner of ["NE", "NW"])
  test(`touch shared junction ${corner} remains bound and aligned`, async () => {
    const f = fixture(true);
    try {
      f.touch.setViewport({ x: 0, y: 0, scale: 1 });
      f.touch.setFreeCorners(true);
      const from = corner === "NE" ? { x: 160, y: 84 } : { x: 60, y: 84 };
      const to = { ...from, y: corner === "NE" ? 72 : 100 };
      const before = f.record();
      f.touch.begin([from]);
      f.touch.move([to]);
      assert.deepEqual(f.record(), before);
      await f.touch.end([to]);
      assert.equal(f.commits(), 1);
      const plan = readBuildingPlanRecord({
        meta: f.controller.meta,
        record: f.record(),
      });
      const session = createBuildingPlanSession({ snapshot: plan });
      assert.deepEqual(session.validate(), []);
      if (corner === "NW") {
        const scene = f.controller.getSnapshot();
        const returns = scene.walls.filter(
          (w) =>
            w.roomId === scene.rooms[0].id &&
            w.points.every((p) => Math.abs(p.x - 60) < 1e-6),
        );
        assert.equal(returns.length, 1);
        assert.ok(
          returns[0].axisPoints.every((p) => Math.abs(p.x - 58) < 1e-6),
        );
      }
    } finally {
      f.controller.dispose();
    }
  });

test("touch Pin / unpin toggles an editor constraint without a form write or row navigation", async () => {
  const f = fixture();
  f.touch.setViewport({ x: 0, y: 0, scale: 1 });
  f.touch.setMode("pin");
  const point = { x: 50, y: 0 },
    id = f.controller.getSnapshot().walls[0].id;
  f.touch.begin([point]);
  await f.touch.end([point]);
  assert.equal(
    f.controller.getSnapshot().walls.find((w) => w.id === id).pinned,
    true,
  );
  f.touch.begin([point]);
  await f.touch.end([point]);
  assert.equal(
    f.controller.getSnapshot().walls.find((w) => w.id === id).pinned,
    false,
  );
  assert.equal(f.commits(), 0);
  assert.equal(f.focused(), 0);
  f.controller.dispose();
});

test("free corner movement uses both axes and cancellation discards its complete preview", async () => {
  const f = fixture();
  f.touch.setViewport({ x: 0, y: 0, scale: 1 });
  f.touch.setFreeCorners(true);
  const before = f.record();
  f.touch.begin([{ x: 100, y: 80 }]);
  f.touch.move([{ x: 120, y: 90 }]);
  f.touch.cancel();
  assert.deepEqual(f.record(), before);
  assert.equal(f.commits(), 0);
  f.touch.begin([{ x: 100, y: 80 }]);
  await f.touch.end([{ x: 120, y: 90 }]);
  assert.deepEqual(f.controller.getSnapshot().rooms[0].vertices[2], {
    x: 120,
    y: 90,
  });
  f.controller.dispose();
});
for (const axis of ["x", "y"])
  test(`touch realigns a split boundary with its stationary extension before Rejoin (${axis})`, async () => {
    const f = fixture();
    const initial = f.controller.getSnapshot();
    const wall = initial.walls.find(
      (wall) => wall.index === (axis === "x" ? 3 : 0),
    );
    await f.controller.splitWall(wall.id, { offset: axis === "x" ? 2 : 2.5 });
    const split = f.controller.getSnapshot();
    const touch = createBuildingPlanTouchController({
      controller: f.controller,
      scopeRoomId: () => initial.rooms[0].id,
    });
    touch.setViewport({ x: 0, y: 0, scale: 1 });
    f.controller.setEditingPolicy({ snapping: false, edgeAutoPan: false });
    const start = axis === "x" ? { x: 0, y: 60 } : { x: 25, y: 0 };
    const moved = axis === "x" ? { x: 12, y: 60 } : { x: 25, y: 12 };
    const near = axis === "x" ? { x: 2, y: 60 } : { x: 25, y: 2 };
    touch.begin([start]);
    touch.move([moved]);
    await touch.end([moved]);
    f.controller.setEditingPolicy({ snapping: true, edgeAutoPan: false });
    touch.begin([moved]);
    touch.move([near]);
    await touch.end([near]);
    assert.deepEqual(
      f.controller.getSnapshot().rooms[0].vertices,
      split.rooms[0].vertices,
    );
    touch.setMode("rejoin");
    const node = axis === "x" ? { x: 0, y: 40 } : { x: 50, y: 0 };
    touch.begin([node]);
    await touch.end([node]);
    assert.equal(f.controller.getSnapshot().rooms[0].vertices.length, 4);
    assert.equal(f.commits(), 4);
    assert.equal(f.focused(), 0);
    f.controller.dispose();
  });
test("touch movement previews without form writes and commits once at release", async () => {
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

test("touch jog creation shares the existing adjacent physical wall with one thickness", async () => {
  const f = fixture(true),
    initial = f.controller.getSnapshot();
  f.controller.setEditingPolicy({ snapping: false, edgeAutoPan: false });
  const touch = createBuildingPlanTouchController({
    controller: f.controller,
    scopeRoomId: () => initial.rooms[0].id,
  });
  touch.setViewport({ x: 0, y: 0, scale: 1 });
  const right = initial.walls.find(
    (w) => w.roomId === initial.rooms[0].id && w.index === 1,
  ).physicalWallId;
  touch.begin([{ x: 40, y: 80 }]);
  touch.move([{ x: 40, y: 92 }]);
  await touch.end([{ x: 40, y: 92 }]);
  const scene = f.controller.getSnapshot(),
    footprint = scene.wallFootprints.find((w) => w.id === right);
  assert.ok(
    scene.walls.some(
      (w) => w.roomId === initial.rooms[1].id && w.physicalWallId === right,
    ),
  );
  assert.ok(footprint.polygons.some((p) => contains({ x: 102, y: 88 }, p)));
  assert.ok(
    !scene.wallFootprints.some((w) =>
      w.polygons.some((p) => contains({ x: 98, y: 88 }, p)),
    ),
  );
  assert.equal(f.commits(), 1);
});

test("touch room detachment trims the unbound stationary wall extent", async () => {
  const f = fixture(true),
    initial = f.controller.getSnapshot();
  f.controller.setEditingPolicy({ snapping: false, edgeAutoPan: false });
  const wallId = initial.walls.find(
    (w) => w.roomId === initial.rooms[0].id && w.index === 2,
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

test("touch Split previews a node, commits on release, cancels cleanly and Rejoins without row navigation", async () => {
  const f = fixture(true);
  f.controller.setEditingPolicy({ snapping: false });
  f.touch.setViewport({ x: 0, y: 0, scale: 1 });
  f.touch.setMode("split");
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
  f.touch.setMode("rejoin");
  f.touch.begin([{ x: 70, y: 80 }]);
  await f.touch.end([{ x: 70, y: 80 }]);
  assert.equal(f.commits(), 2);
  assert.equal(f.controller.getSnapshot().editingCuts.length, 0);
});

test("touch moves only a cut partition portion and magnetically straightens it before Rejoin", async () => {
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
  assert.equal(
    f.controller.getSnapshot().walls.filter((wall) => !wall.isBoundary).length,
    3,
  );
  f.touch.begin([{ x: 60, y: 32 }]);
  f.touch.move([{ x: 60, y: 21 }]);
  await f.touch.end([{ x: 60, y: 21 }]);
  assert.equal(f.commits(), 4);
  const straight = f.controller
    .getSnapshot()
    .walls.filter((wall) => !wall.isBoundary);
  assert.equal(straight.length, 2);
  assert.ok(
    straight.every((wall) => wall.points.every((point) => point.y === 20)),
  );
  f.touch.setMode("rejoin");
  f.touch.begin([{ x: 40, y: 20 }]);
  await f.touch.end([{ x: 40, y: 20 }]);
  assert.equal(f.commits(), 5);
  assert.equal(
    f.controller.getSnapshot().walls.filter((wall) => !wall.isBoundary).length,
    1,
  );
});

test("touch selects the active room projection at the centre of a thick shared opening", async () => {
  const f = fixture(true);
  const initial = f.controller.getSnapshot();
  const face = initial.walls.find(
    (wall) => wall.roomId === initial.rooms[0].id && wall.index === 2,
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
  assert.equal(hit.collection, "doors");
  assert.equal(hit.item.id, projected.id);
  assert.equal(hit.item.roomId, roomId);
});
test("touch termination discards the complete preview without committing or navigating", () => {
  const f = fixture();
  const before = f.record();
  f.touch.begin([{ x: 80, y: 70 }]);
  f.touch.move([{ x: 120, y: 70 }]);
  f.touch.cancel();
  assert.deepEqual(f.record(), before);
  assert.equal(f.commits(), 0);
  assert.equal(f.controller.getSnapshot().rooms[0].rect.x, 0);
});
test("a tap navigates to the ordinary row while two-finger pan and zoom never edit records", async () => {
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
test("native drawing tools create canonical room-owned columns and beams, and one hosted opening", async () => {
  const f = fixture();
  f.touch.setMode("column");
  f.touch.begin([{ x: 70, y: 60 }]);
  await f.touch.end([{ x: 70, y: 60 }]);
  f.touch.setMode("beam");
  f.touch.begin([{ x: 40, y: 40 }]);
  f.touch.move([{ x: 90, y: 40 }]);
  await f.touch.end([{ x: 90, y: 40 }]);
  f.touch.setMode("door");
  f.touch.begin([{ x: 50, y: 20 }]);
  await f.touch.end([{ x: 50, y: 20 }]);
  const view = f.controller.getSnapshot();
  assert.equal(view.columns.length, 1);
  assert.equal(view.beams.length, 1);
  assert.equal(view.doors.length, 1);
  assert.equal(f.commits(), 3);
});

test("touch edits preview the complete partial shared layout and cancellation restores both rooms", () => {
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
test("structural touch edits render their full preview before the single accepted operation", async () => {
  const f = fixture();
  f.touch.setMode("column");
  f.touch.begin([{ x: 70, y: 60 }]);
  await f.touch.end([{ x: 70, y: 60 }]);
  const before = f.record();
  f.touch.setMode("select");
  f.touch.begin([{ x: 70, y: 60 }]);
  f.touch.move([{ x: 80, y: 60 }]);
  assert.equal(f.controller.getSnapshot().columns[0].centerU, 0.6);
  assert.deepEqual(f.record(), before);
  await f.touch.end([{ x: 80, y: 60 }]);
  assert.equal(f.controller.getSnapshot().columns[0].centerU, 0.6);
  assert.equal(f.commits(), 2);
});

test("touch edge pan keeps the pointer location live and commits the entire drag once", async () => {
  const f = fixture();
  f.controller.setEditingPolicy({ snapping: false });
  const before = f.record();
  f.touch.begin([{ x: 80, y: 70 }]);
  f.touch.move([{ x: 118, y: 70 }]);
  for (let now = 0; now <= 320; now += 16)
    f.touch.tick({ width: 120, height: 160 }, now);
  assert.ok(f.touch.getViewport().x < 20);
  assert.deepEqual(f.record(), before);
  assert.equal(f.commits(), 0);
  const viewport = f.touch.getViewport();
  await f.touch.end();
  assert.equal(f.commits(), 1);
  assert.deepEqual(
    f.touch.getViewport(),
    viewport,
    "Release must not recenter the viewport",
  );
  f.touch.tick({ width: 120, height: 160 }, 500);
  assert.deepEqual(f.touch.getViewport(), viewport);
});

test("touch snapping and edge pan can be disabled independently", async () => {
  const f = fixture();
  f.controller.setEditingPolicy({ snapping: false, edgeAutoPan: false });
  f.touch.begin([{ x: 80, y: 70 }]);
  f.touch.move([{ x: 85, y: 70 }]);
  for (let now = 0; now <= 320; now += 16)
    f.touch.tick({ width: 90, height: 160 }, now);
  assert.equal(f.touch.getViewport().x, 20);
  await f.touch.end();
  assert.equal(f.controller.getSnapshot().rooms[0].rect.x, 5);
});

for (const remove of [false, true])
  test(`touch opening cut confirms only on release and ${remove ? "removes" : "preserves"} the opening`, async () => {
    const f = fixture(true);
    const first = f.controller.getSnapshot().rooms[0];
    const face = f.controller
      .getSnapshot()
      .walls.find(
        (w) =>
          w.roomId === first.id && w.points[0].y === 80 && w.points[1].y === 80,
      );
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
    assert.equal(
      plan.floors[0].walls.flatMap((w) => w.doors).length,
      remove ? 0 : 1,
    );
  });

for (const preserveWallGrouping of [false, true])
  test(`touch axis edits carry a return across separate physical subjects (${preserveWallGrouping})`, async () => {
    const f = fixture(true);
    f.controller.setEditingPolicy({ preserveWallGrouping });
    f.touch.setViewport({ x: 0, y: 0, scale: 1 });
    f.touch.setFreeCorners(true);
    for (const [from, to] of [
      [
        { x: 120, y: 84 },
        { x: 120, y: 80 },
      ],
      [
        { x: 60, y: 120 },
        { x: 48, y: 120 },
      ],
    ]) {
      const record = f.record(),
        commits = f.commits();
      f.touch.begin([from]);
      f.touch.move([{ x: to.x + (to.x - from.x), y: to.y + (to.y - from.y) }]);
      f.touch.move([to]);
      assert.deepEqual(f.record(), record);
      assert.equal(f.commits(), commits);
      await f.touch.end([to]);
      assert.equal(f.commits(), commits + 1);
    }
    const view = f.controller.getSnapshot();
    assert.ok(
      view.rooms[0].vertices.some(
        (v) => Math.abs(v.x - 44) < 1e-6 && Math.abs(v.y - 76) < 1e-6,
      ),
    );
    for (const point of [
      { x: 42, y: 78 },
      { x: 56, y: 82 },
    ])
      assert.ok(
        !view.wallFootprints.some((w) =>
          w.polygons.some((p) => contains(point, p)),
        ),
      );
    f.controller.dispose();
  });
