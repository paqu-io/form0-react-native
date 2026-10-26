import { readFile, writeFile, mkdir, copyFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workspace = path.dirname(repo);
const target = path.resolve(
  process.argv[2] ||
    path.join(workspace, ".local-test-harnesses/form0-plan3-20261022/device"),
);
const template = JSON.parse(
  await readFile(
    path.join(workspace, "form0-mobile-tmpl-react-native-expo/package.json"),
    "utf8",
  ),
);
await mkdir(target, { recursive: true });
const core = JSON.parse(
  await readFile(path.join(workspace, "form0-core/package.json"), "utf8"),
);
const native = JSON.parse(
  await readFile(path.join(repo, "package.json"), "utf8"),
);
const artifactDirectory = path.join(
  workspace,
  ".local-test-harnesses/form0-plan3-20261022/artifacts",
);
const artifact = (name, version) =>
  "file:" +
  path.relative(target, path.join(artifactDirectory, `${name}-${version}.tgz`));
const dependencies = {
  ...template.dependencies,
  "form0-core": artifact("form0-core", core.version),
  "form0-react-native": artifact("form0-react-native", native.version),
};
await writeFile(
  path.join(target, "package.json"),
  JSON.stringify(
    {
      ...template,
      name: "form0-plan3-device-acceptance",
      version: "0.0.0",
      private: true,
      type: "module",
      main: "index.js",
      scripts: { start: "expo start --clear" },
      dependencies,
      devDependencies: template.devDependencies,
    },
    null,
    2,
  ) + "\n",
);
const lock = JSON.parse(
  await readFile(
    path.join(
      workspace,
      "form0-mobile-tmpl-react-native-expo/package-lock.json",
    ),
    "utf8",
  ),
);
lock.name = "form0-plan3-device-acceptance";
lock.version = "0.0.0";
Object.assign(lock.packages[""], {
  name: lock.name,
  version: lock.version,
  dependencies,
});
await writeFile(
  path.join(target, "package-lock.json"),
  JSON.stringify(lock, null, 2) + "\n",
);
await writeFile(
  path.join(target, "index.js"),
  "import { registerRootComponent } from 'expo';\nimport App from './App.jsx';\nregisterRootComponent(App);\n",
);
await writeFile(
  path.join(target, "app.json"),
  JSON.stringify(
    {
      expo: {
        name: "form0 Plan 3 acceptance",
        slug: "form0-plan3-acceptance",
        version: "0.0.0",
        orientation: "portrait",
      },
    },
    null,
    2,
  ) + "\n",
);
for (const file of [
  "App.jsx",
  "record-fixtures.js",
  "preparation-profile.js",
  "diagnostic-bootstrap.js",
  "metro.config.cjs",
  "metro-proxy-headers.cjs",
])
  await copyFile(
    path.join(repo, "tests/device", file),
    path.join(target, file),
  );
// The diagnostic uses the same private host scheduler as the installed renderer.
await copyFile(
  path.join(repo, "src/utils/record-scheduling.js"),
  path.join(target, "record-scheduling.js"),
);
const profilePath = path.join(target, "preparation-profile.js");
await writeFile(
  profilePath,
  (await readFile(profilePath, "utf8")).replace(
    "../../src/utils/record-scheduling.js",
    "./record-scheduling.js",
  ),
);
for (const file of ["calculation-fixtures.js", "complex-record-fixture.js"])
  await copyFile(
    path.join(workspace, "form0-core/tests/helpers", file),
    path.join(target, file),
  );
await copyFile(
  path.join(
    workspace,
    "form0-mobile-tmpl-react-native-expo/src/lib/local-record-store.js",
  ),
  path.join(target, "local-record-store.js"),
);
console.log("Prepared source-only device harness:", target);
console.log(
  "No dependencies installed or copied. Installation is expected to require roughly 1–2 GiB plus npm cache; check host and WSL space first.",
);
