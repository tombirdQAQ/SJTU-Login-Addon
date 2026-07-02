import {
  getEngineStatus,
  initializeEngine,
  recognizeCaptcha
} from "./ocr.js";

chrome.runtime.onInstalled.addListener(() => {
  initializeEngine().catch(() => {});
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "engine-status") {
    if (message.retry || getEngineStatus().status === "idle") {
      initializeEngine({ retry: Boolean(message.retry) }).catch(() => {});
    }
    sendResponse(getEngineStatus());
    return false;
  }

  if (message?.type === "ocr") {
    recognizeCaptcha(message.image)
      .then((text) => sendResponse({ ok: true, text }))
      .catch((error) =>
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : String(error)
        })
      );
    return true;
  }

  return false;
});
