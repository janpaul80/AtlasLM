"use client";
import { useState } from "react";
import { STUDIO_OUTPUTS, generateStudio, type StudioType } from "@/lib/studio";
import StudioModal from "./StudioModal";
import AudioOverviewPanel from "@/app/components/audio/AudioOverviewPanel";

const ORANGE = "#FF5A1F";

export default function StudioPanel({
  notebookId,
  selectedSourceIds,
  token,
}: {
  notebookId: string;
  selectedSourceIds: string[];
  token: string;
}) {
  const [open, setOpen] = useState<StudioType | null>(null);
  const [phase, setPhase] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [result, setResult] = useState<any>(null);

  async function run(type: StudioType) {
    setOpen(type);
    setPhase("loading");
    setResult(null);
    try {
      const data = await generateStudio(type, notebookId, selectedSourceIds, token);
      setResult(data);
      setPhase(data?.empty? "error": "done");
    } catch {
      setPhase("error");
    }
  }

  return (
    <aside className="w-[340px] shrink-0 flex flex-col bg-[#101018]">
      <div className="h-14 flex items-center gap-2 px-4 border-b border-white/5">
        <span className="font-medium text-[15px] text-slate-100">Studio</span>
        <span
          className="ml-auto text-[10px] px-2 py-0.5 rounded-full"
          style={{ background: "rgba(255,90,31,0.12)", color: ORANGE }}
        >
          citation-backed
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {STUDIO_OUTPUTS.map((s) => (
          <button
            key={s.id}
            onClick={() => run(s.id as StudioType)}
            className="w-full flex items-center gap-3 p-3 rounded-xl border border-white/5 bg-[#15151F] text-left hover:-translate-y-0.5 transition"
          >
            <span className="h-10 w-10 rounded-lg shrink-0" style={{ background: `${s.tint}1A` }} />
            <span className="min-w-0 flex-1">
              <span className="block text-[13.5px] font-medium text-slate-100">{s.label}</span>
              <span className="block text-[11px] text-slate-500 leading-snug">{s.desc}</span>
            </span>
          </button>
        ))}

        <div className="border-t border-white/5 pt-3 mt-3">
          <AudioOverviewPanel
            workspaceId={notebookId}
            token={token}
            docIds={selectedSourceIds}
          />
        </div>
      </div>

      <div className="p-3 border-t border-white/5 text-[11px] text-slate-500">
        Outputs draw only from your selected sources.
      </div>

      {open && (
        <StudioModal
          type={open}
          phase={phase}
          result={result}
          onClose={() => {
            setOpen(null);
            setPhase("idle");
          }}
          onRegenerate={() => run(open)}
        />
      )}
    </aside>
  );
}
