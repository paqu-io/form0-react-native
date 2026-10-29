# Issue 101 Pixel / Hermes acceptance

The issue-101 candidate adds supported setters and shared choice normalization. Android bytecode
export passed. On 29 October 2026, the user confirmed that choices/setters, nested choice editing and
Save/Cancel, and all other walkthrough checks pass on the phone after the Metro runtime correction.
This is user-reported physical acceptance, separate from automated bundle/hook evidence. The user
also confirmed the same Pixel device/runtime/mode settings as historical acceptance. iOS remains deferred.

The isolated runnable directory is
`../.local-test-harnesses/form0-issue101-20261028/device/` from the Native repository. It redirects
`form0-core` and `form0-react-native` to the issue-101 source copies, reuses the installed SDK 58
node_modules, and copies the retained production launcher unchanged. Do not install into its
node_modules symlink. The older Plan 3 device directory and measurements remain historical evidence.

The in-app phase-profiler button is omitted in this candidate: its old instrumented baseline must
not be confused with current-source measurements. **Programmatic prepare** measures the actual
candidate. The copied bootstrap text is historical and is not a new phase-profile result.

## Start and identify the candidate

1. Open a terminal in the isolated `device/` directory.
2. Select Node with `nvm use 24.22.1`.
3. Run `EXPO_NO_TELEMETRY=1 node production-cli.cjs start --go --no-dev --minify --max-workers 2`.
4. Force stop Expo Go on the Pixel to retire its previous asset cache.
5. Open the new QR code with the SDK 58 Expo Go client using the existing working LAN/tunnel setup.
6. Check the header: **Preparation candidate: issue101-candidate** must appear.
7. Check **JS development mode: false** and **Hermes true**.
8. Record the device model, Android API, Expo Go version, React Native version and candidate hashes
   from the task's `artifact-inventory.json`.

If the candidate label is wrong, stop here and reopen the current QR after force stopping Expo Go.
Do not replace the fresh-asset-key production launcher with plain `expo start`. Keep DevTools closed
for preparation timing. If LAN connectivity fails, reuse the previously working tunnel configuration;
credentials stay local. The initial 28 October bundle verification did not claim phone acceptance;
see the separate 29 October user-reported results below.

## Choices and supported setters

1. Tap **Choices / setters**. Expect width 3, height 10, area 30 and country Italy.
2. Tap **Set choice batch**. Expect width 4, height 5, area 20, country France, countries France/Italy
   and answer No; country_label must read France.
3. Tap **Invalid mixed batch**. Expect a TypeError status; width remains 4 and area remains 20.
4. Tap **Write calculated area**. Expect a TypeError; area remains 20.
5. Tap **Choices / setters** to reset this fixture.
6. Change the **width** input to 4. Expect area 40; its explicit change handler selects France and
   France/Italy. Programmatic setters themselves do not generate this change event.
7. Open the **country** selector.
8. Select **Other**. Expect a visible **Please specify...** input even before text is entered.
9. Enter `Teal` in that input.
10. Clear its text. Expect Other to remain selected with its empty input visible.
11. Enter `Turquoise`.
12. Open **countries** and select **Other**.
13. Enter `Teal` in the MultiChoice Other input.
14. Clear that text. Expect its input to stay visible.
15. Tap **Choices / setters** to reset before checking readonly mode.
16. Tap **Enter record View**. Expect the accepted values and area 30 to remain visible.
17. Tap **Set choice batch**. Expect a readonly TypeError and unchanged values.
18. Tap **Leave record View**. Expect editing to resume.
19. Tap **Set choice batch**. Expect the successful values from step 2.

## Nested choice editing and cancel/save

1. Tap **Choices / setters** to reset.
2. Open the **rows** list with its **View** control.
3. Tap **View** beside its first row. Expect quantity 2, row_country Italy and accepted row_total 6.
4. Tap **Edit**.
5. Change **quantity** to 4. Expect row_total 12 and row_country France through the row change handler.
6. Tap **Cancel**.
7. Confirm **Discard** if prompted.
8. Open that row again. Expect accepted quantity 2, Italy and row_total 6.
9. Tap **Edit**.
10. Change quantity to 4.
11. Tap **Save**. Expect the accepted row now to contain quantity 4, France and row_total 12.
12. Use **Back** to return to the root.
13. Submit the root. Expect persistence success only after SQLite accepts the envelope.
14. Tap **Reopen saved**. Expect the same row ID zero, choice selections and accepted calculations.

Reset with **Choices / setters** before starting another independent scenario. The independent
harness uses `form0-issue101-acceptance.db` / `issue101_freshness`; neither prior Plan 3 acceptance envelopes nor production app storage are overwritten.

## Plan 3 confirmation, persistence and preparation

