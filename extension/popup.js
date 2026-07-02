const enabled = document.querySelector("#enabled");
const autoLogin = document.querySelector("#auto-login");
const status = document.querySelector("#status");
const retry = document.querySelector("#retry");
let pollTimer;

const STATUS_TEXT = {
  idle: "OCR 模型尚未加载",
  loading: "正在加载本地 OCR 模型…",
  ready: "本地 OCR 模型已就绪",
  error: "OCR 模型加载失败"
};

async function checkEngine({ retryEngine = false } = {}) {
  window.clearTimeout(pollTimer);
  try {
    const result = await chrome.runtime.sendMessage({
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
    status.textContent = `扩展后台不可用：${error.message}`;
    status.className = "error";
    retry.hidden = false;
  }
}

function updateAutoLoginAvailability() {
  autoLogin.disabled = !enabled.checked;
}

chrome.storage.local.get({ enabled: true, autoLogin: false }).then((data) => {
  enabled.checked = data.enabled;
  autoLogin.checked = data.autoLogin;
  updateAutoLoginAvailability();
});
enabled.addEventListener("change", () => {
  chrome.storage.local.set({ enabled: enabled.checked });
  updateAutoLoginAvailability();
});
autoLogin.addEventListener("change", () => {
  chrome.storage.local.set({ autoLogin: autoLogin.checked });
});
retry.addEventListener("click", () => checkEngine({ retryEngine: true }));
checkEngine();
