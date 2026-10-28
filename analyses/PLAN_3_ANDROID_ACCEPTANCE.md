# Plan 3 Android acceptance

Accepted-snapshot viewing, load permissions and event.mode are implemented; automated evidence
and exact candidate hashes are in `form0-core/analyses/ACCEPTED_VIEW_VERIFICATION.md`.
Walkthroughs 1/2 and prompt large-form cancellation pass on the Pixel 8a / Android API 37,
Expo Go 58.0.5 / Hermes, SAFE off and DevTools closed. The latest physical 2,000-row result is
8,454 ms in production mode, observed JS gap 323 ms, completed/eligible/no issues (26 October).
The preceding development sample was 9,933 ms/gap 293 ms; these are individual observations, not
controlled repeated measurements. The latest 200-row production sample is 1,333 ms/gap 90 ms;
the preceding production controls were 1,373/9,897 ms with gaps 96/336 ms.
Full automated checks pass. Measured controller revision:
**`native-literal-registration`**. The maintainer selected ending this tuning pass and proceeding
to final review with residual latency documented. No further Android run is requested for this checkpoint.
Use the latest section below; earlier instructions and candidate
sections are historical and should not be repeated to resume acceptance.

The existing independent SDK 58 harness contains the new packed core with exact source-byte parity.
There is no dependency reinstall or SDK change. Real desktop Chromium tests cover main-thread and
actual-worker execution, but neither those nor the Native adapter establish physical Hermes timing.
iOS remains deferred. Current evidence: `form0-core/analyses/ANDROID_PREPARATION_INVESTIGATION.md`.

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


## Current focused comparison — throughput bindings, 24 October

The owned-tree candidate completed on the Pixel in 12,400 ms with a 294 ms observed gap, eligible
and without issues. The next candidate reduces repeated bindings for proven primitive expressions
and redundant copies of fresh private event contexts. It caches metadata only. Current values,
calculation order, EVAL/dynamic fallback, security checks, handler registrations and row validation
frequency remain preserved by regression tests. No renderer runtime source changed in this pass.

The paired complete managed core workload improves 27%. Actual desktop Chromium 2,000-row controller
samples are 1.11–1.13 s main-thread / 1.05 s actual worker. The production Native HTML adapter also
improves throughput; its final warmed maximum host task is 66 ms. These are not Hermes predictions.
Full core/React/Native/CLI/browser/Builder/type/localization checks pass. The investigated earlier
worker transition exists in the baseline too; the driver now awaits both calculation and edit-event
completion while retaining final-value assertions. No lifecycle runtime behavior was changed.

The final manifests are `logs/throughput-candidates.json` and `throughput-device-candidates.json` in
the retained active harness. New core hash:
`d2eec93bf76e746825c06448af1f274fdb3ab73670f1ac954d99227d642cd651`.
React/Native source archive bytes remain unchanged; the fixture App revision is updated. SDK versions
remain Expo 58.0.17 / RN 0.88.0 / React 19.3.0. Previous candidate archives and all physical reports
remain preserved. No new dependency tree or folder cleanup is needed for this comparison.

1. Restart Metro using the usual cache-clearing command, then reload Expo Go.
2. Keep SAFE off and DevTools closed, matching the prior runs.
3. Tap **Large 2,000** and let its initial rendering settle.
4. Tap **Programmatic prepare** once and wait for the result.
5. Confirm `revision: "native-throughput-bindings"`; share the displayed JSON and whether the
   remaining pause is noticeable. If the revision is older, reload the existing Metro app after
   its restart; do not reinstall dependencies.

Do not repeat walkthroughs 1/2, the core-only Profile diagnostic or cancellation solely for this
checkpoint. Their physical acceptance is preserved. Stop further optimization edits until this
comparison: the next decision depends on an actual phone gain, its remaining cost and behavioral
risk. Approximately 20% repeatable improvement was the automated checkpoint criterion; it is not
an Android SLA or permission to finalize Plan 3 without its remaining performance decision.

Core implementation: `ea9adf0`; Native fixture revision: `15ac0a1`, both on existing development branches.

## Focused comparison received — 26 October 2026

The maintainer reports `native-throughput-bindings`: completed, eligible, 9,933 ms elapsed,
293 ms maximum observed JS gap, no issues, for Large 2,000 on the Pixel 8a. The previous sample
was 12,400 ms/gap 294 ms. The observed elapsed reduction is 2,467 ms (approximately 19.9%);
the longest observed gap is essentially unchanged. Warm-up was not specified and no repeat set
was supplied. This is a physical observation rather than a controlled phone benchmark.

