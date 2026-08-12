import { createWorker } from 'tesseract.js';

// A fresh Tesseract worker takes 5-10s to spin up (loading the eng+fra language models), so a
// worker created per receipt upload would pay that cost on every request. Keeping one
// process-lifetime worker means only the very first OCR call after server startup pays it —
// every call after reuses the already-initialized worker (~1-3s per recognize() call).
let ocrWorker: Awaited<ReturnType<typeof createWorker>> | null = null;
let ocrWorkerPromise: Promise<Awaited<ReturnType<typeof createWorker>>> | null = null;

export async function getOcrWorker() {
  if (ocrWorker) return ocrWorker;
  // Deduped so two receipt uploads racing before the first worker finishes initializing don't
  // each spin up their own — only one createWorker() call ever happens per process lifetime.
  if (!ocrWorkerPromise) {
    ocrWorkerPromise = createWorker('eng+fra', 1, { logger: () => {} });
  }
  ocrWorker = await ocrWorkerPromise;
  return ocrWorker;
}

export async function terminateOcrWorker(): Promise<void> {
  const worker = ocrWorker;
  ocrWorker = null;
  ocrWorkerPromise = null;
  await worker?.terminate();
}
