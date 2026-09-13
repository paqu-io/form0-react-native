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

For a new project, install [`form0-cli`](https://github.com/paqu-io/form0-cli) and follow the
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
import { FormRenderer } from "form0-react-native";

const schema = {
  form: {
    name: "Inspection",
    status_field: null,
    elements: [
      {
        type: "TextField",
        key: "site_name",
        data_name: "site_name",
        label: "Site name",
        display: "default",
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
  return (
    <FormRenderer schema={schema} onSubmit={(record) => console.log(record)} />
  );
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

> [!IMPORTANT] > `PhotoField` and `VideoField` use placeholder-backed defaults. Production applications should
> provide renderers that own capture, storage, upload, and permission handling for those fields.

`SignatureField` has a built-in native renderer and can also be overridden. The package includes a
mobile navigation and validation sheet, repeatable-section drilldown, theme overrides, and an
image resolver integration point.

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
- [Full documentation](https://docs.form0.dev)
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
