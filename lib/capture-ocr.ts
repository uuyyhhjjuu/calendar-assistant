import { validateCaptureImage } from "./capture-parser";

export async function recognizeScreenshot(
  file: File,
  signal: AbortSignal,
  onProgress: (message: string) => void,
): Promise<string> {
  const validation = validateCaptureImage(file);
  if (validation) throw new Error(validation);
  const imageUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = imageUrl;
    await image.decode();
    if (image.naturalWidth * image.naturalHeight > 12_000_000) {
      throw new Error("图片尺寸太大，请先裁剪到日程文字区域。");
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("裁剪")) throw error;
    throw new Error("无法读取图片，请换一张清晰截图。");
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
  signal.throwIfAborted();
  const { createWorker, PSM } = await import("tesseract.js");
  signal.throwIfAborted();
  const base = new URL("/ocr/", window.location.origin).href;
  let worker: Awaited<ReturnType<typeof createWorker>> | undefined;
  let cancelled = false;
  let rejectAborted: (error: Error) => void = () => {};
  const aborted = new Promise<never>((_, reject) => { rejectAborted = reject; });
  const cancel = () => {
    cancelled = true;
    rejectAborted(new DOMException("已取消识别", "AbortError"));
    if (worker) void worker.terminate().catch(() => {});
  };
  signal.addEventListener("abort", cancel, { once: true });
  const timeout = window.setTimeout(cancel, 120_000);
  try {
    const ready = createWorker(["chi_sim", "eng"], 1, {
      workerPath: `${base}worker.min.js`,
      corePath: base,
      langPath: base,
      workerBlobURL: false,
      cacheMethod: "none",
      errorHandler: () => {},
      logger: ({ status, progress }) => {
        if (!signal.aborted && !cancelled) onProgress(status === "recognizing text"
          ? `正在读取截图文字 ${Math.round(progress * 100)}%`
          : "正在加载本地识别组件，首次需要稍等…");
      },
    }).then((value) => {
      worker = value;
      if (signal.aborted || cancelled) { void value.terminate().catch(() => {}); throw new DOMException("已取消识别", "AbortError"); }
      return value;
    });
    worker = await Promise.race([ready, aborted]);
    await worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO });
    const { data } = await Promise.race([worker.recognize(file), aborted]);
    const text = data.text.trim();
    if (!text) throw new Error("没有读到文字，请裁剪截图或直接粘贴日程信息。");
    return text.slice(0, 8000);
  } finally {
    window.clearTimeout(timeout);
    signal.removeEventListener("abort", cancel);
    if (worker) await worker.terminate().catch(() => {});
  }
}
