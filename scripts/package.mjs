import { mkdir, readFile, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { TARGETS, archiveName } from "./manifest.mjs";

const root = process.cwd();
const dist = path.join(root, "dist");
const release = path.join(root, "release");

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

await mkdir(release, { recursive: true });

for (const target of targets) {
  const directory = path.join(dist, target);
  const manifest = JSON.parse(
    await readFile(path.join(directory, "manifest.json"), "utf8")
  );
  const archive = path.join(release, archiveName(manifest.version, target));
  await rm(archive, { force: true });
  // Both stores require manifest.json at the archive root, so zip the contents
  // of the target directory rather than the directory itself.
  const result = spawnSync("zip", ["-r", "-q", "-X", archive, "."], {
    cwd: directory,
    encoding: "utf8"
  });
  if (result.error || result.status !== 0) {
    throw new Error(
      result.stderr || result.error?.message || "Failed to create ZIP"
    );
  }
  console.log(`Packaged ${target} extension: ${archive}`);
}