The focused comparison above is now complete; do not repeat it automatically. Walkthroughs 1/2
and the prior prompt cancellation result retain acceptance. Raw transcription and normalized
observations live in active-harness `logs/android-pixel8a-throughput-bindings.json`.
Recommendation: stop this contained optimization pass with the remaining approximately ten-second
large-record preparation latency explicit. Plan 3 performance acceptance remains a separate
decision. No runtime/candidate/dependency changes or new device instructions accompany this update.

The core optimization is conservative: new builtin calls, helpers, EVAL and complex JavaScript
retain the original full-context execution path. It caches binding metadata, not results. Adding
a builtin needs normal catalog/runtime/security support and tests; it does not need optimizer
changes unless deliberately extending optimized coverage or changing existing specialized semantics.

## Production-mode investigation — 26 October 2026

The maintainer authorized a bounded investigation before accepting the remaining latency, with
calculation/event/form logic preserved and optimization benefit weighed against maintenance cost.
The current binding optimization stays unchanged. This step changes the device measurement fixture
and adds a separate diagnostic source copy; no shipped core or binding runtime is modified.

The generator `scripts/prepare-device-phase-profile.mjs` prepares that copy from the installed
packed core, failing explicitly if its source anchors have changed. It copies source only, with no
dependency installation, and registers an on-demand loader in the device entrypoint. The copy is
marked DIAGNOSTIC ONLY. Normal controller measurements use the unchanged installed packages. The
profile button loads the copy afterward for one separate warmed phase probe. Its source SHA-256 is
`5b3147e4f1efb1c77fed277e69614a6dcd7d5255fc926943d65a2c708babcfc4`.

