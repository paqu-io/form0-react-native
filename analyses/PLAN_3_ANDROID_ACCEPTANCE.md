# Plan 3 Android acceptance

Final Android acceptance is paused pending the separate view-evaluation policy discussion.
The opening-controls patch is automated below; actual device acceptance is pending. Adapter, Node and Chromium results do not establish Hermes
performance or device acceptance. iOS remains deferred. Use the packed core/Native candidates named
in the Plan 3 verification ledger; their labels retain the last published versions until release.

## Prepare and start

The independent harness lives at `.local-test-harnesses/form0-plan3-20261022/device/` in the workspace.
Its generator is `scripts/prepare-record-device-harness.mjs`. It uses mobile-template SDK 58 pins
and the packed candidates, with a separate SQLite database (`form0-plan3-acceptance.db`). It does not
read environment files or alter the production app/database. The SQLite envelope stores record,
snapshot and freshness together before acknowledging a callback or explicit preparation.

Installation is expected to use roughly 1–2 GiB plus npm cache. Check both the Windows backing disk and
WSL space before installing. The independent SDK tree is installed and an Android Hermes bytecode export passed. This is bundle
verification, not device acceptance. The SDK 58 migration updates that tree in place while retaining
SDK 57 manifests and evidence. Reuse the installed tree; do not reinstall merely to resume acceptance.
Native/mobile dependency exceptions remain separate; do not upgrade unrelated dependencies here.

The runnable harness is JavaScript. Its declaration-only TypeScript check lives outside the Expo
project at `../type-checks/native-controller.ts`. Keeping that check inside `device/` caused Expo to
request TypeScript dependencies during startup; it has been relocated and local Metro startup now
passes without them. No SDK or application dependency change is required for that correction.

1. Open a terminal in the device harness directory above and select the workspace's pinned Node
   with `nvm use 24.22.1`.
2. Use the Android Expo Go client for SDK 58. Run `npm start -- --max-workers 2` and scan its QR code.
   Keep the phone and Windows machine on the same Wi-Fi. If WSL networking prevents the LAN connection,
   stop Metro, run `npx expo login` locally, then run `npm start -- --tunnel --max-workers 2`.
   SDK 58's default tunnel uses your Expo account. To use the already installed legacy ngrok provider,
   run `npm start -- --tunnel ngrok --max-workers 2`. Keep account credentials local.
3. Record device model, Android version, Expo client/build version, the displayed React Native version,
   and the displayed `Hermes true` before acceptance. Do not run acceptance through Chrome JS execution.

