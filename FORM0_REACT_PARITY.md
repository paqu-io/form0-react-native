# form0-react-native parity tracker

This file is the package-level source of truth for `form0-react-native` parity work against
`form0-react`.

Every PR that changes parity work must update this file in the same PR. No parity change should
land without a tracker edit.

## Current Status

| Area | Status | Notes |
| --- | --- | --- |
| Engine options | Implemented | `FormRenderer` now accepts `engineOptions` and passes `helpers`, `security`, warnings, operations, and update hooks into root and repeatable engines. |
| Events and operations | Implemented | Root and repeatable editors now trigger `load-record`, `edit-record`, and `change`. `SETVALUE` is supported and `ALERT` is handled through a FIFO native dialog bridge. |
| Warnings | Implemented | Native now forwards `form0-core` warnings through `engineOptions.onWarning`. |
| Snapshots | Implemented | `initialSnapshot` and `onSnapshotChange(snapshot, { kind, dirty })` are now first-class APIs. |
| Timestamp lifecycle | Implemented | Root timestamps are renderer-owned and live during editing. Repeatable entries preserve `created_at_client`, `updated_at_client`, `created_at_server`, and `updated_at_server`. |
| Repeatable editor freezing | Implemented | `initialInstance` and `parentValues` are frozen when opening repeatable editors, including nested editor flows. |
| Navigation / validation panel | Implemented | Mobile now exposes a package-owned title-tap sheet for section navigation and validation issues on root and repeatable editor screens. |
| SignatureField | Implemented | Native ships a package-agnostic built-in renderer that preserves the `form0-core` output contract. |
| PhotoField strategy | Implemented | The package still defaults to override-driven integration. The built-in registration remains intentionally placeholder-backed. |
| VideoField strategy | Implemented | The package still defaults to override-driven integration. The built-in registration remains intentionally placeholder-backed. |
| Types | Implemented | `form0-react-native` now ships first-party `.d.ts` declarations. |
| Tests | Next | Runtime and source coverage were extended for parity work, but interaction-level coverage should continue to grow. |
| Consumer adoption: reform-mobile-react-native-expo | Implemented | The app uses `initialSnapshot` and `onSnapshotChange`, keeps media overrides in place, and should drop its app-local type shim once the published package is reinstalled. |
| Consumer adoption: form0-mobile-tmpl-react-native-expo | Implemented | The template now consumes structured submits and forwards `initialSnapshot` and `onSnapshotChange` while preserving create-first `initialValues` flows. |

Status vocabulary:
- `Implemented`: shipped in the current package workspace.
- `Next`: intentionally on deck and worth continuing soon.
- `Deferred`: intentionally postponed.
- `Not Planned`: intentionally out of scope for the native first-class target.

## Decisions

- `BuildingPlanSection` and `FormLinkField` are out of scope for this parity track.
- `PhotoField` and `VideoField` remain override-driven for now.
- `SignatureField` is the only media field that moved to a built-in native implementation in this round.
- Full worker/store parity is deferred and is not part of the first-class native target.
- Full web prop-surface parity is not a goal. User-meaningful runtime parity is the goal.
- Consumer-supplied `renderers` keep precedence over built-in field components.
- Placeholder-backed defaults must stay visible in docs and dev diagnostics so `PhotoField` and
  `VideoField` are not mistaken for complete native capture stacks.

## Roadmap

1. Expand interaction-level test coverage around repeatable editing, alert operations, and snapshot
   callbacks.
2. Validate the new title-tap navigation panel and root validation jump behavior across production
   consumers before expanding the native affordance set.
3. Revisit minimal adapter-based `PhotoField` and `VideoField` defaults only if they can stay
   package-agnostic and remain override-friendly.

## Deferred / Not Planned

- Deferred: worker mode parity.
- Deferred: selector-store parity.
- Deferred: wholesale web prop-surface parity.
- Not Planned: Expo-coupled camera, picker, recorder, upload, and permissions flows inside
  `form0-react-native`.
- Not Planned: `BuildingPlanSection` and `FormLinkField` within this parity track.

## Change Log

- 2026-06-10 - `Unreleased`: added native `engineOptions`, events and operation handling, live
  snapshots and timestamps, frozen repeatable editor seeds, a package-owned title-tap navigation
  and validation panel, built-in `SignatureField`, first-party types, and consumer adoption of the
  new snapshot contract in reform mobile and the Expo template.