Run the one-action steps under walkthroughs 1 and 2 in
[Plan 3 Android acceptance](PLAN_3_ANDROID_ACCEPTANCE.md#walkthrough-1--nested-editing-and-accepted-savecancel-isolation)
against this candidate: **Nested editing** must preserve root 130 after cancel and accept 135 after
saving surcharge 5. **Confirmation / persistence** starts at root 330 with child totals 110/220;
retaining must persist pending freshness, reopening must restore it, failed persistence must remain
unsaved, and retrying an all-child refresh must persist root 360 with current freshness. Record the
results as new issue-101 observations rather than modifying the old acceptance entries.

1. Tap **Large 200** to reset the large fixture.
2. Wait for initial rendering to settle.
3. Tap **Programmatic prepare**. Expect eligible completion with no persistence acknowledgement.
4. Record elapsed time and maximum observed JS gap from the status text.
5. Tap **Programmatic prepare** again for a warm sample.
6. Record that sample separately.
7. Tap **Large 2,000**.
8. Wait for initial rendering to settle.
9. Tap **Programmatic prepare**.
10. Tap **Cancel preparation** while preparation is running. Expect cancelled status and usable UI.
11. Tap **Programmatic prepare** again without cancellation.
12. Record completion time and maximum gap; preparation alone must not save.
13. Tap **Programmatic prepare** to start a further preparation cycle.
14. Tap **Cancel preparation** to check repeat cancellation.
15. Enable **SAFE**.
16. Repeat the choice, nested editing and readonly scenarios after resetting their fixtures.

Historical accepted Pixel results are **1,333 ms / 8,454 ms**, with **90 / 323 ms** maximum JS gaps
for 200 / 2,000 rows, production Hermes and SAFE off. They are not fresh candidate measurements.
The Node reference targets are not phone acceptance thresholds. Report visible stalls, incorrect
values, stale responses and unperformed steps explicitly. This guide does not remove deferred iOS
acceptance or require another evaluator/performance redesign.

## WSL tunnel and startup troubleshooting

The retained SDK 58 CLI accepts an explicit legacy tunnel provider:

```sh
EXPO_NO_TELEMETRY=1 node production-cli.cjs start --tunnel ngrok --go --no-dev --minify --max-workers 2
```

Keep that option when LAN/QR access from WSL2 fails. A
`metro-forwarded-origin` report with `status: normalized-forwarded-chain` means the harness
normalized proxy headers; it is not itself a download error. `Android Bundled` confirms compilation,
not phone execution. Continue acceptance only after the candidate header and fixture buttons appear.

For an app stuck on its loading screen, stop Metro and temporarily expose startup errors with:

```sh
EXPO_NO_TELEMETRY=1 node production-cli.cjs start --tunnel ngrok --go --max-workers 2
```

Force stop Expo Go and open the new QR. Return to `--no-dev --minify` for acceptance and timing.

On 29 October, this exposed an invalid-hook-call error in the issue-101 overlay. The app resolved
React 19.3.0 while external Native source resolved a separate React 19.2.3. Metro's actual source map
confirmed both runtimes. The candidate's Metro resolver now pins React, React Native and Native
runtime peers to the Expo app's existing installation, while preserving candidate core/Native
source aliases. No dependencies were installed and the original Plan 3 launcher/configuration were
unchanged. Restart Metro to load this configuration fix; clearing accepted device storage is not
required. Automated resolution and bundle checks do not replace phone acceptance.

## User-reported Android acceptance, 29 October

The user confirms that the corrected candidate opens and that **Choices and supported setters**,
**Nested choice editing and cancel/save**, and all other walkthrough checks pass. This includes the
reported manual execution rather than an agent-attached ADB session. The separate BuildingPlan
binding checks used web pointer interactions and Native hooks; physical BuildingPlan navigation was
not part of that automated coverage and Native has no equivalent canvas.

| Fixture     | Sample         | elapsedMs | maxObservedJSGapMs |
| ----------- | -------------- | --------: | -----------------: |
| Large 200   | First reported |     1,234 |                 83 |
| Large 200   | Warm           |       880 |                 84 |
| Large 2,000 | Reported       |     8,704 |                354 |

Keep these observations separate from the historical **1,333 / 8,454 ms** and **90 / 323 ms** gaps.
The user confirmed exactly the same Pixel 8a / API37 / Expo Go58.0.5 / RN0.88 setup, JS development
mode false, Hermes true and SAFE off. The first 200-row sample is 99 ms faster (7.43%) with a 7 ms
smaller gap; 2,000 rows is 250 ms slower (2.96%) with a 31 ms larger gap than the historical sample.
The warm 200-row observation is separate, and these single samples do not establish a statistical
performance change. The exact user-tested overlay hashes were retained
before the following logging-only adjustment in the task's `phone-acceptance-20261029/` directory.

Native's default picker components omit dropdown chevrons; this fixture uses those components. Review that affordance under [Native #45](https://github.com/paqu-io/form0-react-native/issues/45)
and the web styling counterpart [React #77](https://github.com/paqu-io/form0-react/issues/77).
No control styling was changed for issue 101.

### Viewing successful submissions in the Metro terminal

The original fixture's console guard omitted **Choices / setters**. Also, Expo Go does not forward
ordinary console output to the Expo CLI in production mode. The issue-101 overlay now reports its
small synthetic choices/nested/confirmation records to a dedicated Metro middleware route after
SQLite persistence succeeds. The terminal prints the stored submission's record and freshness as
JSON. This is acceptance-harness behavior, not a form0 library logger. Reporting failure does not
reject or retry a successful write; large-fixture preparation never invokes the reporter.

1. Stop the existing Metro process with **Ctrl+C**.
2. Start it with the same production/tunnel command above.
3. Force stop Expo Go to retire the previous production bundle.
4. Open the new QR code.
5. Open **Choices / setters**.
6. Submit the root.
7. Check the Metro terminal for **[form0 acceptance] Persisted record and freshness** followed by the
   record JSON; the phone must still report successful persistence.

Reset with **Choices / setters** before starting another independent scenario. Five focused runtime
resolution/reporting tests pass, including transport failure, malformed requests and all three small
fixture names. An actual production Metro bundle and reporting endpoint were checked locally; the
new terminal-reporting transport has not itself been retested on the physical phone/tunnel. No full
functional acceptance rerun is required for this observability-only adjustment.
