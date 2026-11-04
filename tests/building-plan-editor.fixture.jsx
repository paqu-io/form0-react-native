import React from 'react';
import { cleanup, fireEvent, render, screen, within, waitFor } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import {
  createBuildingPlanSession,
  expandBuildingPlanSchema,
  writeBuildingPlanRecord,
} from 'form0-core';

function fixture(withRoom = false) {
  const schema = {
    form: {
      name: 'Building',
      elements: [
        {
          type: 'BuildingPlanSection',
          key: 'plan',
          data_name: 'plan',
          label: 'Plan',
          description: null,
          description_mode: null,
          visible: true,
          visible_conditions: null,
          read_only: false,
          read_only_conditions: null,
          node_overrides: null,
        },
      ],
    },
  };
  const meta = expandBuildingPlanSchema(schema).buildingPlanMeta[0];
  const domain = createBuildingPlanSession();
  domain.apply({
    type: 'create_floor',
    values: {
      floor_name: { choice: [{ value: 'ground_floor', label: 'Ground Floor' }], other: [] },
      floor_elevation_m: 0,
      floor_height_m: 3,
    },
    defaults: { wall_height_m: 3 },
  });
  if (withRoom)
    domain.apply({
      type: 'create_room',
      floorId: domain.getSnapshot().floors[0].id,
      rectangle: { x: 0, y: 0, width: 5, height: 3 },
    });
  const record = writeBuildingPlanRecord({ meta, plan: domain.getSnapshot() });
  return { schema, meta, record };
}

/** Platform-adapter editor proof. Actual touch and Hermes/device acceptance are separate. */
export function runBuildingPlanEditorTests(FormRenderer) {
  afterEach(cleanup);
  for (const security of ['trusted', 'safe'])
    it(`Native Split/Rejoin commands stay in the existing room editor without dirtying geometry (${security})`, async () => {
      const { schema, record } = fixture(true);
      let latest;
      render(
        <FormRenderer
          schema={schema}
          mode="edit"
          repeatableEntryMode="edit"
          initialSnapshot={{ raw_values: {}, repeatable: record.repeatable }}
          engineOptions={{
            events: { recordKind: 'existing' },
            security: { mode: security },
            diagnostics: { console: false },
          }}
          onSnapshotChange={(snapshot) => {
            latest = snapshot;
          }}
        />
      );
      for (let level = 0; level < 3; level++)
        fireEvent.click(await screen.findByRole('button', { name: 'View', exact: true }));
      const rooms = screen.getByText('Rooms', { exact: true }).closest('div').parentElement;
      fireEvent.click(within(rooms).getByRole('button', { name: 'View', exact: true }));
      await screen.findByText('Rooms 1');
      fireEvent.click(screen.getAllByRole('button', { name: 'View', exact: true }).at(-1));
      await screen.findByText('Walls', { exact: true });
      const before = JSON.stringify(latest.repeatable);
      fireEvent.click(screen.getByRole('button', { name: 'Split', exact: true }));
      expect(await screen.findByText(/Tap a wall to split it/)).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: 'Rejoin', exact: true }));
      expect(await screen.findByText(/Tap an editing node/)).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Save', exact: true })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Cancel', exact: true })).toBeTruthy();
      expect(JSON.stringify(latest.repeatable)).toBe(before);
    });
  for (const security of ['trusted', 'safe'])
    it(`Native BuildingPlan keeps the standard floor editor controls and canonical record state (${security})`, async () => {
      const { schema, meta, record } = fixture();
      let latest;
      render(
        <FormRenderer
          schema={schema}
          mode="edit"
          repeatableEntryMode="edit"
          initialSnapshot={{ raw_values: {}, repeatable: record.repeatable }}
          engineOptions={{
            events: { recordKind: 'existing' },
            security: { mode: security },
            diagnostics: { console: false },
          }}
          onSnapshotChange={(snapshot) => {
            latest = snapshot;
          }}
        />
      );
      fireEvent.click(await screen.findByRole('button', { name: 'View', exact: true }));
      fireEvent.click(await screen.findByRole('button', { name: 'View', exact: true }));
      fireEvent.click(screen.getByRole('button', { name: 'View', exact: true }));
      expect(await screen.findByLabelText('Building plan canvas')).toBeTruthy();
      expect(screen.queryByText('Building plan model')).toBeNull();
      expect(screen.queryByText('Physical walls', { exact: true })).toBeNull();
      expect(screen.queryByText('Observations', { exact: true })).toBeNull();
      expect(screen.getByRole('button', { name: 'Save', exact: true })).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Apply', exact: true })).toBeNull();
      const rooms = screen.getByText('Rooms', { exact: true }).closest('div').parentElement;
      fireEvent.click(within(rooms).getByRole('button', { name: 'View', exact: true }));
      fireEvent.click(await screen.findByRole('button', { name: /^\+ / }));
      expect(await screen.findByRole('button', { name: 'Cancel', exact: true })).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: 'Cancel', exact: true }));
      fireEvent.click(await screen.findByRole('button', { name: 'Discard', exact: true }));
      expect((await screen.findAllByText('0 items')).length).toBeGreaterThan(0);
      fireEvent.click(screen.getByRole('button', { name: 'Back', exact: true }));
      fireEvent.click(screen.getByRole('button', { name: 'Save', exact: true }));
      await waitFor(() =>
        expect(
          latest.repeatable[meta.repeatablesByNodeKey.floors.preferredKey][0].repeatable[
            meta.repeatablesByNodeKey.rooms.preferredKey
          ]
        ).toEqual([])
      );
    });
  for (const security of ['trusted', 'safe'])
    it(`Native BuildingPlan readonly navigation preserves the nested wall workflow (${security})`, async () => {
      const { schema, record } = fixture(true);
      render(
        <FormRenderer
          schema={schema}
          mode="edit"
          repeatableEntryMode="readonly"
          initialSnapshot={{ raw_values: {}, repeatable: record.repeatable }}
          engineOptions={{
            events: { recordKind: 'existing' },
            security: { mode: security },
            diagnostics: { console: false },
          }}
        />
      );
      for (let level = 0; level < 3; level++)
        fireEvent.click(await screen.findByRole('button', { name: 'View', exact: true }));
      expect(await screen.findByLabelText('Building plan canvas')).toBeTruthy();
      const rooms = screen.getByText('Rooms', { exact: true }).closest('div').parentElement;
      fireEvent.click(within(rooms).getByRole('button', { name: 'View', exact: true }));
      await screen.findByText('Rooms 1');
      fireEvent.click(screen.getAllByRole('button', { name: 'View', exact: true }).at(-1));
      const wallsLabel = await screen.findByText('Walls', { exact: true });
      const walls = wallsLabel.closest('div').parentElement;
      for (const label of ['Columns', 'Beams', 'Objects'])
        expect(screen.getByText(label, { exact: true })).toBeTruthy();
      fireEvent.click(within(walls).getByRole('button', { name: 'View', exact: true }));
      await screen.findByText('Walls 1');
      fireEvent.click(screen.getAllByRole('button', { name: 'View', exact: true }).at(-1));
      expect(await screen.findByText('Doors', { exact: true })).toBeTruthy();
      expect(screen.getByText('Windows', { exact: true })).toBeTruthy();
      expect(screen.queryByText('Physical walls', { exact: true })).toBeNull();
      expect(screen.queryByText('Observations', { exact: true })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Save', exact: true })).toBeNull();
    });
}
