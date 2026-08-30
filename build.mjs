import { build } from "esbuild";
import {
  cp,
  copyFile,
  mkdir,
  readFile,
  rm,
  stat,
  writeFile
} from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import {
  TARGETS,
  backgroundFormat,
  buildManifest,
  esbuildTarget
} from "./scripts/manifest.mjs";

const root = process.cwd();
const source = path.join(root, "extension");
const output = path.join(root, "dist");
const modelPath = path.join(source, "assets", "common.onnx");
const charsetPath = path.join(source, "assets", "charset-beta.json");
const wasmPath = path.join(
  root,
  "node_modules",
  "onnxruntime-web",
  "dist",
  "ort-wasm-simd-threaded.wasm"
);
const expectedModelHash =
  "33b5cd351ee94e73a6bf8fa18c415ed8b819b3ffd342e267c30d8ad8334e34e8";

const requested = process.argv
  .filter((arg) => arg.startsWith("--target="))
  .map((arg) => arg.slice("--target=".length));
for (const target of requested) {
  if (!TARGETS.includes(target)) {
    throw new Error(
      `Unknown --target=${target}; expected one of ${TARGETS.join(", ")}`
    );
  }
}
const targets = requested.length > 0 ? requested : TARGETS;

await Promise.all([stat(modelPath), stat(charsetPath), stat(wasmPath)]);
const modelHash = createHash("sha256")
  .update(await readFile(modelPath))
  .digest("hex");
if (modelHash !== expectedModelHash) {
  throw new Error(
    `Unexpected common.onnx SHA-256: ${modelHash}; expected ${expectedModelHash}`
  );
}

const baseManifest = JSON.parse(
  await readFile(path.join(source, "manifest.json"), "utf8")
);

// A full build owns the whole directory, so clear anything left behind by an
// earlier layout; a single-target build must leave its sibling target intact.
if (targets.length === TARGETS.length) {
  await rm(output, { recursive: true, force: true });
}

for (const target of targets) {
  await buildTarget(target);
}

async function buildTarget(target) {
  const targetOutput = path.join(output, target);
  const assetOutput = path.join(targetOutput, "assets");
  await rm(targetOutput, { recursive: true, force: true });
  await mkdir(assetOutput, { recursive: true });

  const shared = {
    absWorkingDir: root,
    bundle: true,
    platform: "browser",
    target: esbuildTarget(target),
    minify: true,
    legalComments: "none"
  };
  await Promise.all([
    build({
      ...shared,
      entryPoints: [path.join(source, "background.js")],
      outfile: path.join(targetOutput, "background.js"),
      format: backgroundFormat(target)
    }),
    build({
      ...shared,
      entryPoints: [path.join(source, "content.js")],
      outfile: path.join(targetOutput, "content.js"),
      format: "iife"
    }),
    build({
      ...shared,
      entryPoints: [path.join(source, "popup.js")],
      outfile: path.join(targetOutput, "popup.js"),
      format: "iife"
    })
  ]);

  const staticFiles = ["popup.html", "popup.css", "THIRD_PARTY_NOTICES.txt"];
  await Promise.all(
    staticFiles.map((name) =>
      copyFile(path.join(source, name), path.join(targetOutput, name))
    )
  );
  await cp(path.join(source, "_locales"), path.join(targetOutput, "_locales"), {
    recursive: true
  });
  await Promise.all(
    [16, 32, 48, 128].map((size) =>
      copyFile(
        path.join(source, "icons", `icon-${size}.png`),
        path.join(targetOutput, `icon-${size}.png`)
      )
    )
  );
  await Promise.all([
    copyFile(modelPath, path.join(assetOutput, "common.onnx")),
    copyFile(charsetPath, path.join(assetOutput, "charset-beta.json")),
    copyFile(wasmPath, path.join(targetOutput, "ort-wasm-simd-threaded.wasm"))
  ]);

  await writeFile(
    path.join(targetOutput, "manifest.json"),
    `${JSON.stringify(buildManifest(baseManifest, target), null, 2)}\n`
  );

  console.log(`Built ${target} extension: ${targetOutput}`);
}
