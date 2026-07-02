import * as ort from "/node_modules/onnxruntime-web/dist/ort.wasm.bundle.min.mjs";
import { decodeCtc } from "/extension/ctc.js";

const result = document.querySelector("#result");
ort.env.wasm.numThreads = 1;
ort.env.wasm.proxy = false;
ort.env.wasm.wasmPaths = "/node_modules/onnxruntime-web/dist/";

try {
  const [session, charset, image] = await Promise.all([
    ort.InferenceSession.create("/extension/assets/common.onnx", {
      executionProviders: ["wasm"]
    }),
    fetch("/extension/assets/charset-beta.json").then((response) =>
      response.json()
    ),
    loadImage("/tests/fixtures/jaccount-captcha.png")
  ]);
  const targetHeight = 64;
  const width = Math.trunc(image.naturalWidth * (targetHeight / image.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = targetHeight;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(image, 0, 0, width, targetHeight);
  const rgba = context.getImageData(0, 0, width, targetHeight).data;
  const data = new Float32Array(width * targetHeight);
  for (let pixel = 0, offset = 0; pixel < data.length; pixel++, offset += 4) {
    data[pixel] =
      (rgba[offset] * 0.299 +
        rgba[offset + 1] * 0.587 +
        rgba[offset + 2] * 0.114) /
      255;
  }
  const tensor = new ort.Tensor("float32", data, [1, 1, targetHeight, width]);
  const output = await session.run({ [session.inputNames[0]]: tensor });
  const value = output[session.outputNames[0]];
  result.textContent = decodeCtc(value.data, value.dims, charset);
  result.dataset.status = "ready";
} catch (error) {
  result.textContent = error instanceof Error ? error.stack : String(error);
  result.dataset.status = "error";
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`图片加载失败：${url}`));
    image.src = url;
  });
}
