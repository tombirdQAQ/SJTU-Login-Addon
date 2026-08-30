// Chromium's manifest (extension/manifest.json) is the single source of truth.
// Firefox's manifest is derived from it at build time so the two can never
// drift on version, locales, CSP or match patterns.

export const TARGETS = ["chromium", "firefox"];

// Permanent once the add-on is published on addons.mozilla.org.
export const GECKO_ID = "sjtu-autologin@sj-tu.com";

// 115 ESR is the oldest release where MV3 event pages, OffscreenCanvas 2d and
// wasm SIMD are all stable, which is everything the OCR engine relies on.
export const GECKO_MIN_VERSION = "115.0";

export function buildManifest(base, target) {
  if (!TARGETS.includes(target)) {
    throw new Error(`Unknown build target: ${target}`);
  }
  const manifest = structuredClone(base);
  if (target === "chromium") return manifest;

  // Firefox has no MV3 service worker; the background runs as an event page,
  // which loads a classic script rather than an ES module.
  manifest.background = { scripts: ["background.js"] };
  delete manifest.minimum_chrome_version;
  manifest.browser_specific_settings = {
    gecko: {
      id: GECKO_ID,
      strict_min_version: GECKO_MIN_VERSION,
      // Everything (OCR, credentials) stays on the device, so nothing is
      // collected. Firefox requires new add-ons to state this explicitly.
      data_collection_permissions: { required: ["none"] }
    }
  };
  return manifest;
}

export function esbuildTarget(target) {
  return target === "firefox" ? "firefox115" : "chrome103";
}

// The service worker is an ES module; the Firefox event page is not.
export function backgroundFormat(target) {
  return target === "firefox" ? "iife" : "esm";
}

export function archiveName(version, target) {
  return target === "firefox"
    ? `SJTU-Autologin-firefox-${version}.zip`
    : `SJTU-Autologin-${version}.zip`;
}
