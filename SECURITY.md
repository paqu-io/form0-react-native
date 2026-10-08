# Security Policy

Security reports are taken seriously. Please report vulnerabilities privately so they can be
investigated and fixed before public disclosure.

## Reporting a vulnerability

Use the
[form0-react-native private vulnerability report](https://github.com/paqu-io/form0-react-native/security/advisories/new).
Do not open a public issue for a suspected vulnerability.

Include:

- the affected version and runtime;
- a minimal reproduction or proof of concept;
- the impact you believe is possible;
- any mitigations you have already identified; and
- whether the issue has been disclosed anywhere else.

Reports affecting any version are welcome. When possible, reproduce the issue with the latest
release, or the latest default branch for repositories that are not published as packages.
Security fixes are normally released for the latest version; older versions are assessed case by
case.

Maintainers will review the report, may ask for more information, and will coordinate disclosure
after a fix or mitigation is available. Please keep the report private during that process.

For ordinary usage questions, see
[SUPPORT.md](https://github.com/paqu-io/form0-react-native/blob/main/SUPPORT.md).

## Temporary development-tooling audit exception

Approved on **8 October 2026**, expiring **7 November 2026 at 00:00 UTC**:
[GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), the high-severity
braces 3.0.3 stack-exhaustion advisory, remains an **accepted temporary risk, not a patched
dependency or a claim of non-exploitability**. The reviewed exposure is Node-side Metro file
watching in the React Native peer/tooling graph, not form values. Consumer applications own their
peer dependency locks; this library's lockfile does not remediate those applications.

`security:audit:prod` is unchanged. `security:audit:all` still audits every dependency category
and blocks every other high/critical advisory. Its narrow exception checks the advisory identity,
severity, reviewed dependency edges, and peer-only lockfile paths; new paths or an escalation
are not waived. Registry errors, malformed reports, and unknown audit formats fail closed.
At the deadline, unresolved affected findings block again automatically. A clean audit continues
to pass after expiry; there is no command-line/environment option to extend the deadline.

The maintainer must review/remove the exception as soon as an upstream patch is available,
and before the deadline. Do not extend it silently or disable the production/other-advisory gates.
