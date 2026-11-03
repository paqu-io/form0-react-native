import { buildingPlanPointFromViewport } from 'form0-core';

const length = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const segmentPoint = (a, b, ratio) => ({
  x: a.x + (b.x - a.x) * ratio,
  y: a.y + (b.y - a.y) * ratio,
});
const projection = (point, a, b) => {
  const size = length(a, b);
  const ratio = size
    ? Math.max(
        0,
        Math.min(1, ((point.x - a.x) * (b.x - a.x) + (point.y - a.y) * (b.y - a.y)) / (size * size))
      )
    : 0;
  return {
    ratio,
    point: segmentPoint(a, b, ratio),
    distance: length(point, segmentPoint(a, b, ratio)),
  };
};
const inside = (point, vertices) => {
  let result = false;
  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
    const a = vertices[j],
      b = vertices[i];
    if (
      a.y > point.y !== b.y > point.y &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x
    )
      result = !result;
  }
  return result;
};

/** Platform-independent touch interpretation; all accepted geometry goes through core. */
export function createBuildingPlanTouchController({
  controller,
  onChange = () => {},
  onViewport = () => {},
  canEdit = () => true,
  scopeRoomId = () => null,
}) {
  let viewport = { x: 20, y: 20, scale: 1 };
  let mode = 'select';
  let gesture = null;
  let selection = null;
  let draft = null;
  const snapshot = () => controller.getSnapshot();
  const world = (point) => buildingPlanPointFromViewport(point, viewport);
  const notify = () => onChange({ selection, draft });
  const roomAt = (point) =>
    [...snapshot().rooms]
      .reverse()
      .find(
        (room) =>
          (scopeRoomId() == null || room.id === scopeRoomId()) && inside(point, room.vertices)
      );
  const roomOf = (id) => snapshot().rooms.find((room) => room.id === id);
  function wallAt(point) {
    const hits = [];
    for (const wall of snapshot().walls.filter(
      (wall) => scopeRoomId() == null || wall.roomId === scopeRoomId()
    ))
      for (let i = 0; i < wall.points.length - 1; i++) {
        const hit = projection(point, wall.points[i], wall.points[i + 1]);
        if (hit.distance <= 14 / viewport.scale)
          hits.push({
            collection: 'walls',
            item: wall,
            segmentIndex: i,
            ...hit,
          });
      }
    return hits.sort((a, b) => a.distance - b.distance)[0];
  }
  function hitTest(point) {
    const view = snapshot();
    for (const collection of ['doors', 'windows'])
      for (const item of view[collection].filter(
        (item) => scopeRoomId() == null || item.roomId === scopeRoomId()
      )) {
        const wall = view.walls.find((wall) => wall.id === item.wallId);
        const start = wall?.points[item.segmentIndex],
          end = wall?.points[item.segmentIndex + 1];
        if (
          start &&
          end &&
          projection(
            point,
            segmentPoint(start, end, item.startRatio),
            segmentPoint(start, end, item.endRatio)
          ).distance <
            14 / viewport.scale
        )
          return { collection, item };
      }
    for (const collection of ['columns', 'beams'])
      for (const item of view[collection].filter(
        (item) => scopeRoomId() == null || item.roomId === scopeRoomId()
      )) {
        const room = roomOf(item.roomId);
        const convert = (u, v) => ({
          x: room.rect.x + u * room.rect.width,
          y: room.rect.y + v * room.rect.height,
        });
        const hit =
          collection === 'columns'
            ? length(point, convert(item.centerU, item.centerV)) <
              Math.max(14 / viewport.scale, (item.width * controller.gridSize) / 2)
            : projection(point, convert(item.startU, item.startV), convert(item.endU, item.endV))
                .distance <
              14 / viewport.scale;
        if (hit) return { collection, item };
      }
    const wall = wallAt(point);
    if (wall) return wall;
    const room = roomAt(point);
    return room && { collection: 'rooms', item: room };
  }
  function elementEdit(current, end) {
    const { item, collection } = current.hit;
    const room = roomOf(item.roomId);
    const delta = { x: end.x - current.start.x, y: end.y - current.start.y };
    if (collection === 'columns')
      return {
        collection,
        id: item.id,
        values:
          mode === 'resize'
            ? {
                width: Math.abs(delta.x) / controller.gridSize,
                height: Math.abs(delta.y) / controller.gridSize,
              }
            : {
                centerU: item.centerU + delta.x / room.rect.width,
                centerV: item.centerV + delta.y / room.rect.height,
              },
      };
    if (collection === 'beams')
      return {
        collection,
        id: item.id,
        values:
          mode === 'resize'
            ? {
                endU: (end.x - room.rect.x) / room.rect.width,
                endV: (end.y - room.rect.y) / room.rect.height,
              }
            : {
                startU: item.startU + delta.x / room.rect.width,
                startV: item.startV + delta.y / room.rect.height,
                endU: item.endU + delta.x / room.rect.width,
                endV: item.endV + delta.y / room.rect.height,
              },
      };
    if (collection === 'walls')
      return {
        collection,
        id: item.id,
        points: item.points.map((point, index) =>
          mode === 'resize' && !item.isBoundary && index !== item.points.length - 1
            ? point
            : { x: point.x + delta.x, y: point.y + delta.y }
        ),
      };
    const wall = controller.walls.get(item.wallId);
    const segment = [wall.points[item.segmentIndex], wall.points[item.segmentIndex + 1]];
    const ratio = projection(end, ...segment).ratio;
    return {
      collection,
      id: item.id,
      values:
        mode === 'resize'
          ? {
              width: Math.max(
                0.1,
                ((ratio - item.startRatio) * length(...segment)) / controller.gridSize
              ),
            }
          : { startRatio: Math.max(0, Math.min(1 - (item.endRatio - item.startRatio), ratio)) },
    };
  }
  function applyElementEdit(edit, preview) {
    if (edit.collection === 'walls')
      return controller[preview ? 'previewWall' : 'updateWall'](edit.id, edit.points);
    if (['columns', 'beams'].includes(edit.collection))
      return preview
        ? controller.previewElement(edit.collection, edit.id, edit.values)
        : controller[edit.collection === 'columns' ? 'updateColumn' : 'updateBeam'](
            edit.id,
            edit.values
          );
    return preview
      ? controller.previewOpening(edit.collection, edit.id, edit.values)
      : controller[edit.collection === 'doors' ? 'updateDoor' : 'updateWindow'](
          edit.id,
          edit.values
        );
  }
  function begin(touches) {
    controller.clearPreview({ clearIssues: true });
    const start = world(touches[0]);
    const hit = mode === 'select' || mode === 'resize' ? hitTest(start) : null;
    if (hit) selection = { collection: hit.collection, id: hit.item.id };
    gesture = {
      start,
      screenStart: touches[0],
      viewport: { ...viewport },
      touches: touches.length,
      initialDistance: touches.length > 1 ? length(touches[0], touches[1]) : null,
      hit,
      moved: false,
    };
    if (touches.length > 1 || mode === 'pan') gesture.pan = true;
    draft = null;
    notify();
  }
  function move(touches) {
    if (!gesture || !touches.length) return;
    const touch = touches[0];
    if (touches.length > 1 || gesture.pan) {
      if (touches.length > 1 && !gesture.initialDistance) {
        gesture.initialDistance = length(touches[0], touches[1]);
        gesture.viewport = { ...viewport };
      }
      const scale =
        touches.length > 1
          ? Math.max(
              0.25,
              Math.min(
                4,
                (gesture.viewport.scale * length(touches[0], touches[1])) /
                  Math.max(1, gesture.initialDistance)
              )
            )
          : gesture.viewport.scale;
      viewport = {
        x: touch.x - gesture.start.x * scale,
        y: touch.y - gesture.start.y * scale,
        scale,
      };
      gesture.pan = true;
      onViewport({ ...viewport });
      return;
    }
    const end = world(touch);
    gesture.moved ||= length(touch, gesture.screenStart) > 4;
    if (!canEdit(gesture.hit) || !gesture.moved) return;
    if (mode === 'room')
      draft = {
        type: 'room',
        x: Math.min(gesture.start.x, end.x),
        y: Math.min(gesture.start.y, end.y),
        width: Math.abs(end.x - gesture.start.x),
        height: Math.abs(end.y - gesture.start.y),
      };
    else if (mode === 'wall' || mode === 'beam') draft = { type: mode, start: gesture.start, end };
    else if (gesture.hit?.collection === 'rooms') {
      const room = gesture.hit.item;
      draft = {
        type: 'room-edit',
        roomId: room.id,
        rect:
          mode === 'resize'
            ? {
                ...room.rect,
                width: end.x - room.rect.x,
                height: end.y - room.rect.y,
              }
            : {
                ...room.rect,
                x: room.rect.x + end.x - gesture.start.x,
                y: room.rect.y + end.y - gesture.start.y,
              },
      };
      controller.previewRoom(room.id, draft.rect);
    } else if (gesture.hit) {
      const edit = elementEdit(gesture, end);
      draft = { type: 'element-edit', edit };
      applyElementEdit(edit, true);
    }
    notify();
  }
  async function created(collection, result) {
    const item = await result;
    if (item) controller.focus(collection, item.id);
    return item;
  }
  async function end(touches = []) {
    if (!gesture) return;
    if (touches.length) move(touches);
    const current = gesture;
    const pending = draft;
    gesture = null;
    draft = null;
    if (current.pan) {
      notify();
      return;
    }
    try {
      if (!canEdit(current.hit)) {
        if (current.hit && !current.moved)
          controller.focus(current.hit.collection, current.hit.item.id);
        return;
      }
      if (pending?.type === 'room' && pending.width > 4 && pending.height > 4)
        await created('rooms', controller.createRoom(pending));
      else if (pending?.type === 'room-edit')
        await controller.updateRoom(pending.roomId, pending.rect);
      else if (pending?.type === 'wall' || pending?.type === 'beam') {
        const room = roomAt(pending.start);
        if (room && inside(pending.end, room.vertices)) {
          if (pending.type === 'wall')
            await created('walls', controller.createWall(room.id, [pending.start, pending.end]));
          else
            await created(
              'beams',
              controller.createBeam(room.id, {
                startU: (pending.start.x - room.rect.x) / room.rect.width,
                startV: (pending.start.y - room.rect.y) / room.rect.height,
                endU: (pending.end.x - room.rect.x) / room.rect.width,
                endV: (pending.end.y - room.rect.y) / room.rect.height,
              })
            );
        }
      } else if (pending?.type === 'element-edit') {
        await applyElementEdit(pending.edit, false);
      } else if (mode === 'column') {
        const room = roomAt(current.start);
        if (room)
          await created(
            'columns',
            controller.createColumn(room.id, {
              centerU: (current.start.x - room.rect.x) / room.rect.width,
              centerV: (current.start.y - room.rect.y) / room.rect.height,
            })
          );
      } else if (mode === 'door' || mode === 'window') {
        const hit = wallAt(current.start);
        if (hit)
          await created(
            mode === 'door' ? 'doors' : 'windows',
            controller[mode === 'door' ? 'createDoor' : 'createWindow'](hit.item.id, {
              segmentIndex: hit.segmentIndex,
              startRatio: hit.ratio,
              width: mode === 'door' ? 0.9 : 1.2,
            })
          );
      } else if (current.hit && !current.moved)
        controller.focus(current.hit.collection, current.hit.item.id);
    } finally {
      controller.clearPreview();
      notify();
    }
  }
  return {
    begin,
    move,
    end,
    hitTest: (point) => hitTest(world(point)),
    cancel() {
      gesture = null;
      draft = null;
      controller.clearPreview({ clearIssues: true });
      notify();
    },
    setMode(value) {
      this.cancel();
      mode = value;
    },
    setViewport(value) {
      viewport = { ...value };
      onViewport({ ...viewport });
    },
    getViewport: () => ({ ...viewport }),
    getSelection: () => selection,
  };
}
