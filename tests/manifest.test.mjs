import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  GECKO_ID,
  GECKO_MIN_VERSION,
  TARGETS,
  archiveName,
  backgroundFormat,
  buildManifest
} from "../scripts/manifest.mjs";

const root = path.resolve(import.meta.dirname, "..");
const source = path.join(root, "extension");
const base = JSON.parse(
  await readFile(path.join(source, "manifest.json"), "utf8")
);

test("the Chromium manifest is the unmodified source manifest", () => {
  assert.deepEqual(buildManifest(base, "chromium"), base);
});

test("the Firefox manifest replaces the service worker with an event page", () => {
  const manifest = buildManifest(base, "firefox");
  assert.deepEqual(manifest.background, { scripts: ["background.js"] });
  assert.equal(manifest.background.service_worker, undefined);
  // An event page loads a classic script, so the bundle must not be an ES module.
  assert.equal(manifest.background.type, undefined);
  assert.equal(backgroundFormat("firefox"), "iife");
});

test("the Firefox manifest carries the AMO add-on identity", () => {
  const { gecko } = buildManifest(base, "firefox").browser_specific_settings;
  assert.equal(gecko.id, GECKO_ID);
  assert.equal(gecko.strict_min_version, GECKO_MIN_VERSION);
  // MV3 event pages, OffscreenCanvas 2d and wasm SIMD all predate this.
  assert.ok(Number.parseFloat(GECKO_MIN_VERSION) >= 115);
});

test("the Firefox manifest drops Chromium-only keys", () => {
  const manifest = buildManifest(base, "firefox");
  assert.equal(manifest.minimum_chrome_version, undefined);
  assert.equal("minimum_chrome_version" in manifest, false);
});

test("both manifests share version, locales, CSP and match patterns", () => {
  const chromium = buildManifest(base, "chromium");
  const firefox = buildManifest(base, "firefox");
  for (const key of [
    "manifest_version",
    "version",
    "default_locale",
    "permissions",
    "host_permissions",
    "content_security_policy",
    "content_scripts"
  ]) {
    assert.deepEqual(firefox[key], chromium[key], key);
  }
});

test("buildManifest does not mutate the source manifest", () => {
  const before = structuredClone(base);
  buildManifest(base, "firefox");
  assert.deepEqual(base, before);
});

test("buildManifest rejects an unknown target", () => {
  assert.throws(() => buildManifest(base, "safari"), /Unknown build target/);
});

test("each target gets a distinct archive name", () => {
  const names = TARGETS.map((target) => archiveName("1.2.3", target));
  assert.equal(new Set(names).size, TARGETS.length);
  assert.equal(archiveName("1.2.3", "chromium"), "SJTU-Autologin-1.2.3.zip");
  assert.equal(
    archiveName("1.2.3", "firefox"),
    "SJTU-Autologin-firefox-1.2.3.zip"
  );
});

test("extension sources reach the WebExtension APIs through the shim", async () => {
  const shim = await readFile(path.join(source, "browser-api.js"), "utf8");
  assert.match(shim, /globalThis\.browser \?\? globalThis\.chrome/);

  const files = (await readdir(source)).filter(
    (name) => name.endsWith(".js") && name !== "browser-api.js"
  );
  for (const name of files) {
    const code = await readFile(path.join(source, name), "utf8");
    // Firefox only exposes callback-style APIs on `chrome`, so a bare
    // `chrome.` call would silently stop returning promises there.
    assert.doesNotMatch(code, /(^|[^.\w])chrome\./, name);
    if (/\bapi\./.test(code)) {
      assert.match(code, /import \{ api \} from "\.\/browser-api\.js"/, name);
    }
  }
});

test("the popup can request Firefox's optional host permission", async () => {
  const [html, script] = await Promise.all([
    readFile(path.join(source, "popup.html"), "utf8"),
    readFile(path.join(source, "popup.js"), "utf8")
  ]);
  assert.match(html, /id="site-access-grant"/);
  assert.match(script, /permissions\.request\(\{ origins: LOGIN_ORIGINS \}\)/);
  assert.match(script, /permissions\.contains\(\{/);
  // The origin offered to the user must match what the manifest declares.
  assert.match(
    script,
    new RegExp(
      `LOGIN_ORIGINS = \\[\\s*"${base.host_permissions[0].replace(/[.*/]/g, "\\$&")}"`
    )
  );
});

test("the content script keeps its page state in attributes, not dataset", async () => {
  const code = await readFile(path.join(source, "content.js"), "utf8");
  const withoutComments = code
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("//"))
    .join("\n");
  // Firefox's Xray vision puts `element.dataset` writes from a content script
  // on a per-sandbox wrapper instead of a real attribute, so they read back as
  // undefined and the auto-login gate never opens. Attributes survive it.
  assert.doesNotMatch(withoutComments, /\.dataset\b/);
  assert.match(withoutComments, /setAttribute\(OCR_STATUS_ATTRIBUTE/);
  assert.match(withoutComments, /getAttribute\(OCR_STATUS_ATTRIBUTE\)/);
});