Entry registration and cache-clearing commands follow the
[Expo entrypoint guidance](https://github.com/expo/expo/blob/main/docs/pages/troubleshooting/application-has-not-been-registered.mdx)
and [CLI guidance](https://github.com/expo/expo/blob/main/docs/pages/router/installation.mdx).
See also [physical-device connections](https://github.com/expo/expo/blob/main/docs/pages/get-started/start-developing.mdx).
These commands do not establish SDK 58/device compatibility by themselves. The fixture source and package pins
are the concrete test inputs; record the actual client/runtime used.

## Walkthrough 1 — nested editing and accepted save/cancel isolation

1. Tap **Nested editing**. Expect root `grand_total` 130; this starts a fresh unsaved fixture.
2. Open the **projects** list using its View control.
3. Tap **View** beside **P1**. Expect view mode and accepted task costs 10 and 20.
4. Tap **Edit** in P1.
5. Change **surcharge** to 5. Expect P1 `subtotal` 35; the root working total remains 130.
6. Tap **Cancel** in P1.
7. Confirm discarding edits if prompted. Expect the root working total remains 130.
8. Tap **View** beside P1 again from the projects list.
9. Tap **Edit**.
10. Set surcharge to 5.
11. Save the child. Expect the root working total becomes 135.
12. Tap **View** beside **P2**. Expect view mode and subtotal 100; P1 has not changed P2's tasks.
13. Use **Cancel** to leave P2 without saving; discard the local calculation if prompted.
14. Use **Back** to return to the root form.
15. Submit the root. Expect successful persistence and no row-ID/order changes. The next walkthrough
    starts its own fixture; do not carry this fixture into it.

The persistence status appears only after the SQLite write succeeds. For these small fixtures the
harness also logs `[form0 acceptance] Persisted record and freshness` after that write. Use the
development console if terminal forwarding is unavailable. Large fixtures intentionally omit full
record logs so logging does not distort responsiveness measurements. **Reopen saved** verifies the
stored envelope; a missing terminal log alone does not indicate a failed write.

## Walkthrough 2 — confirmation, persistence failure and restoration

This fixture intentionally contains accepted child calculations from an earlier 10% tax, while the
current root tax is already 20%. The **Working values** status shows `acceptedChildTotals` without
opening a child. These are accepted in the root's working tree, not necessarily persisted yet.

| State                                        | Line 1 amount / total | Line 2 amount / total | Root grand |
| -------------------------------------------- | --------------------- | --------------------- | ---------- |
| Fresh fixture, accepted children             | 100 / 110             | 200 / 220             | 330        |
| Each child opened for editing, before saving | 100 / 120             | 200 / 240             | 330        |
| Root refresh selected for all children       | 100 / 120             | 200 / 240             | 360        |

The row's **View** button now opens view mode, with **Edit** when its parent permits editing.
Calculations still use current parent inputs immediately; the follow-up evaluation policy is pending.
Opening the row does not accept that calculation into
the root. **Cancel**, followed by **Discard** if prompted, leaves accepted totals unchanged. **Save**
accepts that row's new calculation: saving only line 1 produces root 340, only line 2 produces 350.
If you saved any children while inspecting, reset the fixture before continuing below. This
walkthrough tests root submission of closed children; no child needs to be opened first.

1. Tap **Confirmation / persistence**. Expect accepted child totals 110 and 220 and root `grand` 330.
2. Enable **Simulate persistence failure**.
3. Submit and choose **Update all and continue**. Expect the host failure status, unsaved working
   totals 120 and 240, root 360 and dirty work; no successful-persistence acknowledgement.
4. Tap **Confirmation / persistence** again to reset to the original fixture; disable simulated failure.
5. Submit and choose **Keep existing values and continue**. Expect root 330 and persisted pending freshness.
6. Tap **Reopen saved**. Expect `acceptedChildTotals` 110 and 220 in the status, root 330, and the
   restored pending indicator. Opening a child would again display 120 or 240 in its editor.
7. Submit and choose **Update all and continue**. Expect root 360 and successfully persisted current freshness.
8. Tap **Reopen saved** again. Expect 360 with no pending indicator. Reset before the large fixture.

## Walkthrough 3 — responsiveness and cancellation

1. Tap **Large 200**. This fixture has 377 schema elements, 360 scalar definitions, 90 calculations,
   549 condition leaves and six populated repeatable levels. Wait for initial rendering.
2. Tap **Programmatic prepare**. Record elapsed time and maximum observed JS scheduling gap from
   the status area. Preparation alone must not mark the record persisted.
3. Tap **Large 2,000**. Wait for initial rendering, then tap **Programmatic prepare** followed by
   **Cancel preparation** while it is running. Expect `cancelled`, no payload persistence, and a usable UI.
4. Prepare again without cancellation and record timing/gap results. The reference targets are 250 ms
   for 200 rows and 2 seconds for 2,000 rows after warm-up; record actual device results separately.
5. Repeat prepare/cancel twice. Expect no accumulating review UI or stale decision being reused.
6. Optionally tap **Persist prepared** once after a successful preparation; expect one matching acknowledgement.

For actual process-memory evidence, capture Android's app memory before and after the repeated cycles
using the device's profiling tools (for example `adb shell dumpsys meminfo host.exp.exponent` for
Expo Go; use the development build's application ID otherwise). Record that tool and process identity.
The in-app scheduling sampler is not a peak-memory measurement. Report target misses and visible
stalls; do not silently substitute adapter/browser timings for Hermes acceptance.

## Feedback and focused automated verification — 23 October

The maintainer reported walkthrough 1 working on Android and paused walkthrough 2 after observing
120/240 in the open row editors. The distinction above corrects the guide; no calculation or editor
mode behavior was changed. The pre-Plan-3 renderer also opened rows in edit mode under an editable
root. Device/runtime details and the remaining walkthrough results are still pending.

The packed Native adapter regression in `tests/record-renderer.fixture.jsx` passes under TRUSTED
and SAFE: open line 1 displays 120 while accepted rows remain 110/220 and root 330; Cancel/Discard
preserves them; root preparation still requires review of both child changes; saving only line 1
then accepts 120/220 and root 340. Caller inputs remain unchanged. The focused run passed 2 cases;
the existing 17 adapter cases were not rerun. Its JSON report is
`.local-test-harnesses/form0-plan3-20261022/logs/native-open-child-acceptance.json`.
The HTML platform stub emits a nested-button warning for Native's discard-dialog Pressables;
this adapter-only warning does not establish an Android UI failure.

The installed harness App was updated directly from the maintained fixture source, with no
dependency installation or runtime candidate replacement. Its JSX parse and diff whitespace
checks pass. Successful-save logging is limited to the small fixtures and occurs after storage
completes; `acceptedChildTotals` exposes the root's working child values without opening editors.

## Opening-controls patch — 23 October

Existing rows now open in view mode on web and Native, with Edit when their containing record
permits it. New rows start editing. `repeatableEntryMode="edit"` selects direct editing in both
renderers; it cannot bypass a read-only parent. Browsing remains available through nested read-only
records. This patch preserves evaluations in view mode, including the 120/240 display example.
The accepted-snapshot view policy and load-event behavior will be discussed before final device
acceptance. The earlier walkthrough 1 report applies to the previous candidate.

The updated candidate passes all 23 Native adapter cases, 54 Node tests and public declarations.
Opening controls also pass actual Chromium main-thread/worker interactions. Exact archives and
provenance are in `form0-core/analyses/OPENING_CONTROLS_VERIFICATION.md`; previous SDK 58 bundle
exports and the earlier physical-device walkthrough apply to their original candidates.
