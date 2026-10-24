# Plan 3 Android acceptance

Accepted-snapshot viewing, load permissions and event.mode are implemented; automated evidence
and exact candidate hashes are in `form0-core/analyses/ACCEPTED_VIEW_VERIFICATION.md`.
The maintainer reports walkthroughs 1 and 2 and prompt large-form cancellation passing on Pixel
8a / Android API 37, Expo Go 58.0.5 / Hermes, SAFE off and DevTools closed. The most recent physical
`native-responsive-serialization` run takes 1,682 / 12,457 ms for 200 / 2,000 rows, with observed JS
gaps 152 / 325 ms. Both complete eligible with no issues. The large gap improved from 949 ms;
performance sign-off remains open. See the latest section below for the **single remaining timing
check** with the newer `native-owned-tree-signatures` candidate. Older sections retain historical
diagnostic instructions and candidate provenance; do not rerun them to resume acceptance.

The independent SDK 58 harness now contains the new candidate with installed source-byte parity.
No SDK/dependency installation is needed. Adapter, Node and Chromium results do not establish Hermes
performance; iOS remains deferred. See `form0-core/analyses/ANDROID_PREPARATION_INVESTIGATION.md`
for measurements and limits. Archive labels retain last published versions until maintainer release.

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
| Each child viewed, before entering Edit      | 100 / 110             | 200 / 220             | 330        |
| Each child opened for editing, before saving | 100 / 120             | 200 / 240             | 330        |
| Root refresh selected for all children       | 100 / 120             | 200 / 240             | 360        |

The row's **View** button opens view mode with the accepted total, without calculations or missing
schema defaults. **Edit** starts calculations against current permitted ancestor values. **Cancel**,
followed by **Discard** if prompted, leaves the containing record unchanged. **Save** accepts the
new row calculation: saving only line 1 produces root 340; only line 2 produces 350. No child needs
to be opened before root submission.

1. Tap **Confirmation / persistence** to reset this fixture. Expect accepted totals 110/220 and root 330.
2. Open the **lines** list with its **View** control.
3. Tap **View** beside **lines 1**. Expect amount 100, total 110, and an Edit action.
4. Tap **Edit**. Expect total 120; the containing accepted tree still has 110/220 and root 330.
5. Tap **Cancel**.
6. Confirm **Discard** if prompted. Expect accepted totals remain 110/220.
7. Use **Back** to return to the root form.
8. Enable **Simulate persistence failure**.
9. Submit the root. Expect the update review, covering both children.
10. Choose **Update all and continue**. Expect the host failure status, unsaved working totals
    120/240, root 360 and dirty work; no successful-persistence acknowledgement.
11. Tap **Confirmation / persistence** to reset the original fixture.
12. Disable simulated persistence failure.
13. Submit the root again. Expect the update review.
14. Choose **Keep existing values and continue**. Expect root 330 and persisted pending freshness.
15. Tap **Reopen saved**. Expect accepted totals 110/220, root 330 and the restored pending indicator.
    Viewing those children would show 110/220; Edit would recalculate 120/240 locally.
16. Submit again. Expect another update review.
17. Choose **Update all and continue**. Expect root 360 and successfully persisted current freshness.
18. Tap **Reopen saved**. Expect root 360 with no pending indicator. The next walkthrough starts
    its own fixture.

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

## Accepted-snapshot candidate — 23 October

The earlier opening-controls evidence below applies to its original candidate. The current candidate
preserves accepted calculations while viewing, runs load once with `event.mode`, and starts edit
calculations without replaying load. Mode cannot authorize a view-time setter; prohibited batches
produce execution issues/warnings and no partial record or alert updates. Read-only timestamps
remain unchanged. Current unsaved values after persistence failure are preserved when returning to
View. The verification document above records the new automated results and archives.

The retained device dependency tree is refreshed from those exact archives without reinstalling
Expo or changing SDK pins. Reload the app in the existing Metro session before resetting fixtures.
If Metro still serves the previous package bytes, restart it with the same startup command above;
its start script clears Metro's cache. Do not rerun the harness generator or reinstall dependencies.

## Pixel 8a performance follow-up

24 October update: the maintainer's baseline profile confirms Expo Go 58.0.5, Android API 37,
RN 0.88.0, Hermes and development mode. In the warm managed run, 19.7 of 28.1 seconds is explicit
yield waiting; 8.4 seconds is outside yields. Core now reuses argument-layout preparation and
Native uses the host idle-task queue while retaining the 8 ms budget and cancellation. Updated
desktop measurements and full automated verification are in the investigation document above.
The subsequent Pixel profile verifies the 200-row core improvement: warm managed preparation is
1,010.3 ms (previously 28,102.4), with 64.8 ms yield waiting and 945.6 ms outside yields.
Full-renderer large-form responsiveness remains to be checked.

Review actions now use the header's themed buttons; child Edit uses the same Pencil icon as root.
The installed candidate is recorded in `logs/android-profile-candidate.json` in the active harness.
Walkthroughs 1 and 2 retain their accepted behavioral evidence; confirm the cosmetic adjustment when
convenient. Performance remains open, so another long 2,000-row run is not requested yet.

