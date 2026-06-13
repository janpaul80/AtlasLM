"use client";
import { useState } from "react";
import { SOURCE_TYPES, uploadSource, addUrlSource, type SourceKind } from "@/lib/sources";

const ORANGE = "#FF5A1F";
const PANEL = "#101018";
const CARD = "#15151F";
const BORDER = "rgba(255,255,255,0.07)";

export default function AddSourceModal({
  notebookId,
  token,
  onClose,
  onAdded,
}: {
  notebookId: string;
  token: string;
  onClose: () => void;
  onAdded?: (result: any) => void;
}) {
  const [active, setActive] = useState<SourceKind | null>(null);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const meta = (id: string) => SOURCE_TYPES.find((t) => t.id === id)!;

  async function handleFile(file: File) {
    setBusy(true); setErr(null);
    try {
      const res = await uploadSource(notebookId, file, token);
      onAdded?.(res); onClose();
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }

  async function handleUrl() {
    if (!url.trim()) return;
    setBusy(true); setErr(null);
    try {
      const res = await addUrlSource(notebookId, url.trim(), token);
      onAdded?.(res); onClose();
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)" }} onClick={onClose}>
      <div className="w-full max-w-xl rounded-2xl border" style={{ background: CARD, borderColor: BORDER }}
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 p-4 border-b" style={{ borderColor: BORDER }}>
          <span className="font-semibold text-[15px] text-slate-100">Add a source</span>
          <button onClick={onClose} className="ml-auto p-2 rounded-md hover:bg-white/5 text-slate-400">✕</button>
        </div>

        <div className="p-4">
          <div className="grid grid-cols-4 gap-2 mb-4">
            {SOURCE_TYPES.map((t) => (
              <button key={t.id} onClick={() => { setActive(t.id as SourceKind); setErr(null); }}
                className="relative flex flex-col items-center gap-1.5 p-3 rounded-xl border transition"
                style={{
                  background: active === t.id ? `${t.color}14` : PANEL,
                  borderColor: active === t.id ? `${t.color}66` : BORDER,
                }}>
                {t.status === "new" && (
                  <span className="absolute top-1 right-1 text-[8px] px-1 py-0.5 rounded text-white"
                    style={{ background: ORANGE }}>NEW</span>
                )}
                <span className="h-5 w-5 rounded" style={{ background: t.color }} />
                <span className="text-[10.5px] text-slate-300 text-center leading-tight">{t.label}</span>
              </button>
            ))}
          </div>

          {active && (
            <div className="rounded-xl border p-4" style={{ background: PANEL, borderColor: BORDER }}>
              {meta(active).accept === "url" ? (
                <>
                  <label className="text-[12px] text-slate-400">
                    {active === "youtube" ? "YouTube URL" : "Website URL"}
                  </label>
                  <div className="flex gap-2 mt-1.5">
                    <input value={url} onChange={(e) => setUrl(e.target.value)}
                      placeholder={active === "youtube" ? "https://youtube.com/watch?v=…" : "https://…"}
                      className="flex-1 min-w-0 rounded-lg px-3 py-2 text-[13px] outline-none text-slate-100"
                      style={{ background: "#0A0A0F", border: `1px solid ${BORDER}` }} />
                    <button disabled={busy} onClick={handleUrl}
                      className="shrink-0 px-4 py-2 rounded-lg text-[13px] font-medium text-white disabled:opacity-50"
                      style={{ background: ORANGE }}>{busy ? "Adding…" : "Add"}</button>
                  </div>
                  {active === "youtube" && (
                    <p className="text-[11px] text-slate-500 mt-2">
                      Captions are used when available; offline Whisper transcribes if not.
                    </p>
                  )}
                </>
              ) : (
                <label className="block border-2 border-dashed rounded-xl p-6 text-center cursor-pointer"
                  style={{ borderColor: BORDER }}>
                  <input type="file" accept={meta(active).accept} className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
                  <div className="text-[13px] text-slate-300">
                    {busy ? "Ingesting…" : `Click to upload ${meta(active).label}`}
                  </div>
                  <div className="text-[11px] text-slate-600 mt-1">Accepted: {meta(active).accept}</div>
                </label>
              )}
              <div className="mt-3 text-[11px] text-slate-500">Pipeline: {meta(active).pipeline}</div>
              {err && <div className="mt-2 text-[12px] text-red-400">{err}</div>}
            </div>
          )}

          {!active && (
            <div className="text-center text-[12px] text-slate-500 py-2">
              Select a source type to continue
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
