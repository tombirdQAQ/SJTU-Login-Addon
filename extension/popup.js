import { api } from "./browser-api.js";
import { message } from "./i18n.js";

const enabled = document.querySelector("#enabled");
const autoLogin = document.querySelector("#auto-login");
const status = document.querySelector("#status");
const retry = document.querySelector("#retry");
const credentialForm = document.querySelector("#credential-form");
const credentialUser = document.querySelector("#credential-user");
const credentialPass = document.querySelector("#credential-pass");
const credentialError = document.querySelector("#credential-error");
const credentialSaved = document.querySelector("#credential-saved");
const credentialName = document.querySelector("#credential-name");
const credentialClear = document.querySelector("#credential-clear");
const siteAccess = document.querySelector("#site-access");
const siteAccessText = document.querySelector("#site-access-text");
const siteAccessGrant = document.querySelector("#site-access-grant");
let pollTimer;

document.documentElement.lang = message("@@ui_locale").replace("_", "-");
for (const element of document.querySelectorAll("[data-i18n]")) {
  element.textContent = message(element.dataset.i18n);
}

const STATUS_TEXT = {
  idle: message("engineIdle"),
  loading: message("engineLoading"),
  ready: message("engineReady"),
  error: message("engineError")
};

async function checkEngine({ retryEngine = false } = {}) {
  window.clearTimeout(pollTimer);
  try {
    const result = await api.runtime.sendMessage({
      type: "engine-status",
      retry: retryEngine
    });
    const engineStatus = result?.status || "error";
    status.textContent =
      engineStatus === "error" && result?.error
        ? `${STATUS_TEXT.error}：${result.error}`
        : STATUS_TEXT[engineStatus] || STATUS_TEXT.error;
    status.className =
      engineStatus === "ready"
        ? "ok"
        : engineStatus === "error"
          ? "error"
          : "loading";
    retry.hidden = engineStatus !== "error";
    if (engineStatus === "loading" || engineStatus === "idle") {
      pollTimer = window.setTimeout(checkEngine, 500);
    }
  } catch (error) {
    status.textContent = message("backgroundUnavailable", error.message);
    status.className = "error";
    retry.hidden = false;
  }
}

const LOGIN_ORIGINS = ["https://jaccount.sjtu.edu.cn/*"];

// Firefox treats MV3 host permissions as optional, and before Firefox 127 the
// install prompt did not even mention them, so the add-on can sit installed but
// inert. Chromium grants them at install time, where this stays hidden.
async function refreshSiteAccess() {
  if (!api?.permissions?.contains) {
    siteAccess.hidden = true;
    return;
  }
  try {
    siteAccess.hidden = await api.permissions.contains({
      origins: LOGIN_ORIGINS
    });
  } catch {
    siteAccess.hidden = true;
  }
}

function updateAutoLoginAvailability() {
  autoLogin.disabled = !enabled.checked;
}

function showCredentialError(text) {
  credentialError.textContent = text;
  credentialError.hidden = !text;
}

async function refreshCredentialUI() {
  const active = enabled.checked && autoLogin.checked;
  if (!active) {
    credentialForm.hidden = true;
    credentialSaved.hidden = true;
    return;
  }
  try {
    const result = await api.runtime.sendMessage({
      type: "credentials-status"
    });
    const saved = Boolean(result?.ok && result.saved);
    credentialForm.hidden = saved;
    credentialSaved.hidden = !saved;
    credentialName.textContent = saved ? result.user : "";
  } catch {
    credentialForm.hidden = true;
    credentialSaved.hidden = true;
  }
}

api.storage.local.get({ enabled: true, autoLogin: false }).then((data) => {
  enabled.checked = data.enabled;
  autoLogin.checked = data.autoLogin;
  updateAutoLoginAvailability();
  refreshCredentialUI();
});
enabled.addEventListener("change", () => {
  api.storage.local.set({ enabled: enabled.checked });
  updateAutoLoginAvailability();
  refreshCredentialUI();
});
autoLogin.addEventListener("change", () => {
  api.storage.local.set({ autoLogin: autoLogin.checked });
  refreshCredentialUI();
});
credentialForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  showCredentialError("");
  const user = credentialUser.value.trim();
  const pass = credentialPass.value;
  if (!user || !pass) {
    showCredentialError(message("credentialsRequired"));
    return;
  }
  try {
    const result = await api.runtime.sendMessage({
      type: "credentials-save",
      user,
      pass
    });
    if (!result?.ok) throw new Error(result?.error || message("saveFailed"));
    credentialUser.value = "";
    credentialPass.value = "";
    refreshCredentialUI();
  } catch (error) {
    showCredentialError(message("saveFailedDetail", error.message));
  }
});
credentialClear.addEventListener("click", async () => {
  try {
    const result = await api.runtime.sendMessage({
      type: "credentials-clear"
    });
    if (!result?.ok) throw new Error(result?.error || message("clearFailed"));
  } finally {
    refreshCredentialUI();
  }
});
siteAccessGrant.addEventListener("click", async () => {
  // permissions.request must be called directly from the click handler, so no
  // awaiting anything before it.
  try {
    const granted = await api.permissions.request({ origins: LOGIN_ORIGINS });
    if (granted) {
      // A login page that is already open has no content script in it yet, so
      // keep the card up to ask for a reload rather than hiding it on success.
      siteAccessText.textContent = message("siteAccessReload");
      siteAccessGrant.hidden = true;
      return;
    }
    await refreshSiteAccess();
  } catch (error) {
    siteAccessText.textContent = message("siteAccessFailed", error.message);
  }
});
retry.addEventListener("click", () => checkEngine({ retryEngine: true }));
refreshSiteAccess();
checkEngine();
