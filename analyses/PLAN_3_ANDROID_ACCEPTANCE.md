# Plan 3 Android acceptance

Actual device acceptance is pending. Adapter, Node and Chromium results do not establish Hermes
performance or device acceptance. iOS remains deferred. Use the packed core/Native candidates named
in the Plan 3 verification ledger; their labels retain the last published versions until release.

## Prepare and start

The independent harness lives at `.local-test-harnesses/form0-plan3-20261022/device/` in the workspace.
Its generator is `scripts/prepare-record-device-harness.mjs`. It uses existing mobile-template SDK pins
and the packed candidates, with a separate SQLite database (`form0-plan3-acceptance.db`). It does not
read environment files or alter the production app/database. The SQLite envelope stores record,
snapshot and freshness together before acknowledging a callback or explicit preparation.

Installation is expected to use roughly 1–2 GiB plus npm cache. Check both the Windows backing disk and
WSL space before installing. The independent SDK tree is installed and an Android Hermes bytecode export passed. This is bundle
verification, not device acceptance. Reuse that tree; do not reinstall merely to resume acceptance.
Native/mobile dependency exceptions remain separate; do not upgrade unrelated dependencies here.

1. Open a terminal in the device harness directory above and select the workspace's pinned Node
   with `nvm use 24.22.1`.
2. Run `npm start -- --max-workers 2` and scan its QR code in Expo Go. Keep the phone and Windows
   machine on the same Wi-Fi. If WSL networking prevents the LAN connection, stop Metro and run
   `npm start -- --tunnel --max-workers 2`, following the installed CLI's account prompts locally.
   Do not upgrade SDK dependencies to solve a connection problem.
3. Record device model, Android version, Expo client/build version, the displayed React Native version,
   and the displayed `Hermes true` before acceptance. Do not run acceptance through Chrome JS execution.

Entry registration and cache-clearing commands follow the
[Expo entrypoint guidance](https://github.com/expo/expo/blob/main/docs/pages/troubleshooting/application-has-not-been-registered.mdx)
and [CLI guidance](https://github.com/expo/expo/blob/main/docs/pages/router/installation.mdx).
See also [physical-device connections](https://github.com/expo/expo/blob/main/docs/pages/get-started/start-developing.mdx).
These commands do not establish SDK 57/device compatibility by themselves. The fixture source and package pins
are the concrete test inputs; record the actual client/runtime used.

## Walkthrough 1 — nested editing and accepted save/cancel isolation

1. Tap **Nested editing**. Expect root `grand_total` 130; this starts a fresh unsaved fixture.
2. Open **projects**, then **P1**, and enter **Edit**. Expect tasks with accepted costs 10 and 20.
3. Change **surcharge** to 5. Expect P1 `subtotal` 35.
4. Cancel P1 and discard its edits if prompted. Expect root `grand_total` remains 130.
5. Open P1 again, enter Edit, set surcharge to 5, and save the child. Expect root `grand_total` 135.
6. Open **P2**. Expect subtotal 100; P1's edit has not changed P2's tasks. Return without changes.
7. Submit the root. Expect successful persistence and no record-ID/order changes. Continue with the
   next walkthrough using its own fixture button; do not carry this fixture into it.

## Walkthrough 2 — confirmation, persistence failure and restoration

1. Tap **Confirmation / persistence**. Expect accepted child totals 110 and 220 and root `grand` 330.
2. Enable **Simulate persistence failure**.
3. Submit and choose **Update all and continue**. Expect the host failure status, unsaved working
   totals 120 and 240, root 360 and dirty work; no successful-persistence acknowledgement.
4. Tap **Confirmation / persistence** again to reset to the original fixture; disable simulated failure.
5. Submit and choose **Keep existing values and continue**. Expect root 330 and persisted pending freshness.
6. Tap **Reopen saved**. Expect accepted totals 110 and 220, root 330, and the restored pending indicator.
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
