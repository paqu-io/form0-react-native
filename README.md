# form0-react-native

[![NPM Version](https://img.shields.io/npm/v/form0-react-native)](https://www.npmjs.com/package/form0-react-native)
[![NPM Downloads](https://img.shields.io/npm/dt/form0-react-native)](https://www.npmjs.com/package/form0-react-native)
![NPM License](https://img.shields.io/npm/l/form0-react-native)
[![Docs](https://img.shields.io/badge/docs-docs.form0.dev-2563eb)](https://docs.form0.dev)
[![Website](https://img.shields.io/badge/site-form0.dev-0f172a)](https://form0.dev)
![NPM Last Update](https://img.shields.io/npm/last-update/form0-react-native)

> [!WARNING]
> form0 is in active, very early development. Do not use in production. Expect breaking
> changes and unstable behavior.

form0-react-native is the React Native UI layer of the [form0 ecosystem](https://form0.dev), wrapping the form0-core engine with React Native bindings and a lightweight set of default field renderers. It provides minimal, platform-native components that work on iOS and Android, allowing apps to layer their own design systems on top without rewriting engine integration code.

## Parity tracker

The current parity roadmap and status live in [FORM0_REACT_PARITY.md](./FORM0_REACT_PARITY.md).
Keep that file up to date whenever parity work lands.

## Renderer overrides

`FormRenderer` accepts a `renderers` prop so apps can replace or extend field components without forking the package.

```jsx
import { FormRenderer } from 'form0-react-native';

const renderers = {
  PhotoField: CustomPhotoField,
  VideoField: CustomVideoField,
};

<FormRenderer schema={schema} renderers={renderers} />;
```

This is the preferred integration point for app-specific media capture, upload flows, and branding.

`PhotoField` and `VideoField` are still intentionally override-driven. The package registers
placeholder-backed defaults so schemas stay renderable, but production apps should provide their
own renderers for those field types. `SignatureField` now has a built-in native renderer, and a
consumer renderer can still override it the same way.

## Navigation panel

`FormRenderer` now includes a package-owned mobile navigation and validation sheet. On supported
form screens, users can tap the existing header title to open it. The sheet shows section
navigation and validation issues without adding extra header buttons.

Use `forceShowNavigationPanel={true}` to keep the title-tap affordance available even when the
current screen has no visible sections or validation issues yet.

## Repeatable sections

`RepeatableSection` already uses the package drilldown flow by default. The core package owns the repeatable state contract and nested save behavior, while product-specific styling and action wording should stay in the consuming app.

## 🗂️ Documentation

> [!WARNING]
> 🚧 Work in progress...

## Requirements

- Node.js 20.19+

## Contributing

Contributions are welcome! Please feel free to submit [issues](https://github.com/paqu-io/form0-react-native/issues) and [pull requests](https://github.com/paqu-io/form0-react-native/pulls).
