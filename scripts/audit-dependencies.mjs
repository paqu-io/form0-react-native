import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const EXCEPTION_URL =
  "https://github.com/advisories/GHSA-vfj7-8cjw-p6xm";
export const EXCEPTION_EXPIRES = "2026-11-07T00:00:00Z";

// Reviewed Node-side Metro peer graph only. New paths/edges require review.
const peerEdges = new Map([
  ["@react-native/community-cli-plugin", ["metro"]],
  ["@react-native/virtualized-lists", ["react-native"]],
  ["braces", []],
  ["metro", ["metro-config", "metro-file-map", "metro-transform-worker"]],
  ["metro-config", ["metro"]],
  ["metro-file-map", ["micromatch"]],
  ["metro-transform-worker", ["metro"]],
  ["micromatch", ["braces"]],
  [
    "react-native",
    ["@react-native/community-cli-plugin", "@react-native/virtualized-lists"],
  ],
]);
const severities = ["info", "low", "moderate", "high", "critical"];
const isObject = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

function validateReport(report, lock, npmStatus, now) {
  if (
    ![0, 1].includes(npmStatus) ||
    !Number.isFinite(now) ||
    !isObject(report) ||
    report.error ||
    report.auditReportVersion !== 2 ||
    !isObject(report.vulnerabilities) ||
    !isObject(report.metadata?.vulnerabilities) ||
    !isObject(lock?.packages) ||
    !isObject(lock.packages[""])
  ) {
    throw new Error(
      "Audit failed or returned an unsupported report/lockfile; refusing to waive findings.",
    );
  }
  const counts = Object.fromEntries(
    severities.map((severity) => [severity, 0]),
  );
  for (const [name, entry] of Object.entries(report.vulnerabilities)) {
    if (
      !isObject(entry) ||
      entry.name !== name ||
      !severities.includes(entry.severity) ||
      !Array.isArray(entry.via) ||
      entry.via.length === 0 ||
      !Array.isArray(entry.nodes) ||
      entry.nodes.length === 0 ||
      !entry.nodes.every((node) => typeof node === "string") ||
      !entry.via.every((via) =>
        typeof via === "string"
          ? Object.hasOwn(report.vulnerabilities, via)
          : isObject(via) &&
            typeof via.url === "string" &&
            severities.includes(via.severity),
      )
    ) {
      throw new Error(
        `Malformed audit finding for ${name}; refusing to waive findings.`,
      );
    }
    counts[entry.severity] += 1;
  }
  const metadata = report.metadata.vulnerabilities;
  if (
    severities.some((severity) => metadata[severity] !== counts[severity]) ||
    metadata.total !== Object.keys(report.vulnerabilities).length ||
    (npmStatus === 0 && counts.high + counts.critical > 0) ||
    (npmStatus === 1 && counts.high + counts.critical === 0)
  ) {
    throw new Error(
      "Inconsistent audit totals/exit status; refusing to waive findings.",
    );
  }
}

function isReviewedPeerChain(start, vulnerabilities, packages) {
  const pending = [start];
  const visited = new Set();
  let reachesAdvisory = false;
  const root = packages[""];
  if (!root.peerDependencies?.["react-native"]) return false;

  // npm's via graph has Metro / React Native cycles; visit each entry once.
  while (pending.length) {
    const name = pending.pop();
    if (visited.has(name)) continue;
    visited.add(name);
    const entry = vulnerabilities[name];
    const allowedEdges = peerEdges.get(name);
    if (
      !entry ||
      !allowedEdges ||
      entry.severity !== "high" ||
      root.dependencies?.[name] ||
      root.optionalDependencies?.[name] ||
      root.devDependencies?.[name] ||
      entry.nodes.length !== 1 ||
      entry.nodes[0] !== `node_modules/${name}` ||
      packages[entry.nodes[0]]?.peer !== true ||
      packages[entry.nodes[0]]?.dev === true
    )
      return false;

    for (const via of entry.via) {
      if (typeof via === "string") {
        if (!allowedEdges.includes(via)) return false;
        pending.push(via);
      } else {
        if (
          name !== "braces" ||
          via.name !== "braces" ||
          via.dependency !== "braces" ||
          via.url !== EXCEPTION_URL ||
          via.severity !== "high" ||
          packages[entry.nodes[0]].version !== "3.0.3"
        )
          return false;
        reachesAdvisory = true;
      }
    }
  }
  return reachesAdvisory;
}

// Internal release-tooling API, not a public binding export. Clock injection is test-only;
// the command always uses the real clock and offers no expiry override flag/env setting.
export function evaluateAudit(
  report,
  lock,
  { npmStatus = 1, now = Date.now() } = {},
) {
  validateReport(report, lock, npmStatus, now);
  const accepted = [];
  const blocked = [];
  const expired = now >= Date.parse(EXCEPTION_EXPIRES);
  for (const [name, entry] of Object.entries(report.vulnerabilities)) {
    if (!["high", "critical"].includes(entry.severity)) continue;
    if (
      !expired &&
      isReviewedPeerChain(name, report.vulnerabilities, lock.packages)
    ) {
      accepted.push(name);
    } else {
      blocked.push(name);
    }
  }
  return { accepted, blocked, expired };
}

function runAudit() {
  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
  const result = spawnSync(
    npmCommand,
    [
      "audit",
      "--json",
      "--audit-level=high",
      "--include=dev",
      "--include=peer",
      "--include=optional",
    ],
    { encoding: "utf8", timeout: 45_000, maxBuffer: 10 * 1024 * 1024 },
  );
  try {
    if (result.error || result.signal)
      throw new Error("npm audit could not complete.");
    const report = JSON.parse(result.stdout);
    const lock = JSON.parse(readFileSync("package-lock.json", "utf8"));
    const { accepted, blocked, expired } = evaluateAudit(report, lock, {
      npmStatus: result.status,
    });
    console.log(
      `All-dependencies audit counts: ${JSON.stringify(report.metadata.vulnerabilities)}`,
    );
    if (accepted.length) {
      console.log(
        `Accepted temporary risk: ${EXCEPTION_URL} (${accepted.length} peer-chain entries); expires ${EXCEPTION_EXPIRES}. NOT patched.`,
      );
    }
    if (blocked.length) {
      console.error(`Blocking high/critical findings: ${blocked.join(", ")}.`);
      if (expired)
        console.error(
          `The Metro/braces exception expired at ${EXCEPTION_EXPIRES}.`,
        );
      process.exitCode = 1;
    } else {
      console.log(
        "Audit policy passed; all other high/critical findings remain blocking.",
      );
    }
  } catch {
    // Do not print raw npm output; registry errors may include private configuration.
    console.error(
      "All-dependencies audit failed closed: npm audit did not return a valid report/exit status or the lockfile could not be verified. Check registry connectivity and report/lockfile format.",
    );
    process.exitCode = 1;
  }
}

if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  runAudit();
}