1. Reload the existing Metro app. If **Profile preparation (200)** is absent, restart Metro with the
   existing startup command above. Do not regenerate or reinstall the harness.
2. Tap **Nested editing** to release the previous large fixture/preparation.
3. Leave SAFE off to match the original measurement and keep DevTools closed.
4. Tap **Profile preparation (200)**. This uses a separate synthetic record and does not save or
   change the displayed form. It runs cold/warm preparations with managed validation off and on.
5. Check that the result includes `revision: "native-idle-layout-cache"` and
   `scheduler: "idle-callback"`; otherwise restart Metro with its existing clear-cache command.
6. Copy the selectable JSON in the status area; it is scrollable. Share it with the displayed
   runtime details and Expo Go client/build version. It is also logged under
   `[form0 acceptance] Preparation profile` if console forwarding is available.

`computeMs` excludes the measured `yieldWaitMs`; their sum is `elapsedMs` apart from rounding.
`factoryMs` is reported separately, outside those preparation times. A high timer-wait share
identifies scheduling overhead; a high compute share calls for a synchronous-work profile. The
comparison with/without managed validation identifies the cost of participating closed-row handlers.
Cold/warm differences identify cached setup. These are diagnostic comparisons, not release-build
or full-controller performance acceptance. Cancel preparation also cancels this diagnostic.
The updated diagnostic uses the renderer's actual scheduler for all four preparations; its separate
twenty-timer calibration still measures the legacy fallback. Current archives and hashes are in
`logs/android-performance-candidates.json`; prior candidates and results are preserved.

## Full-renderer retest received — 24 October

The profile above has passed on the physical Pixel with the expected revision/scheduler. Keep its
result as evidence; it does not need another diagnostic rerun. The same installed runtime archives
are current. Additional live-edit regression tests changed no runtime bytes: repeated/rapid root
and row edits update calculations, View preserves accepted values, and child Save updates the root
aggregate. React main-thread/actual-worker and Native adapter checks pass in TRUSTED and SAFE.

The maintainer reports **Programmatic prepare** completing with eligibility and no issues:

| Total rows | Elapsed (ms) | Maximum observed JS gap (ms) |
| --- | --- | --- |
| 200 | 1,516 | 182 |
| 2,000 | 11,213 | 949 |

Cancellation passes. These checks exercise editor settling, selection, signatures and serialization
as well as core work. No warm-up classification was supplied. Keep walkthroughs 1 and 2 and all
functional checks accepted; performance remains open because the large case still stalls JS for
nearly a second. Next profile the full controller's phases before requesting another device run.
Core `maxWorkSliceMs` is not the full renderer's observed JS gap. No additional manual live-edit,
schema-reload or general acceptance rerun is requested now.

Schema replacement is additionally verified automatically under TRUSTED/SAFE: edited and newly
added calculations, a changed collection target and new event code replace prior preparation and
handlers. The complete Native adapter suite passes 33 cases. Actual browser main-thread/worker and
CLI file-watcher checks are recorded in the core investigation. These are tests only; current
device archives and installed runtime source remain unchanged.


## Current focused timing check — owned-tree signatures, 24 October

The prior `native-responsive-serialization` phone result is recorded above. Cancellation was
separately confirmed as prompt/cancelled, preserving that acceptance and walkthroughs 1/2.
A measured repeated full-tree signature cost has since been removed from renderer bookkeeping:
accepted collection trees are immutable/replaced on edits, while mutable input values, metadata
and host policy are still checked afresh. No calculation results are cached. Generic adapters still
detect in-place child mutations. Selected-state application avoids a redundant root calculation.

Full automated checks pass: 35 Native adapter cases, 69 Node tests, React 100 tests, actual browser
main/worker submission/view/live edits/schema reload, CLI persistence/reload, Builder integration,
core release checks and localized docs gates. CPU-throttled production Native-adapter warmed gaps
are 107–144 ms, with individual synchronous tasks <=72 ms; this is not a Hermes result.

The new independent device candidate is in `responsiveness-owned-tree/`; exact SHA-256, sizes,
SDK versions and installed parity are in `logs/responsiveness-owned-tree-device-candidates.json`.
Previous physical-test archives in `responsiveness/` are preserved. No dependency reinstall or
SDK change occurred. Keep both candidate manifests with the physical reports.

1. Restart the existing Metro process using the usual clear-cache start command, then reload Expo Go.
2. Keep SAFE off and DevTools closed, matching the previous runs.
3. Tap **Large 2,000** to start a fresh fixture.
4. Tap **Programmatic prepare** once and wait for the result.
5. Confirm `revision: "native-owned-tree-signatures"`, then share the displayed JSON and whether
   the remaining pause is noticeable. If the revision is old, refresh the existing Metro app rather
   than reinstalling dependencies.

Do not repeat walkthroughs 1/2, the Profile preparation diagnostic or cancellation solely for this
check. Earlier prompt cancellation remains accepted. No cold/warm classification is assumed for
this single physical sample. Performance and Plan 3 sign-off remain open pending this result;
iOS acceptance, production Reform adoption and dependency-exception remediation stay separate.
