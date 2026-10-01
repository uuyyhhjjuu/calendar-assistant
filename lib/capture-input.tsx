"use client";

import { useEffect, useRef, useState } from "react";
import { parseScheduleBatch, validateCaptureImage } from "./capture-parser";
import type { CapturedSchedule } from "./capture-parser";
import { getCaptureImage } from "./capture-transfer";

type RecognitionResult = { isFinal: boolean; 0: { transcript: string } };
type Recognition = {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((event: { results: ArrayLike<RecognitionResult> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void; stop: () => void; abort: () => void;
};
type SpeechWindow = Window & {
  SpeechRecognition?: new () => Recognition;
  webkitSpeechRecognition?: new () => Recognition;
};

export function CaptureInput({ referenceDay, onClose, onManual, onDrafts }: {
  referenceDay: string;
  onClose: () => void;
  onManual: () => void;
  onDrafts: (schedules: CapturedSchedule[]) => void;
}) {
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceConsent, setVoiceConsent] = useState(false);
  const [interim, setInterim] = useState("");
  const [source, setSource] = useState("文字");
  const [dragging, setDragging] = useState(false);
  const [analysis, setAnalysis] = useState<ReturnType<typeof parseScheduleBatch> | null>(null);
  const [selected, setSelected] = useState<boolean[]>([]);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const recognition = useRef<Recognition | null>(null);
  const controller = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    const focus = window.setTimeout(() => textarea.current?.focus(), 50);
    return () => {
      alive.current = false;
      generation.current += 1;
      window.clearTimeout(focus);
      controller.current?.abort();
      stopVoice(true);
    };
  }, []);

  function stopVoice(discard = false) {
    const speech = recognition.current;
    if (!speech) return;
    if (discard) {
      speech.onresult = null; speech.onerror = null; speech.onend = null;
      speech.abort(); recognition.current = null;
    } else speech.stop();
  }

  function askVoice() {
    const win = window as SpeechWindow;
    if (!win.SpeechRecognition && !win.webkitSpeechRecognition) {
      setError("这个浏览器不支持网页语音。iPhone 请点输入框，再点键盘上的麦克风听写；电脑可用系统听写。");
      textarea.current?.focus();
      return;
    }
    setVoiceConsent(true);
    setError("");
  }

  function startVoice() {
    setVoiceConsent(false);
    const win = window as SpeechWindow;
    const Constructor = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!Constructor) return;
    stopVoice(true);
    const speech = new Constructor();
    recognition.current = speech;
    speech.lang = "zh-CN";
    speech.continuous = false;
    speech.interimResults = true;
    let committed = "";
    speech.onresult = (event) => {
      if (!alive.current || recognition.current !== speech) return;
      let final = "", partial = "";
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) final += result[0].transcript;
        else partial += result[0].transcript;
      }
      const extra = final.slice(committed.length);
      if (extra) {
        committed = final;
        setText((current) => `${current}${current ? "\n" : ""}${extra}`.slice(0, 8000));
        setSource("语音");
      }
      setInterim(partial);
    };
    speech.onerror = (event) => {
      if (!alive.current || recognition.current !== speech) return;
      setError(event.error === "not-allowed" ? "麦克风未获授权，可改用键盘听写或粘贴文字。" : "语音转写未完成，可改用 iPhone 键盘听写；已转写的内容仍保留。");
      setListening(false);
    };
    speech.onend = () => {
      if (!alive.current || recognition.current !== speech) return;
      setListening(false); setInterim(""); recognition.current = null;
    };
    try { speech.start(); setListening(true); setError(""); }
    catch { recognition.current = null; setError("语音暂不可用，请使用键盘听写或输入文字。"); }
  }

  async function readScreenshot(file: File) {
    const validation = validateCaptureImage(file);
    if (validation) { setError(validation); return; }
    if (text.trim() && !window.confirm("识别结果会替换输入框中的文字。要继续吗？")) return;
    setAnalysis(null);
    stopVoice(true); setListening(false); setInterim("");
    const version = ++generation.current;
    const abort = new AbortController();
    controller.current = abort;
    setBusy(true); setError(""); setProgress("准备读取截图…");
    try {
      const { recognizeScreenshot } = await import("./capture-ocr");
      const result = await recognizeScreenshot(file, abort.signal, (message) => {
        if (alive.current && version === generation.current) setProgress(message);
      });
      if (!alive.current || version !== generation.current) return;
      setText(result); setSource("截图"); setProgress("已读取文字，请核对有无漏字或漏条，再分析日程。");
    } catch (failure) {
      if (!alive.current || version !== generation.current) return;
      setError(failure instanceof Error && failure.name !== "AbortError"
        ? failure.message.includes("图片") || failure.message.includes("文字") ? failure.message : "截图识别组件未能加载，请稍后再试或粘贴文字。"
        : "识别超时或已取消，请裁剪后重试，或粘贴文字。");
      setProgress("");
    } finally {
      if (alive.current && version === generation.current) { setBusy(false); controller.current = null; }
    }
  }

  function cancelOcr() {
    generation.current += 1;
    controller.current?.abort(); controller.current = null;
    setBusy(false); setProgress("已取消识别，没有保存任何内容。");
  }

  function makeDraft() {
    if (!text.trim()) { setError("先写一句日程，或选择截图 / 语音。"); return; }
    stopVoice(true);
    const result = parseScheduleBatch(text, referenceDay);
    if (!result.schedules.length) { setError(result.warnings.join(" ")); return; }
    if (result.schedules.length === 1) { onDrafts(result.schedules); return; }
    setAnalysis(result);
    setSelected(result.schedules.map(() => true));
    setError("");
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className={`modal capture-modal ${dragging ? "capture-dragging" : ""}`} role="dialog" aria-modal="true" aria-labelledby="capture-title"
        onPaste={(event) => {
          if (busy || listening) return;
          const image = getCaptureImage(event.clipboardData);
          if (image) { event.preventDefault(); void readScreenshot(image); }
        }}
        onDragOver={(event) => {
          if (event.dataTransfer.types.includes("Files")) { event.preventDefault(); setDragging(true); }
        }}
        onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false); }}
        onDrop={(event) => {
          if (!event.dataTransfer.types.includes("Files")) return;
          event.preventDefault(); setDragging(false);
          if (busy || listening) return;
          const image = getCaptureImage(event.dataTransfer);
          if (image) void readScreenshot(image);
          else setError("请拖入一张 PNG、JPG 或 WebP 截图，不支持图片网址。");
        }}>
        <header className="modal-header">
          <div><p className="eyebrow">QUICK CAPTURE</p><h3 id="capture-title">一句话，记下来</h3></div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="关闭便捷录入">×</button>
        </header>
        <p className="capture-intro">{analysis ? `识别到 ${analysis.schedules.length} 条安排，勾选需要的，再逐条确认。` : "不用逐项填写，先把安排放在这里。"}</p>
        {!analysis ? <div className="capture-tools">
          <button type="button" disabled={busy} className={listening ? "is-listening" : ""} onClick={() => listening ? stopVoice() : askVoice()}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="12" rx="3" /><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8" /></svg>
            {listening ? "结束语音" : "说一段"}
          </button>
          <button type="button" disabled={busy || listening} onClick={() => input.current?.click()}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="8" cy="8" r="1.5" /><path d="m4 17 5-5 4 4 3-3 5 5" /></svg>读取截图
          </button>
          <input ref={input} id="capture-file" type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(event) => {
            const file = event.target.files?.[0]; event.target.value = "";
            if (file) void readScreenshot(file);
          }} />
        </div> : null}
        {!analysis ? <p className="capture-paste-hint">电脑截图后，点下面输入框按 Ctrl+V（Mac：⌘V），或将图片拖进窗口，无需先保存文件。</p> : null}
        {voiceConsent ? <div className="capture-consent" role="alert">
          <p>网页语音由浏览器提供，可能将音频交给 Apple / Google 等语音服务处理，并非保证本机识别。本网站不保存录音。</p>
          <div><button type="button" onClick={() => setVoiceConsent(false)}>暂不用</button><button type="button" className="primary-btn" onClick={startVoice}>同意并开始语音</button></div>
        </div> : null}
        {!analysis ? <label className="capture-text-label">
          <span>日程信息 <small>{source} · 日期按北京时间理解</small></span>
          <textarea ref={textarea} id="capture-text" rows={6} maxLength={8000} disabled={busy || listening} value={text} onChange={(event) => { setText(event.target.value); setError(""); }} placeholder="例如：明天下午三点到四点，和产品团队开会&#10;也可以粘贴微信消息，或上传日程截图。" />
        </label> : <div className="capture-results">
          {analysis.warnings.map((warning) => <p className="capture-paste-hint" key={warning}>{warning}</p>)}
          <div className="capture-result-list">
            {analysis.schedules.map((item, index) => <article className="capture-result" key={index}>
              <label>
                <input type="checkbox" checked={selected[index]} onChange={(event) => setSelected((current) => current.map((value, position) => position === index ? event.target.checked : value))} />
                <span><strong>{item.draft.title || "标题待补充"}</strong><small>{item.draft.date || "日期待补充"} · {item.draft.startTime || "时间待定"}{item.draft.endTime ? `–${item.draft.endTime}` : ""}</small></span>
              </label>
              {item.warnings.length ? <p className="capture-result-warning">{item.warnings.join(" ")}</p> : null}
              <details><summary>核对这条原文</summary><p>{item.source}</p></details>
            </article>)}
          </div>
        </div>}
        {listening ? <p className="capture-progress" role="status">正在听… {interim || "请说出日期、时间和事项"}</p> : null}
        {progress ? <div className="capture-progress" role="status">{progress}{busy ? <button type="button" onClick={cancelOcr}>取消</button> : null}</div> : null}
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        <p className="capture-privacy">截图在当前浏览器内识别，不上传。多条安排会先拆分，确认后逐条保存到你的私密日历。</p>
        <footer className="modal-actions capture-actions">
          {analysis ? <>
            <button type="button" onClick={() => setAnalysis(null)}>返回原文</button>
            <button type="button" className="primary-btn" disabled={!selected.some(Boolean)} onClick={() => onDrafts(analysis.schedules.filter((_, index) => selected[index]))}>逐条确认（{selected.filter(Boolean).length}）→</button>
          </> : <>
            <button type="button" disabled={busy || listening} onClick={onManual}>手动填写</button>
            <button type="button" className="primary-btn" disabled={busy || listening || !text.trim()} onClick={makeDraft}>分析日程 →</button>
          </>}
        </footer>
      </section>
    </div>
  );
}
