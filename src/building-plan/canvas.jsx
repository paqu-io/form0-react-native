import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Pressable, PanResponder, TextInput } from 'react-native';
import Svg, { G, Polygon, Polyline, Line, Rect, Text as SvgText } from 'react-native-svg';
import { BuildingPlanCanvasController } from 'form0-core';
import { useTheme } from '../theme-context.jsx';
import { Text } from '../typography.jsx';
import { createBuildingPlanTouchController } from './touch-controller.js';

const EMPTY = {
  floors: [],
  rooms: [],
  walls: [],
  columns: [],
  beams: [],
  doors: [],
  windows: [],
};
const TOOLS = [
  ['select', 'Select'],
  ['pan', 'Pan'],
  ['resize', 'Resize'],
  ['room', 'Room'],
  ['wall', 'Wall'],
  ['door', 'Door'],
  ['window', 'Window'],
  ['column', 'Column'],
  ['beam', 'Beam'],
];

/** Uses the same record transaction and ordinary row navigation as the form editor. */
export function BuildingPlanCanvas({
  context,
  meta: suppliedMeta,
  record,
  readOnly = false,
  onFocusRow,
  onAddFloor,
}) {
  const { theme } = useTheme();
  const current = useRef({ context, record, readOnly, onFocusRow });
  current.current = { context, record, readOnly, onFocusRow };
  const meta = context?.meta || suppliedMeta;
  const [scene, setScene] = useState(EMPTY);
  const [interaction, setInteraction] = useState({
    selection: null,
    draft: null,
  });
  const [viewport, setViewport] = useState({ x: 20, y: 20, scale: 1 });
  const [mode, setMode] = useState('select');
  const [width, setWidth] = useState(320);
  const [issues, setIssues] = useState([]);
  const [dimensions, setDimensions] = useState({ width: '', height: '' });
  const runtime = useRef(null);
  const frame = useRef(null);
  const pendingTouch = useRef(null);
  useEffect(() => {
    if (!meta) return;
    const controller = new BuildingPlanCanvasController({
      meta,
      readRecord: () => current.current.context?.editor.getRecord() || current.current.record,
      writeRecord: (_next, { operation }) =>
        current.current.context?.editor.apply(operation, {
          scopeId: current.current.context.scopeId,
        }) || false,
      readOnly: () => current.current.readOnly || !current.current.context,
      focusRow: (path) => current.current.onFocusRow?.(path),
      reportIssues: setIssues,
    });
    controller.setGridSize(32);
    const selected = context?.editor.resolveRow(context.path);
    if (selected)
      controller.setActiveFloor(
        controller.floors.findIndex((floor) => floor.id === selected.floorId)
      );
    const touch = createBuildingPlanTouchController({
      controller,
      onChange: setInteraction,
      onViewport: setViewport,
      canEdit: (hit) => {
        const context = current.current.context;
        return (
          !current.current.readOnly &&
          Boolean(context) &&
          (context.editor.resolveRow(context.path).node.nodeKey === 'rooms' ||
            !hit ||
            hit.collection === 'rooms')
        );
      },
      scopeRoomId: () => {
        const context = current.current.context;
        if (!context) return null;
        const target = context.editor.resolveRow(context.path);
        return target.node.nodeKey === 'rooms' ? target.model.id : null;
      },
    });
    runtime.current = { controller, touch };
    if (context && context.focusPath?.length > context.path.length)
      current.current.onFocusRow?.(context.focusPath);
    const release = controller.subscribe(setScene);
    const unsubscribe = context?.editor.subscribe(() => {
      controller.syncFromState();
      controller.emitUpdate();
    });
    return () => {
      if (frame.current != null) cancelAnimationFrame(frame.current);
      unsubscribe?.();
      release();
      controller.dispose();
      runtime.current = null;
    };
  }, [meta, context?.editor]);
  useEffect(() => {
    runtime.current?.controller.syncFromState();
    runtime.current?.controller.emitUpdate();
  }, [record]);
  const touches = (event) => {
    const raw = event.nativeEvent.touches?.length
      ? event.nativeEvent.touches
      : event.nativeEvent.changedTouches;
    return (raw?.length ? Array.from(raw) : [event.nativeEvent]).map((touch) => ({
      x: touch.locationX,
      y: touch.locationY,
    }));
  };
  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,
        onPanResponderGrant: (event) => runtime.current?.touch.begin(touches(event)),
        onPanResponderMove: (event) => {
          pendingTouch.current = touches(event);
          if (frame.current == null)
            frame.current = requestAnimationFrame(() => {
              frame.current = null;
              runtime.current?.touch.move(pendingTouch.current);
            });
        },
        onPanResponderRelease: (event) => {
          if (frame.current != null) cancelAnimationFrame(frame.current);
          frame.current = null;
          runtime.current?.touch
            .end(touches(event))
            .catch((error) => setIssues([{ message: error.message }]));
        },
        onPanResponderTerminate: () => {
          if (frame.current != null) cancelAnimationFrame(frame.current);
          frame.current = null;
          runtime.current?.touch.cancel();
        },
      }),
    []
  );
  const selectedRoom =
    interaction.selection?.collection === 'rooms'
      ? scene.rooms.find((room) => room.id === interaction.selection.id)
      : null;
  useEffect(() => {
    if (selectedRoom)
      setDimensions({
        width: String(selectedRoom.rect.width / 32),
        height: String(selectedRoom.rect.height / 32),
      });
  }, [selectedRoom?.rect.width, selectedRoom?.rect.height, selectedRoom?.id]);
  const button = (label, action, disabled = false, selected = false) => (
    <Pressable
      key={label}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onPress={action}
      style={{
        minWidth: 44,
        minHeight: 44,
        padding: 10,
        borderWidth: 1,
        borderColor: theme.color.border,
        borderRadius: 6,
        backgroundColor: selected ? theme.color.section : theme.color.background,
        opacity: disabled ? 0.45 : 1,
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: theme.color.foreground }}>{label}</Text>
    </Pressable>
  );
  const point = (room, u, v) => ({
    x: room.rect.x + u * room.rect.width,
    y: room.rect.y + v * room.rect.height,
  });
  const ghost = interaction.draft;
  return (
    <View style={{ marginBottom: 16, gap: 8 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {onAddFloor && button('Add floor', onAddFloor, readOnly)}
        {TOOLS.map(([id, label]) =>
          button(
            label,
            () => {
              setMode(id);
              runtime.current?.touch.setMode(id);
            },
            id !== 'select' &&
              id !== 'pan' &&
              (readOnly ||
                !context ||
                (context.editor.resolveRow(context.path).node.nodeKey === 'floors'
                  ? id !== 'room'
                  : id === 'room')),
            id === mode
          )
        )}
        {context &&
          button(
            'Undo',
            () => setIssues(context.editor.undo({ scopeId: context.scopeId }).issues),
            readOnly || !context.editor.getState().canUndo
          )}
        {context &&
          button(
            'Redo',
            () => setIssues(context.editor.redo({ scopeId: context.scopeId }).issues),
            readOnly || !context.editor.getState().canRedo
          )}
        {button('Zoom in', () =>
          runtime.current?.touch.setViewport({
            ...viewport,
            scale: Math.min(4, viewport.scale * 1.25),
          })
        )}
        {button('Zoom out', () =>
          runtime.current?.touch.setViewport({
            ...viewport,
            scale: Math.max(0.25, viewport.scale / 1.25),
          })
        )}
        {button('Reset view', () => runtime.current?.touch.setViewport({ x: 20, y: 20, scale: 1 }))}
      </View>
      {scene.floors.length > 1 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {scene.floors.map((floor, index) =>
            button(
              floor.label,
              () => runtime.current?.controller.setActiveFloor(index),
              Boolean(context),
              index === scene.activeFloorIndex
            )
          )}
        </View>
      )}
      <View
        accessibilityLabel="Building plan canvas"
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        {...responder.panHandlers}
        style={{
          height: 320,
          borderWidth: 1,
          borderColor: theme.color.border,
          backgroundColor: theme.color.background,
          overflow: 'hidden',
        }}
      >
        <Svg width={width} height={320} pointerEvents="none" viewBox={`0 0 ${width} 320`}>
          <G transform={`translate(${viewport.x} ${viewport.y}) scale(${viewport.scale})`}>
            {scene.rooms.map((room) => (
              <G key={room.id}>
                <Polygon
                  points={room.vertices.map((p) => `${p.x},${p.y}`).join(' ')}
                  fill={room.color}
                  stroke={
                    interaction.selection?.id === room.id ? theme.color.primary : theme.color.border
                  }
                  strokeWidth={2 / viewport.scale}
                />
                <SvgText
                  x={room.rect.x + room.rect.width / 2}
                  y={room.rect.y + room.rect.height / 2}
                  textAnchor="middle"
                  fontSize={12 / viewport.scale}
                  fill={theme.color.foreground}
                >
                  {room.displayLabel}
                </SvgText>
              </G>
            ))}
            {scene.walls.map((wall) => (
              <Polyline
                key={wall.id}
                points={wall.points.map((p) => `${p.x},${p.y}`).join(' ')}
                fill="none"
                stroke={theme.color.foreground}
                strokeWidth={3 / viewport.scale}
              />
            ))}
            {scene.columns.map((column) => {
              const room = scene.rooms.find((room) => room.id === column.roomId);
              const center = point(room, column.centerU, column.centerV);
              return (
                <Rect
                  key={column.id}
                  x={center.x - column.width * 16}
                  y={center.y - column.height * 16}
                  width={column.width * 32}
                  height={column.height * 32}
                  fill={theme.color.primary}
                />
              );
            })}
            {scene.beams.map((beam) => {
              const room = scene.rooms.find((room) => room.id === beam.roomId);
              const start = point(room, beam.startU, beam.startV),
                end = point(room, beam.endU, beam.endV);
              return (
                <Line
                  key={beam.id}
                  x1={start.x}
                  y1={start.y}
                  x2={end.x}
                  y2={end.y}
                  stroke={theme.color.primary}
                  strokeWidth={Math.max(3 / viewport.scale, beam.width * 32)}
                />
              );
            })}
            {['doors', 'windows'].flatMap((collection) =>
              scene[collection].map((opening) => {
                const wall = scene.walls.find((wall) => wall.id === opening.wallId);
                const start = wall.points[opening.segmentIndex],
                  end = wall.points[opening.segmentIndex + 1];
                return (
                  <Line
                    key={opening.id}
                    x1={start.x + (end.x - start.x) * opening.startRatio}
                    y1={start.y + (end.y - start.y) * opening.startRatio}
                    x2={start.x + (end.x - start.x) * opening.endRatio}
                    y2={start.y + (end.y - start.y) * opening.endRatio}
                    stroke={collection === 'doors' ? '#2b8a3e' : '#1c7ed6'}
                    strokeWidth={6 / viewport.scale}
                  />
                );
              })
            )}
            {ghost?.type === 'room' && (
              <Rect
                x={ghost.x}
                y={ghost.y}
                width={ghost.width}
                height={ghost.height}
                fill="none"
                stroke={theme.color.primary}
                strokeDasharray="5 3"
              />
            )}
            {(ghost?.type === 'wall' || ghost?.type === 'beam') && (
              <Line
                x1={ghost.start.x}
                y1={ghost.start.y}
                x2={ghost.end.x}
                y2={ghost.end.y}
                stroke={theme.color.primary}
                strokeWidth={3 / viewport.scale}
              />
            )}
          </G>
        </Svg>
      </View>
      {selectedRoom && !readOnly && context && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <TextInput
            accessibilityLabel="Room width in metres"
            keyboardType="decimal-pad"
            value={dimensions.width}
            onChangeText={(value) => setDimensions((current) => ({ ...current, width: value }))}
            style={{
              minWidth: 64,
              minHeight: 44,
              color: theme.color.foreground,
              borderColor: theme.color.border,
              borderWidth: 1,
              padding: 8,
            }}
          />
          <TextInput
            accessibilityLabel="Room height in metres"
            keyboardType="decimal-pad"
            value={dimensions.height}
            onChangeText={(value) => setDimensions((current) => ({ ...current, height: value }))}
            style={{
              minWidth: 64,
              minHeight: 44,
              color: theme.color.foreground,
              borderColor: theme.color.border,
              borderWidth: 1,
              padding: 8,
            }}
          />
          {button('Set dimensions', () =>
            runtime.current?.controller.updateRoom(selectedRoom.id, {
              ...selectedRoom.rect,
              width: Number(dimensions.width.replace(',', '.')) * 32,
              height: Number(dimensions.height.replace(',', '.')) * 32,
            })
          )}
        </View>
      )}
      {issues.length > 0 && (
        <Text accessibilityRole="alert" style={{ color: theme.color.error }}>
          {issues.map((issue) => issue.message).join(' ')}
        </Text>
      )}
    </View>
  );
}
