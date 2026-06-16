"use client";
import { useState } from "react";
import type { StudioType } from "@/lib/studio";

const ORANGE = "#FF5A1F";
const PANEL = "#101018";
const CARD = "#15151F";
const BORDER = "rgba(255,255,255,0.07)";

const TITLES: Record<StudioType, string> = {
  report: "Report",
  mindmap: "Mind Map",
  flashcards: "Flashcards",
  quiz: "Quiz",
  table: "Data Table",
  slides: "Slide Deck",
  audio: "Audio Overview",
};

function Badge({ n }: { n: number }) {
  return (
    <span
      className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded align-middle"
      style={{ background: "rgba(255,90,31,0.14)", color: ORANGE, border: "1px solid rgba(255,90,31,0.25)" }}
    >
      [{n}]
    </span>
  );
}

export default function StudioModal({
  type,
  phase,
  result,
  onClose,
  onRegenerate,
}: {
  type: StudioType;
  phase: "idle" | "loading" | "done" | "error";
  result: any;
  onClose: () => void;
  onRegenerate: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl border flex flex-col max-h-[88vh]"
        style={{ background: CARD, borderColor: BORDER }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 p-4 border-b" style={{ borderColor: BORDER }}>
          <div className="font-semibold text-[15px] text-slate-100">{TITLES[type]}</div>
          <div className="text-[11px] text-slate-500">AtlasLM Studio</div>
          <button onClick={onClose} className="ml-auto p-2 rounded-md hover:bg-white/5 text-slate-400">
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 text-slate-200">
          {phase === "loading" && (
            <div className="py-16 flex flex-col items-center gap-3 text-slate-400">
              <div
                className="h-7 w-7 rounded-full border-2 animate-spin"
                style={{ borderColor: `${ORANGE}40`, borderTopColor: ORANGE }}
              />
              <p className="text-sm">Generating {TITLES[type].toLowerCase()} from your sources...</p>
            </div>
          )}

          {phase === "error" && (
            <div className="py-16 text-center text-slate-400">
              {result?.message?? "AtlasLM Engine could not generate this output. Please retry."}
            </div>
          )}

          {phase === "done" && result?.data && (
            <Renderer type={type} data={result.data} citations={result.citations} />
          )}
        </div>

        {phase === "done" && (
          <div className="flex items-center gap-2 p-4 border-t" style={{ borderColor: BORDER }}>
            <button
              onClick={onRegenerate}
              className="text-[13px] px-3 py-2 rounded-lg border text-slate-300 hover:bg-white/5"
              style={{ borderColor: BORDER }}
            >
              Regenerate
            </button>
            <button
              onClick={() => navigator.clipboard?.writeText(JSON.stringify(result.data, null, 2))}
              className="text-[13px] px-3 py-2 rounded-lg border text-slate-300 hover:bg-white/5"
              style={{ borderColor: BORDER }}
            >
              Copy
            </button>
            <button
              className="ml-auto text-[13px] px-4 py-2 rounded-lg font-medium text-white"
              style={{ background: ORANGE }}
            >
              Export
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Renderer({ type, data, citations }: { type: StudioType; data: any; citations: any }) {
  const [card, setCard] = useState(0);
  const [flip, setFlip] = useState(false);
  const [picked, setPicked] = useState<Record<number, number>>({});
  const [slide, setSlide] = useState(0);
  const [playing, setPlaying] = useState(false);

  if (type === "report") {
    return (
      <article className="space-y-4">
        <h3 className="text-lg font-semibold">{data.title}</h3>
        {(data.sections?? []).map((s: any, i: number) => (
          <div key={i}>
            <h4 className="text-[13px] font-semibold uppercase tracking-wide text-slate-400 mb-1">{s.h}</h4>
            <p className="text-[14px] leading-relaxed">
              {s.b} {(s.cites?? []).map((c: number) => <Badge key={c} n={c} />)}
            </p>
          </div>
        ))}
      </article>
    );
  }

  if (type === "mindmap") {
    const colors = ["#22C55E", "#EF4444", "#EAB308", "#3B82F6", "#A855F7"];
    return (
      <div className="flex flex-col items-center py-4">
        <div className="px-5 py-2.5 rounded-full font-semibold text-white mb-5" style={{ background: ORANGE }}>
          {data.root}
        </div>
        <div className="grid grid-cols-3 gap-3 w-full">
          {(data.branches?? []).map((b: any, bi: number) => {
            const color = colors[bi % colors.length];
            return (
              <div key={bi} className="rounded-xl border p-3" style={{ borderColor: `${color}40`, background: `${color}0D` }}>
                <div className="text-[13px] font-semibold mb-2" style={{ color }}>{b.label}</div>
                <ul className="space-y-1.5">
                  {(b.kids?? []).map((k: string, ki: number) => (
                    <li key={ki} className="text-[12px] text-slate-300 flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
                      {k}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (type === "flashcards") {
    const cards = data.cards?? [];
    if (!cards.length) return <p className="text-slate-400">No cards generated.</p>;
    const c = cards[card];
    return (
      <div className="flex flex-col items-center">
        <div
          onClick={() => setFlip((f) =>!f)}
          className="w-full h-52 rounded-2xl border flex items-center justify-center text-center px-8 cursor-pointer select-none"
          style={{ background: PANEL, borderColor: BORDER }}
        >
          {!flip? (
            <p className="text-[16px] font-medium">{c.q}</p>
          ): (
            <p className="text-[15px] text-slate-200">{c.a} {c.cite!= null && <Badge n={c.cite} />}</p>
          )}
        </div>
        <p className="text-[11px] text-slate-500 mt-2">Tap card to flip</p>
        <div className="flex items-center gap-4 mt-3">
          <span className="text-[12px] text-slate-400">{card + 1} / {cards.length}</span>
          <button
            onClick={() => { setCard((x) => (x + 1) % cards.length); setFlip(false); }}
            className="text-[13px] px-4 py-1.5 rounded-lg font-medium text-white"
            style={{ background: ORANGE }}
          >
            Next →
          </button>
        </div>
      </div>
    );
  }

  if (type === "quiz") {
    const qs = data.questions?? [];
    return (
      <div className="space-y-5">
        {qs.map((q: any, qi: number) => (
          <div key={qi}>
            <p className="text-[14px] font-medium mb-2">
              {qi + 1}. {q.q} {q.cite!= null && <Badge n={q.cite} />}
            </p>
            <div className="space-y-1.5">
              {(q.opts?? []).map((o: string, oi: number) => {
                const chosen = picked[qi] === oi;
                const reveal = picked[qi]!= null;
                const correct = oi === q.correct;
                return (
                  <button
                    key={oi}
                    disabled={reveal}
                    onClick={() => setPicked((p) => ({...p, [qi]: oi }))}
                    className="w-full text-left px-3 py-2 rounded-lg border text-[13px] flex items-center gap-2"
                    style={{
                      background: reveal && correct? "rgba(34,197,94,0.12)": chosen? "rgba(239,68,68,0.12)": PANEL,
                      borderColor: reveal && correct? "#22C55E55": chosen? "#EF444455": BORDER,
                    }}
                  >
                    <span className="flex-1">{o}</span>
                    {reveal && correct && <span className="text-green-400">✓</span>}
                    {reveal && chosen &&!correct && <span className="text-red-400">✕</span>}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (type === "table") {
    return (
      <div className="overflow-hidden rounded-xl border" style={{ borderColor: BORDER }}>
        <table className="w-full text-[13px]">
          <thead>
            <tr style={{ background: PANEL }}>
              {(data.cols?? []).map((c: string, i: number) => (
                <th key={i} className="text-left px-3 py-2 font-semibold text-slate-300">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(data.rows?? []).map((r: any[], i: number) => (
              <tr key={i} className="border-t" style={{ borderColor: BORDER }}>
                {r.map((cell, ci) => (
                  <td key={ci} className="px-3 py-2 text-slate-300">
                    {ci === r.length - 1? <Badge n={Number(cell)} />: String(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (type === "slides") {
    const slides = data.slides?? [];
    if (!slides.length) return <p className="text-slate-400">No slides generated.</p>;
    return (
      <div>
        <div
          className="aspect-video rounded-xl border flex flex-col items-center justify-center text-center p-8"
          style={{ background: "linear-gradient(135deg,#15151F,#0A0A0F)", borderColor: BORDER }}
        >
          <div className="text-[11px] uppercase tracking-widest mb-3" style={{ color: ORANGE }}>
            AtlasLM · Slide {slide + 1}
          </div>
          <h3 className="text-2xl font-bold mb-2">{slides[slide].t}</h3>
          <p className="text-slate-400 text-sm">{slides[slide].s}</p>
        </div>
        <div className="flex items-center justify-center gap-2 mt-3">
          {slides.map((_: any, i: number) => (
            <button
              key={i}
              onClick={() => setSlide(i)}
              className="h-1.5 rounded-full transition-all"
              style={{ width: i === slide? 22: 7, background: i === slide? ORANGE: "#444" }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (type === "audio") {
    const script = data.script?? [];
    return (
      <div>
        <div className="text-center py-4">
          <button
            onClick={() => setPlaying((p) =>!p)}
            className="h-16 w-16 rounded-full flex items-center justify-center text-white mx-auto"
            style={{ background: "#EC4899" }}
          >
            {playing? "❚❚": "▶"}
          </button>
          <p className="font-medium text-[15px] mt-3">{data.title?? "Audio Overview"}</p>
          <p className="text-[12px] text-slate-500">Podcast-style · two AI hosts</p>
        </div>
        <div className="space-y-2 mt-2 max-h-56 overflow-y-auto">
          {script.map((s: any, i: number) => (
            <p key={i} className="text-[13px]">
              <span className="font-semibold" style={{ color: ORANGE }}>{s.speaker}: </span>
              <span className="text-slate-300">{s.line}</span>
            </p>
          ))}
        </div>
        <p className="text-[11px] text-slate-500 mt-3">
          Spoken audio is rendered server-side (TTS) in a follow-up patch.
        </p>
      </div>
    );
  }

  return null;
}
