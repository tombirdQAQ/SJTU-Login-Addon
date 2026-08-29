// Firefox exposes the promise-based WebExtension APIs on `browser`; Chromium
// only defines `chrome`. Chromium's MV3 `chrome.*` returns promises and
// Firefox's `browser.*` always has, so preferring `browser` yields a single
// promise-based surface on both engines without a polyfill dependency.
export const api = globalThis.browser ?? globalThis.chrome;
