# form0-react-native

[![NPM Version](https://img.shields.io/npm/v/form0-react-native)](https://www.npmjs.com/package/form0-react-native)
[![NPM Downloads](https://img.shields.io/npm/dm/form0-react-native)](https://www.npmjs.com/package/form0-react-native)
[![CI](https://github.com/paqu-io/form0-react-native/actions/workflows/ci.yml/badge.svg)](https://github.com/paqu-io/form0-react-native/actions/workflows/ci.yml)
![NPM License](https://img.shields.io/npm/l/form0-react-native)
[![Docs](https://img.shields.io/badge/docs-docs.form0.dev-2563eb)](https://docs.form0.dev)
[![Website](https://img.shields.io/badge/site-form0.dev-0f172a)](https://form0.dev)
![NPM Last Update](https://img.shields.io/npm/last-update/form0-react-native)
[![Socket](https://socket.dev/api/badge/npm/package/form0-react-native)](https://socket.dev/npm/package/form0-react-native)

> [!NOTE]
> form0 is in active development and is available to use today. Its schema format and core
> concepts are stable in practice, but releases before 1.0 may include breaking changes. Pin your
> versions and review the release notes when upgrading. A formally stable release is coming.

`form0-react-native` is the React Native UI layer for the [form0 ecosystem](https://form0.dev). It
combines `form0-core` with platform-native field renderers for iOS and Android while allowing an
application to provide its own components, theme, media handling, and image resolution.

## 🚀 Start with the CLI

For a new project, install [`form0-cli`](https://www.npmjs.com/package/form0-cli) and follow the
[quickstart](https://docs.form0.dev/getting-started/quickstart). Choose the mobile application
option to start from the maintained Expo template.

Install `form0-react-native` directly when integrating it into an existing React Native project.

## 📦 Installation

```bash
npm install form0-react-native
```

Install compatible versions of the package's React Native peer dependencies. In an Expo project,
use `npx expo install` so Expo selects compatible native versions.

## ⚡ Quick example

```jsx
import { FormRenderer } from 'form0-react-native';

const schema = {
  form: {
    name: 'Inspection',
    status_field: null,
    elements: [
      {
        type: 'TextField',
        key: 'site_name',
        data_name: 'site_name',
        label: 'Site name',
        display: 'default',
        description: null,
        description_mode: null,
        required: true,
        required_conditions: null,
        visible: true,
        visible_conditions: null,
        read_only: false,
        read_only_conditions: null,
        default_value: null,
        pattern: null,
        pattern_description: null,
        supporting_image: false,
        supporting_image_path: null,
        supporting_image_display: null,
      },
    ],
  },
};

export function InspectionForm() {
  return <FormRenderer schema={schema} onSubmit={(record) => console.log(record)} />;
}
```

## Renderer overrides

`FormRenderer` accepts a `renderers` prop so applications can replace or extend field components
without forking the package:

```jsx
const renderers = {
  PhotoField: CustomPhotoField,
  VideoField: CustomVideoField,
};

<FormRenderer schema={schema} renderers={renderers} />;
```

> [!IMPORTANT]
> `PhotoField` and `VideoField` use placeholder-backed defaults. Production applications should
> provide renderers that own capture, storage, upload, and permission handling for those fields.

`SignatureField` has a built-in native renderer and can also be overridden. The package includes a
mobile navigation and validation sheet, repeatable-section drilldown, theme overrides, and an
image resolver integration point.

## Compatibility note for 0.3.0

Repeatable-row editors no longer dispatch `load-record`, `edit-record`, or `change` automatically
on their row engine. Earlier versions dispatched them when opening/editing a row or changing a row
field. Automatic main-record dispatch is preserved: the root engine still receives `load-record`
when ready, `edit-record` when entering edit mode, and `change` after a root field edit.

If your application relied on the previous automatic row-engine dispatch, review its handlers before
upgrading. Repeatable lifecycle events remain application-owned; this release does not introduce a
new automatic repeatable-event contract. Portable lifecycle design remains tracked in core
[#98](https://github.com/paqu-io/form0-core/issues/98) and
[#102](https://github.com/paqu-io/form0-core/issues/102).

## ✅ Requirements

- Node.js 22 or newer
- React 18 or 19
- React Native 0.72 or newer
- Compatible `lucide-react-native`, `react-native-svg`, and optional safe-area dependencies

See the
[React parity tracker](https://github.com/paqu-io/form0-react-native/blob/main/FORM0_REACT_PARITY.md)
for current renderer coverage and planned work.

## 📚 Documentation

- [Quickstart](https://docs.form0.dev/getting-started/quickstart)
- [Bindings overview](https://docs.form0.dev/bindings/overview)
- [Install and render with React Native](https://docs.form0.dev/bindings/react-native/install-render)
- [FormRenderer](https://docs.form0.dev/bindings/react-native/form-renderer)
- [Custom field renderers](https://docs.form0.dev/bindings/react-native/custom-renderers)
- [Mobile integration](https://docs.form0.dev/bindings/react-native/mobile-integration)
- [React Native API reference](https://docs.form0.dev/bindings/react-native/api-reference)
- [Expo mobile starter](https://github.com/paqu-io/form0-mobile-tmpl-react-native-expo)

## 🔒 Security

Schema expressions are evaluated by `form0-core`. Only use schemas from trusted authors and review
the [form0-core security policy](https://github.com/paqu-io/form0-core/blob/main/SECURITY.md).
Report vulnerabilities according to this repository's [security policy](./SECURITY.md).

## 🤝 Support and contributing

See [SUPPORT.md](https://github.com/paqu-io/form0-react-native/blob/main/SUPPORT.md) for help and
[CONTRIBUTING.md](https://github.com/paqu-io/form0-react-native/blob/main/CONTRIBUTING.md) to contribute.

## 📄 License

[MIT](./LICENSE)

## Engine options and calculation diagnostics

`engineOptions` forwards helpers, security, `onWarning`, `onUpdate`, `onOperations`, and calculation diagnostic controls to root and repeatable-row engines. Helpers and security are engine-construction settings: remount `FormRenderer` to replace them predictably. Callbacks and the console preference stay current in already-open editors without an extra evaluation.

```jsx
const findingsByScope = new Map();

<FormRenderer
  schema={schema}
  engineOptions={{
    diagnostics: { console: false },
    onDiagnostics(snapshot, meta) {
      if (meta.kind === 'scope-ended') findingsByScope.delete(meta.scopeId);
      else findingsByScope.set(meta.scopeId, { snapshot, meta });
    },
  }}
/>;
```

Console reporting is enabled by default. `diagnostics.console: false` suppresses calculation details, recovery and scope-ended console notices; collection and callbacks remain active. Providing `onDiagnostics` does not implicitly disable console reporting. Core codes, severity, messages, phases, suggestions and context are preserved. Developer console headings use English, as with the existing binding messages.

`onDiagnostics(snapshot, meta)` receives a defensive array after each accepted completed evaluation, including the first, identical findings and `[]` after recovery. Console output suppresses identical repeats and reports new/changed findings, recovery and recurrence. Errors from diagnostic observers, including rejected promises, cannot interrupt evaluation or operation processing.

Metadata contains `scopeId`, `instancePath`, `evaluationId` and `kind`. A scope identifies one transient engine lifetime; evaluation IDs increase within that scope. Root paths are `[]`. Each row path segment contains `repeatableKey`, `instanceId`, zero-based `index`, and `identity: "id" | "position"`. Existing `id` or `record_id` values are used, with an explicitly positional fallback when absent. Findings carry the same path in `context.instancePath`; reporting never creates record IDs.

Closing/deleting an editor, replacing its engine/schema, or unmounting retires the old scope with `onDiagnostics([], { ...meta, kind: "scope-ended" })`. This means the scope is no longer observed, not that the saved row recovered. Only engines that actually evaluate are represented: the callback is not a complete submission-health report and does not re-evaluate closed rows.

Calculation diagnostics remain outside `state.errors`, saved snapshots and record payloads. They do not change validation display timing, submission decisions or draft saving, and do not create automatic alerts or a diagnostics panel.

`onOperations(operations, meta, applyDefault)` receives non-alert operations. Delegate selected operations with `applyDefault(selected, meta)`; without a callback, existing default processing remains active. Renderer-owned `ALERT` dialogs appear once. Operation batches follow the existing platform processing; callbacks must handle every supplied batch. `onWarning` remains the legacy warning route, including its existing throttling, and is not a replacement for diagnostic snapshots. `onUpdate(state, engine)` retains the execution-specific engine/facade argument; use `onDiagnostics` for portable diagnostic consumption.