The independent harness is ready. Do not regenerate/install it to run the following checks. If
rebuilding harness source later, run the normal source generator and then this phase generator.
The procedure follows [Expo production-mode guidance](https://docs.expo.dev/workflow/development-mode/).
Production JavaScript in Expo Go is an initial comparison, not actual release-build acceptance.

1. In the existing device harness terminal, stop the current Metro process if it is running.
2. Start it with `npm start -- --no-dev --minify --max-workers 2`. Preserve the usual connection
   option if needed, for example append `--tunnel ngrok` when using the installed legacy provider.
3. Close and reopen the app in Expo Go. Keep SAFE off and DevTools closed.
4. Check the header says **JS development mode: false**. If it says true, stop here and correct
   the launch/reload; a development run is not the requested baseline.
5. Tap **Large 200** and let loading settle.
6. Tap **Programmatic prepare** once. Copy its on-screen JSON. Expect revision
   `native-production-baseline`, fixture `large200`, `dev: false`, `hermes: true`, completed/eligible
   and no issues. This action does not persist the prepared record.
7. Tap **Large 2,000** and let loading settle. This resets to a fresh accepted fixture.
8. Tap **Programmatic prepare** once. Copy its on-screen JSON with fixture `large2000` and the
   same revision/environment flags. Do not repeat preparation on this already-refreshed tree for
   comparison: the first preparation applies values locally and later reports can be smaller.
9. Tap **Profile preparation (200)** once. Copy the on-screen report. It uses an independent
   200-row captured input, without editing or persisting the displayed record. Cancellation remains
   available. Expect eight uninstrumented samples: one cold and three warm with managed events off,
   then the same with managed events on. A separate `phaseProbe` reports one warmed instrumented
   run; `diagnosticSourceHash` must match the value above.

Share those three JSONs. Console forwarding to the Expo terminal is disabled in production mode;
use the selectable on-screen report. Walkthroughs 1/2 and the previous cancellation acceptance do
not need repeating. Do not request another 2,000-row diagnostic loop at this stage.

Core samples always evaluate the same accepted input. They report scheduling wait separately;
"Cold" and "warm" describe evaluator-local caches, not a restarted Hermes VM.
`computeMs`/phase `activeMs` are elapsed time less explicit host waits, not a CPU-profiler measurement.
`managedValidation` includes its context/registration and dispatch subphases: do not add nested
durations together. Probe timing includes instrumentation overhead and is never pooled with the
baseline samples. The physical reports remain pending; no speedup or Plan 3 sign-off is claimed.

Automated evidence: 77 Native Node tests; identical complete results and immutable inputs for
200/2,000 rows, TRUSTED/SAFE, managed on/off; scope-level validation failures and pre-cancellation
equivalence; production Android bundle with `__DEV__=false` verified. The bundle is 3,584,406 bytes,
SHA-256 `1705f0cc87cc3167742fa88642eef1c2f4b465eba7c884ec4ae5410561238ce1`.
This is bundle verification, not physical Hermes performance. No new package archive or release.

## Tunnel URL follow-up — 26 October 2026

The first physical production-mode launch hit `TypeError: Invalid URL` in installed Metro
`Server._processRequest`, before the form measurement code ran. The actual phone request headers
were not captured. The same stack and HTTP 500 were reproduced locally by passing comma-separated
forwarded protocols/hosts to that installed server. This is a likely explanation, not a confirmed
capture of the phone's proxy chain. The optional Expo update notice is not evidence of its cause.

The device harness now has a small Metro middleware using Expo's default configuration. Only when
the existing origin is invalid and forwarded headers contain a valid HTTP(S) proxy chain does it
normalize to the first forwarded host/protocol. Ordinary/direct/single-origin requests are unchanged;
other invalid origin values are left untouched. No node_modules, SDK versions or form runtime code
were edited. The source generator includes this harness-only configuration for reproducibility.

Real HTTP checks against installed Metro show all three host/protocol chain variants return 200,
with identical production bundle bytes to the single-origin control. `__DEV__=false` is verified.
The independent Native Node suite now has 82 passing tests, including five request-origin cases.
Report: active-harness `logs/production-metro-header-conformance.json`; server logs preserve the
original failure and corrected requests. The local diagnostic server was stopped after verification.

Restart the usual Metro command from the production-mode steps, then reopen Expo Go. No installation
or command change is needed. If it still fails, share the `[form0 device Metro]` JSON line; it exposes
only token counts/status, never URLs, query strings, header values, cookies or authorization. A
`normalized-forwarded-chain` line confirms this guard ran. Actual tunnel recovery and physical
performance results remain pending; do not infer recovery solely from the local synthetic tests.

## Production measurements received; profiler loader corrected — 26 October 2026

The Pixel now opens the production-mode fixture. The maintainer reports the following with
`dev: false`, `hermes: true`, SAFE off, completed/eligible and no issues:

| Fixture | Elapsed | Maximum observed JS gap |
| --- | --- | --- |
| Large 200 | 1,373 ms | 96 ms |
| Large 2,000 | 9,897 ms | 336 ms |

The maintainer corrected an initial 19,897 ms transcription to **9,897 ms**. Use the corrected value
only. Warm-up/repeat classification was not supplied. The large sample is essentially unchanged
from the earlier individual 9,933 ms development sample; no production-mode speedup is established.
The form remains responsive according to the maintainer. Startup recovery is confirmed, although
the original tunnel header values were not captured. Raw report: active-harness
`logs/android-pixel8a-production-baseline.json`. Do not repeat these controller checks now.

The profile button hit Expo's production chunk URL error because the diagnostic loader used dynamic
`import()` and the native context has no `location`. The previous static export omitted the Expo Go
`lazy=true` request seam, so it did not detect this failure. An actual Metro Android production graph
with `lazy=true`, evaluated without `location`, reproduces the exact SDK error before the fix.

The generator now uses a statically resolved `require()` inside the profile loader. Metro bundles
the diagnostic module while keeping its initialization deferred until Profile is pressed. No global
`location` shim, chunk-host URL, SDK/dependency change or product runtime change was introduced.
The diagnostic evaluator source hash stays unchanged. The same compiled production-graph check now
passes with no network chunk loads and identical complete 200-row TRUSTED/SAFE results and immutable
inputs. This is a loader regression check in a JS VM, not actual Hermes performance acceptance.
The independent Native suite passes 83 tests. Original unsplit-control and stale CI-server probes
are retained and distinguished from the decisive `lazy=true` red/green reports.

1. Stop and restart Metro using the same production command from the earlier steps.
2. Close and reopen Expo Go. Confirm **JS development mode: false** and keep SAFE off/DevTools closed.
3. Leave the default **Nested editing** fixture selected and tap **Profile preparation (200)** once.
   The profile creates its own input. No fresh Large 2,000 run is needed.
4. Copy the on-screen JSON. Expect `revision: "native-production-phases-bundled"`,
   `diagnosticLoading: "bundled-require"`, `dev: false`, `hermes: true`, the same diagnostic source
   hash, eight control samples and a separate `phaseProbe`.

That is the only remaining requested measurement at this checkpoint. Phase interpretation and any
further runtime optimization remain pending; current calculations/events/form logic are unchanged.
Evidence: active-harness `phase-loader-production.mjs`, `logs/phase-loader-before-lazy.json`,
`phase-loader-after-bundled-restarted.json` and `phase-loader-native-tests-final.log`.

## Profiler retry build marker — phase-profile-v3

The maintainer still reports the same URL message after restarting Metro and closing/reopening
Expo Go. Do not infer handset recovery from the compiled-graph checks. The running maintainer Metro
on port 8081 serves the corrected bundled loader and updated App code. Its actual main index graph
also passes the no-location, zero-network-load regression and TRUSTED/SAFE 200-row result parity.
The previously displayed fixture had no visible bootstrap version, so the handset's loaded build
remains unknown. Stale client code is a hypothesis, not a confirmed diagnosis.

The fixture now visibly displays **Harness build: phase-profile-v3 · Bootstrap: phase-profile-v3**
and a **Profile phases v3 (200)** button. A shared build token rejects stale/missing bootstraps before
calling their loader. If a current-build attempt fails, it returns JSON with revision, stage,
bootstrap/loading metadata and URL-redacted stack frames. This separates checking-bootstrap,
loading-bundled-evaluator and evaluating-profile failures. No runtime calculation/event changes.

1. Force stop Expo Go using Android **Settings → Apps → Expo Go → Force stop**.
2. Reopen Expo Go and scan the QR currently displayed by Metro, rather than opening a recent project.
   The running server already serves v3; another Metro restart is not required for this checkpoint.
3. Check both visible build markers equal **phase-profile-v3**. If either differs, stop and report
   the header; do not rerun timings.
4. With dev:false, SAFE off and the default Nested editing fixture selected, tap **Profile phases
   v3 (200)** once and copy the on-screen JSON, including any error stage.

The Large 200 and Large 2,000 controller results remain accepted observations. No rerun is requested.
Independent tests: 84 Node tests pass, including early rejection of stale loaders. Live main-graph
evidence: `logs/phase-loader-maintainer-index-graph.json` and
`phase-loader-maintainer-index-graph-v3.json` (both not Hermes). Source markers were verified in the
running server's bundle. Physical v3 markers and phase results remain pending.

The maintainer subsequently reports that the header is not visible. A read-only check of both the
local launch-asset response and its advertised public tunnel returns HTTP 200 with the v3 header,
button and stale-bootstrap guard. Neither response contains the old dynamic-import descriptor.
This narrows server delivery, but does not identify the handset's loaded code or establish a cache
cause. Evidence: `logs/phase-loader-local-tunnel-parity.json`; only origin hashes and marker booleans
are retained, without tunnel URLs. The next observation is the actual profiler button label near
Programmatic prepare: **Profile preparation (200)**, **Profile phases v3 (200)**, or neither. Do not
request another timing run or clear application data before establishing that observation.

### Versioned launch after the old button was confirmed

The maintainer confirms **Profile preparation (200)** is still displayed. The phone therefore has
older UI than the server responses inspected above. Pressing `r` reports **No apps connected**;
it cannot reload this session and does not establish cache versus launch/connection causality.

The diagnostic generator now writes `phase-profile-v3.js`, which imports the existing `index.js`,
and sets only the ignored device package's `main` to that entry. The live manifest now points to
**/phase-profile-v3.bundle** instead of /index.bundle. The Expo slug, app identity, fixture storage,
installed dependencies, evaluator and runtime remain unchanged. The running server picks up the
new entry without a restart. This distinguishes the requested launch asset; handset recovery is
still unverified.

The manifest-path assertion fails before the entry change and passes after it. Local and public
tunnel requests both return HTTP 200 with the v3 header/button/guard. The versioned entry's actual
production lazy graph also passes with zero chunk loads and complete immutable TRUSTED/SAFE
200-row parity. Native tests: 84 pass. Reports: `logs/phase-launch-before.json`,
`phase-launch-after.json`, `phase-loader-versioned-launch.json`, `phase-launch-native-tests.log`.
These are server/JS-VM checks, not Hermes timing.

Next physical action: return to **Expo Go's home screen**, then scan the current Metro QR. Confirm
**Profile phases v3 (200)**; with dev:false and SAFE off, run only that profile and share JSON.
If the old button remains, stop and report it. No Metro restart, data clearing or Large 200/2,000
rerun is requested. The previous force-stop/reload steps are historical and need not be repeated.

## Current retry — SDK 58 production launch-asset cache

The maintainer transcribed the old controls after a fresh launch, including **Profile preparation
(200)**, with dev:false and no v3 marker. The correct project and exact tunnel both serve current
source, so a successful HTTP source check is insufficient to establish handset execution.

The SDK 58 sources expose a concrete production-only collision:

- The installed Expo CLI emits a fixed `launchAsset.key` of `bundle`, even after its URL changes.
- Android `ExpoUpdatesUpdate` carries that key into `AssetEntity`; `Loader.downloadAllAssets`
  looks it up by key, merges a changed URL and reuses the existing local file when present.
- `AssetDao.mergeAndUpdateAsset` updates the URL without clearing the existing relative path.
  The production launcher executes that file. Development mode skips this asset download/cache.

Sources: [SDK 58 loader](https://github.com/expo/expo/blob/sdk-58/packages/expo-updates/android/src/main/java/expo/modules/updates/loader/Loader.kt),
[asset merge](https://github.com/expo/expo/blob/sdk-58/packages/expo-updates/android/src/main/java/expo/modules/updates/db/dao/AssetDao.kt),
and [Expo Go launcher](https://github.com/expo/expo/blob/sdk-58/apps/expo-go/android/expoview/src/main/java/host/exp/exponent/ExpoUpdatesAppLoader.kt).
This explains why changing only the filename was insufficient in the cache model. Physical cause
confirmation is still pending; the model is not Android execution. The installed Windows ADB
device-list command succeeds outside WSL sandboxing but reports no connected device. No device
configuration or app storage was changed through ADB.

The diagnostic generator now installs `production-cli.cjs` and changes only the ignored device
package's start command to use it. The wrapper compiles the installed CLI manifest module in memory
with one fresh launch-asset key per server session, before Expo serializes and signs the manifest.
It writes no SDK source files, changes no dependency/version and clears no application data. Its
single source anchor is checked and SDK drift fails explicitly. This is private harness compatibility
code, excluded from published package contents, not an application or form-runtime API.

Verification: real SDK JSON and native multipart responses carry the fresh stable session key.
A source-guided Android cache model selects the old UI before this change and the current UI
afterwards. The before assertion fails and the after assertion passes; 86 independent Native Node
tests pass, including signing order and source-drift guards. Existing candidate/evaluator bytes are
unchanged. Reports: `logs/production-asset-cache-before.json`,
`production-asset-cache-after.json`, `production-asset-key-native-tests.log`; the probe is
`production-asset-cache-probe.mjs`. The agent's localhost test server on 8108 was stopped; the
maintainer's Metro on 8081 was left running.

1. Stop the existing maintainer Metro with Ctrl+C.
2. In the existing device folder run `npm start -- --tunnel ngrok --no-dev --minify --max-workers 2`.
3. Confirm startup prints `production-launch-asset-key` and `session-key-enabled`.
4. Force stop Expo Go, reopen it and scan the current QR.
5. Confirm both v3 markers and **Profile phases v3 (200)**. With dev:false and SAFE off, tap that
   button once and share the JSON. If the old UI persists, stop and report it.

No reinstall, data clearing, SDK upgrade or 200/2,000-row controller rerun is requested. Retain all
prior functional/cancellation acceptance and corrected controller measurements. Actual phase timings,
the physical cache-workaround result and Plan 3 performance acceptance remain pending.

## Physical profiler recovery and phase report — 26 October

The maintainer confirms the session-key launcher works and the current **Profile phases v3 (200)**
report runs successfully. It confirms dev:false, Hermes, SAFE off, idle-callback, bundled-require,
the current source SHA and both v3 markers. The loader/cache retry above is accepted and must not be
repeated. Raw report: `logs/android-pixel8a-production-phases-v3.json`; summary:
`android-pixel8a-production-phases-v3-summary.json`.

Three warm core controls have elapsed medians 520.4 ms without managed events and 844.0 ms with
them. A separate instrumented warm probe is 828.2 ms, including 35.1 ms explicit scheduler waits.
Of its 793.1 ms active wall time, managed validation is 367.8 ms (46.4%), including registration
context setup 231.4 ms (29.2%) and dispatch 133.1 ms (16.8%). Calculations use 239.7 ms (30.2%),
public result copy/freshness 67.3 ms (8.5%). Do not add nested phases twice, treat active wall time as
CPU sampling or combine this core probe with the prior 1,373/9,897 ms full controller timings.

Two allocation/layout prototypes show only small large-fixture gains and small-fixture regressions,
so they are discarded. A literal-handler-registration prototype is being measured next. No new
phone checks are requested until a candidate meets the benefit/behavior gates. Existing functional,
cancellation and controller acceptance remain retained. Performance completion is still open.

## Literal registration candidate — next focused Pixel check

The physical phase report identified unnecessary schema-wide default bindings during literal
handler registration. The candidate avoids that setup only for complete scripts of canonical
`ON('event', function (...) { ... })` calls. Every handler still runs with fresh current permitted
values and the existing execution/security policy. Conditional/dynamic initialization or custom
`ON` keeps the old complete path; handler bodies and future builtins need no optimizer adaptation.
Calculation execution and live updates are unchanged.

Paired Node complete results remain identical with 23.6–29.7% less large-fixture active work.
Core release checks, React 100 / Native 86 / CLI 168 tests and actual browser/worker/CLI checks pass.
Production desktop reference targets pass; a rebuilt Native HTML adapter also passes responsiveness
checks. These results do not predict the Pixel's elapsed time or establish Hermes acceptance.
Candidate provenance and exact reports are in the core investigation and
`logs/literal-registration-device-provenance.json` in the active harness.

The existing device dependency tree is reused; only the packed core and small test sources change.
SDK/Expo/RN pins, app/database identity, saved fixtures and accepted walkthroughs 1/2 remain intact.
The session asset-key launcher remains required for fresh production source delivery.

1. Stop your Metro with Ctrl+C.
2. From `.local-test-harnesses/form0-plan3-20261022/device`, run the same command:
   `npm start -- --tunnel ngrok --no-dev --minify --max-workers 2`.
3. Confirm startup reports `production-launch-asset-key` / `session-key-enabled`.
4. Force stop Expo Go, reopen it and scan the current QR.
5. Confirm **Preparation candidate: native-literal-registration**, development mode **false**,
   Hermes **true**, SAFE **off** and DevTools closed. Stop on a different candidate marker.
6. Tap **Large 200**, then **Programmatic prepare** once. Copy its complete result JSON.
7. Tap **Large 2,000**, then **Programmatic prepare** once. Copy its complete result JSON.
8. Tap **Large 2,000** again to reset, start **Programmatic prepare**, then tap **Cancel preparation**.
   Report whether it responds promptly and returns cancelled.

Both completed reports must identify `revision: "native-literal-registration"` and their fixture.
Do not repeat walkthroughs 1/2 or the phase profile now. Compare these fresh controller workloads
with the retained production 1,373/9,897 ms observations; neither is a warmed core benchmark.
Stop additional optimization work at this candidate until these physical observations arrive.

## Physical candidate result received — 26 October

The maintainer confirms these exact controller results with dev:false, Hermes:true and SAFE:false:

| Fixture | Elapsed ms | Maximum observed JS gap ms | Result |
| --- | ---: | ---: | --- |
| Large 200 | 1,333 | 90 | completed, eligible, no issues |
| Large 2,000 | 8,454 | 323 | completed, eligible, no issues |

Cancellation during a fresh large preparation is prompt and returns cancelled. Walkthroughs 1/2
remain accepted. The focused procedure above is completed; do not repeat it or the profiler now.
Raw reports: `logs/android-pixel8a-literal-registration.json` and its `-summary.json` companion in
the active harness. No runtime or harness change was made after these results.

The 2,000-row elapsed observation is 1,443 ms (14.6%) below the preceding 9,897 ms production result;
the small fixture is 40 ms (2.9%) lower. These single fresh observations support the measured bounded
optimization but are not warmed medians or a general speedup guarantee. Large-record latency and
the remaining 323 ms observed gap are still limitations. This full preparation includes all refreshed
calculations, validation, selected state application and serialization; ordinary editor updates use
scoped evaluation. Persistence is outside the measured interval.

Recommendation: retain this candidate, stop adding optimizations in this pass and review final Plan 3
acceptance with these limits documented. Desktop reference targets pass; physical two-second
performance is not claimed. Maintainer acceptance of the residual latency remains pending. No further
device test, SDK upgrade, release or issue closure is requested by these results. iOS stays deferred.

The maintainer subsequently selected proceeding to final review. Retain these measurements and
functional/cancellation acceptance without another tuning iteration. See
`form0-core/analyses/PLAN_3_FINAL_REVIEW.md` for the review outcome and separate release prerequisites;
its CLI-only identity correction changes no Android runtime or accepted candidate bytes.
