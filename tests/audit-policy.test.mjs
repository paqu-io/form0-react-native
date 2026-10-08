import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateAudit,
  EXCEPTION_EXPIRES,
  EXCEPTION_URL,
} from "../scripts/audit-dependencies.mjs";

const now = Date.parse("2026-10-08T00:00:00Z");
const advisory = {
  name: "braces",
  dependency: "braces",
  url: EXCEPTION_URL,
  severity: "high",
};
const edges = {
  "@react-native/community-cli-plugin": ["metro"],
  "@react-native/virtualized-lists": ["react-native"],
  braces: [advisory],
  metro: ["metro-config", "metro-file-map", "metro-transform-worker"],
  "metro-config": ["metro"],
  "metro-file-map": ["micromatch"],
  "metro-transform-worker": ["metro"],
  micromatch: ["braces"],
  "react-native": [
    "@react-native/community-cli-plugin",
    "@react-native/virtualized-lists",
  ],
};

function fixture() {
  const report = {
    auditReportVersion: 2,
    vulnerabilities: Object.fromEntries(
      Object.entries(edges).map(([name, via]) => [
        name,
        {
          name,
          severity: "high",
          via: structuredClone(via),
          nodes: [`node_modules/${name}`],
        },
      ]),
    ),
    metadata: {
      vulnerabilities: {
        info: 0,
        low: 0,
        moderate: 0,
        high: 9,
        critical: 0,
        total: 9,
      },
    },
  };
  const lock = {
    packages: {
      "": {
        dependencies: { "form0-core": "^0.4.1" },
        peerDependencies: { "react-native": ">=0.72.0" },
      },
      ...Object.fromEntries(
        Object.keys(edges).map((name) => [
          `node_modules/${name}`,
          { peer: true, version: "3.0.3" },
        ]),
      ),
    },
  };
  return { report, lock };
}
const evaluate = ({ report, lock }, options = {}) =>
  evaluateAudit(report, lock, { now, ...options });

test("audit exception accepts exactly the reviewed advisory and cyclic peer graph before expiry", () => {
  const result = evaluate(fixture());
  assert.equal(result.accepted.length, 9);
  assert.deepEqual(result.blocked, []);
  assert.equal(result.expired, false);
});

test("audit exception expires at the UTC boundary, not one millisecond earlier", () => {
  const expires = Date.parse(EXCEPTION_EXPIRES);
  assert.equal(evaluate(fixture(), { now: expires - 1 }).accepted.length, 9);
  for (const time of [expires, expires + 1]) {
    const result = evaluate(fixture(), { now: time });
    assert.equal(result.accepted.length, 0);
    assert.equal(result.blocked.length, 9);
    assert.equal(result.expired, true);
  }
});

test("audit exception rejects another advisory attached to braces", () => {
  const data = fixture();
  data.report.vulnerabilities.braces.via.push({
    ...advisory,
    url: "https://github.com/advisories/GHSA-other",
  });
  assert.equal(evaluate(data).blocked.length, 9);
});

test("audit exception keeps unrelated high and critical findings blocking", () => {
  for (const severity of ["high", "critical"]) {
    const data = fixture();
    data.report.vulnerabilities.other = {
      name: "other",
      severity,
      nodes: ["node_modules/other"],
      via: [{ ...advisory, name: "other", severity }],
    };
    data.report.metadata.vulnerabilities[severity] += 1;
    data.report.metadata.vulnerabilities.total += 1;
    const result = evaluate(data);
    assert.equal(result.accepted.length, 9);
    assert.deepEqual(result.blocked, ["other"]);
  }
});

test("audit exception does not waive a critical escalation of the approved advisory", () => {
  const data = fixture();
  data.report.vulnerabilities.braces.severity = "critical";
  data.report.vulnerabilities.braces.via[0].severity = "critical";
  data.report.metadata.vulnerabilities.high = 8;
  data.report.metadata.vulnerabilities.critical = 1;
  assert.equal(evaluate(data).blocked.length, 9);
});

test("audit exception rejects production, direct, development and additional installation paths", () => {
  const changes = [
    (data) => {
      data.lock.packages["node_modules/braces"].peer = false;
    },
    (data) => {
      data.lock.packages[""].dependencies.braces = "^3.0.3";
    },
    (data) => {
      data.lock.packages["node_modules/braces"].dev = true;
    },
    (data) => {
      data.report.vulnerabilities.braces.nodes.push(
        "node_modules/other/node_modules/braces",
      );
    },
    (data) => {
      delete data.lock.packages["node_modules/braces"];
    },
    (data) => {
      data.lock.packages["node_modules/braces"].version = "2.3.2";
    },
  ];
  for (const change of changes) {
    const data = fixture();
    change(data);
    assert.equal(evaluate(data).blocked.length, 9);
  }
});

test("audit exception rejects new dependency edges and cycles with no advisory leaf", () => {
  const data = fixture();
  data.report.vulnerabilities["metro-file-map"].via = ["metro"];
  const result = evaluate(data);
  assert.ok(result.blocked.includes("metro"));
  assert.ok(result.blocked.includes("react-native"));
});

test("audit exception fails closed on registry/process errors and unsupported reports", () => {
  for (const npmStatus of [null, 2, 127])
    assert.throws(() => evaluate(fixture(), { npmStatus }));
  for (const change of [
    (data) => {
      data.report.error = { code: "ENOAUDIT" };
    },
    (data) => {
      data.report.auditReportVersion = 1;
    },
    (data) => {
      data.report.metadata.vulnerabilities.high = 0;
    },
    (data) => {
      data.report.vulnerabilities.metro.via = ["missing"];
    },
    (data) => {
      data.report.vulnerabilities.braces.via = [];
    },
    (data) => {
      data.lock.packages = null;
    },
  ]) {
    const data = fixture();
    change(data);
    assert.throws(() => evaluate(data));
  }
  assert.throws(() => evaluate(fixture(), { npmStatus: 0 }));
  assert.throws(() => evaluate(fixture(), { now: NaN }));
});

test("audit exception leaves clean and moderate-only reports passing even after expiry", () => {
  const data = fixture();
  data.report.vulnerabilities = {};
  data.report.metadata.vulnerabilities = {
    info: 0,
    low: 0,
    moderate: 0,
    high: 0,
    critical: 0,
    total: 0,
  };
  assert.deepEqual(
    evaluate(data, { npmStatus: 0, now: Date.parse(EXCEPTION_EXPIRES) })
      .blocked,
    [],
  );
  assert.throws(() => evaluate(data, { npmStatus: 1 }));
  data.report.vulnerabilities.other = {
    name: "other",
    severity: "moderate",
    nodes: ["node_modules/other"],
    via: [{ ...advisory, severity: "moderate" }],
  };
  data.report.metadata.vulnerabilities.moderate = 1;
  data.report.metadata.vulnerabilities.total = 1;
  assert.deepEqual(evaluate(data, { npmStatus: 0 }).blocked, []);
});
