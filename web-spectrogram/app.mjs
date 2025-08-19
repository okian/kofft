export async function initWasmWithThreadPool(initFn, threadPoolFn) {
  if (
    typeof SharedArrayBuffer === "undefined" ||
    !globalThis.crossOriginIsolated
  ) {
    console.error("SharedArrayBuffer or cross-origin isolation not available");
    return false;
  }
  await initFn();
  const threads = (typeof navigator !== "undefined" && navigator.hardwareConcurrency) || 4;
  await threadPoolFn(threads);
  return true;
}

export async function initSpectrogram() {
  const module = await import("./wasm/web_spectrogram.js");
  return initWasmWithThreadPool(module.default, module.initThreadPool);
}

if (typeof window !== "undefined") {
  initSpectrogram();
}
