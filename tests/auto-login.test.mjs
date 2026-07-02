import assert from "node:assert/strict";
import test from "node:test";

import {
  AUTO_LOGIN_DELAY_MS,
  AUTOFILL_POLL_DURATION_MS,
  AUTOFILL_POLL_INTERVAL_MS,
  isCredentialFilled,
  MAX_AUTO_SUBMITS,
  shouldAutoSubmit,
  SubmissionGate
} from "../extension/auto-login.js";

test("detects value and Chromium autofill without retaining credentials", () => {
  assert.equal(
    isCredentialFilled({ value: "saved-user", matches: () => false }),
    true
  );
  assert.equal(
    isCredentialFilled({ value: "", matches: (selector) => selector === ":-webkit-autofill" }),
    true
  );
  assert.equal(isCredentialFilled({ value: "", matches: () => false }), false);
  assert.equal(
    isCredentialFilled({
      value: "",
      matches: () => {
        throw new Error("unsupported selector");
      }
    }),
    false
  );
});

test("requires every safety condition before auto-submit", () => {
  const gate = new SubmissionGate();
  const ready = {
    enabled: true,
    autoLogin: true,
    captchaFilled: true,
    userFilled: true,
    passFilled: true,
    buttonVisible: true,
    buttonDisabled: false,
    fingerprint: "captcha-1",
    gate
  };
  assert.equal(shouldAutoSubmit(ready), true);
  for (const field of [
    "enabled",
    "autoLogin",
    "captchaFilled",
    "userFilled",
    "passFilled",
    "buttonVisible"
  ]) {
    assert.equal(shouldAutoSubmit({ ...ready, [field]: false }), false, field);
  }
  assert.equal(shouldAutoSubmit({ ...ready, buttonDisabled: true }), false);
});

test("submits each captcha once and stops after three attempts", () => {
  const gate = new SubmissionGate();
  assert.equal(gate.record("captcha-1"), true);
  assert.equal(gate.record("captcha-1"), false);
  assert.equal(gate.record("captcha-2"), true);
  assert.equal(gate.record("captcha-3"), true);
  assert.equal(gate.record("captcha-4"), false);
  assert.equal(gate.attempts, MAX_AUTO_SUBMITS);
});

test("uses the specified delay and polling window", () => {
  assert.equal(AUTO_LOGIN_DELAY_MS, 500);
  assert.equal(AUTOFILL_POLL_INTERVAL_MS, 250);
  assert.equal(AUTOFILL_POLL_DURATION_MS, 15_000);
});
