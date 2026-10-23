import {
  numericField,
  calculatedField,
  repeatableSection,
  textField,
  formSchema,
} from './calculation-fixtures.js';
import { complexRecordFixture } from './complex-record-fixture.js';
const titleField = (elements) => ({
  type: 'TitleField',
  key: '@title',
  data_name: 'title',
  label: 'Title',
  display: 'default',
  enabled: true,
  visible: true,
  visible_conditions: null,
  read_only: true,
  read_only_conditions: null,
  elements,
});
export function deviceFixture(kind) {
  if (kind.startsWith('large')) {
    const result = complexRecordFixture(kind === 'large200' ? 200 : 2000);
    return {
      schema: result.schema,
      snapshot: { raw_values: result.snapshot.values, repeatable: result.snapshot.repeatable },
    };
  }
  if (kind === 'confirm') {
    return {
      schema: formSchema(
        [
          numericField('tax', { format: 'float' }),
          calculatedField('grand', "REPEATABLESUM($lines, 'total')"),
          repeatableSection('lines', [
            numericField('amount'),
            calculatedField('total', '$amount * (1 + $tax)'),
          ]),
        ],
        { name: 'Confirmation and persistence', repeatable_recalculation: 'confirm' }
      ),
      snapshot: {
        raw_values: { tax: 0.2, grand: 330 },
        repeatable: {
          lines: [
            { id: 0, values: { amount: 100, total: 110 } },
            { id: 'B', values: { amount: 200, total: 220 } },
          ],
        },
      },
    };
  }
  const projects = repeatableSection('projects', [
    textField('name'),
    numericField('surcharge'),
    calculatedField('subtotal', "REPEATABLESUM($tasks, 'cost') + $surcharge"),
    repeatableSection('tasks', [
      numericField('base_cost'),
      calculatedField('cost', '$base_cost * $factor'),
    ]),
  ]);
  projects.title_field = titleField(['name']);
  return {
    schema: formSchema(
      [
        numericField('factor'),
        calculatedField('grand_total', "REPEATABLESUM($projects, 'subtotal')"),
        projects,
      ],
      { name: 'Nested projects' }
    ),
    snapshot: {
      raw_values: { factor: 1, grand_total: 130 },
      repeatable: {
        projects: [
          {
            id: 0,
            values: { name: 'P1', surcharge: 0, subtotal: 30 },
            repeatable: {
              tasks: [
                { id: 'A', values: { base_cost: 10, cost: 10 } },
                { id: 'B', values: { base_cost: 20, cost: 20 } },
              ],
            },
          },
          {
            id: 'P2',
            values: { name: 'P2', surcharge: 0, subtotal: 100 },
            repeatable: { tasks: [{ id: 'C', values: { base_cost: 100, cost: 100 } }] },
          },
        ],
      },
    },
  };
}
