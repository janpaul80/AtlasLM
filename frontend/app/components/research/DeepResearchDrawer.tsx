// frontend/app/components/research/DeepResearchDrawer.tsx
"use client";
import { useEffect, useRef, useState } from "react";
import {
  searchResearch, ingestResearch, pollResearchJob, type ResearchResult,
} from "@/lib/research";

type Props = {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
  token: string;                       // Supabase access token
  onIngested?: (sources: any[]) => void;  // refresh the sources column
};

export default function DeepResearchDrawer({
  open, onClose, workspaceId, token, onIngested,
}: Props) {
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState({ web: true, academic: true });
  const [phase, setPhase] = useState<"idle"|"searching"|"results"|"ingesting">("idle");
  const [results, setResults] = useState<ResearchResult[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => () => { timers.current.forEach(clearTimeout); }, []);

  const selectedCount = Object.values(selected).filter(Boolean).length;

  async function runSearch() {
    if (!query.trim() || phase === "searching") return;
    setError(null); setPhase("searching"); setResults([]); setSelected({});
    try {
      const { results } = await searchResearch(workspaceId, token, {
        query, web: scope.web, academic: scope.academic,
      });
      setResults(results);
      setPhase("results");
    } catch (e) {
      setError("Deep Research is temporarily unavailable. Try again shortly.");
      setPhase("idle");
    }
  }

  function toggle(id: string) {
    setSelected((s) => ({ ...s, [id]: !s[id] }));
  }

  async function ingestSelected() {
    const picks = results.filter((r) => selected[r.id]);
    if (!picks.length) return;
    setPhase("ingesting");
    try {
      const { job_id } = await ingestResearch(workspaceId, token, query, picks);
      // poll until done
      const poll = async () => {
        const job = await pollResearchJob(token, job_id);
        if (job.status === "done") {
          onIngested?.(job.result?.sources ?? []);
          setPhase("idle"); setQuery(""); setResults([]); setSelected({});
          onClose();
        } else if (job.status === "error") {
          setError("Ingestion failed. Please try again.");
          setPhase("results");
        } else {
          timers.current.push(window.setTimeout(poll, 1200));
        }
      };
      poll();
    } catch {
      setError("Ingestion failed. Please try again.");
      setPhase("results");
    }
  }

  if (!open) return null;

  return (
    <div className="dr-overlay" onClick={() => phase !== "ingesting" && onClose()}>
      <div className="dr-drawer" onClick={(e) => e.stopPropagation()}>
        <header className="dr-head">
          <span className="dr-ico">🔭</span>
          <div>
            <div className="dr-title">Deep Research</div>
            <div className="dr-sub">Search the web + academic papers, merged with your notebook</div>
          </div>
          <button className="dr-x" onClick={() => phase !== "ingesting" && onClose()}>✕</button>
        </header>

        <div className="dr-query">
          <div className="dr-input">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runSearch()}
              placeholder="e.g. NRR benchmarks for B2B SaaS in 2026"
            />
            <button onClick={runSearch} disabled={phase === "searching"}>Research</button>
          </div>
          <div className="dr-scopes">
            <label><input type="checkbox" checked={scope.web}
              onChange={() => setScope((s) => ({ ...s, web: !s.web }))} /> Web</label>
            <label><input type="checkbox" checked={scope.academic}
              onChange={() => setScope((s) => ({ ...s, academic: !s.academic }))} /> Academic (arXiv + Crossref)</label>
          </div>
        </div>

        <div className="dr-body">
          {error && <div className="dr-error">{error}</div>}
          {phase === "idle" && !error && (
            <div className="dr-empty">Enter a research question to search beyond your notebook.</div>
          )}
          {phase === "searching" && <div className="dr-empty">Searching…</div>}
          {(phase === "results" || phase === "ingesting") && results.map((r) => (
            <button key={r.id} className={`dr-card ${selected[r.id] ? "on" : ""}`}
              onClick={() => toggle(r.id)}>
              <span className="dr-tag">{r.type === "web" ? "Web" : r.source_label}</span>
              <span className="dr-meta">{r.type === "web" ? r.domain : r.venue}</span>
              <div className="dr-card-title">{r.title}</div>
              {r.type === "academic" && <div className="dr-authors">{r.authors} · {r.year}</div>}
              <div className="dr-snip">{r.snippet}</div>
            </button>
          ))}
          {phase !== "searching" && !results.length && phase !== "idle" && !error &&
            <div className="dr-empty">No results. Try a different query or enable more scopes.</div>}
        </div>

        {(phase === "results" || phase === "ingesting") && (
          <footer className="dr-foot">
            <span>{selectedCount} selected · ingested as labeled Deep Research sources</span>
            <button disabled={!selectedCount || phase === "ingesting"} onClick={ingestSelected}>
              {phase === "ingesting" ? "Ingesting…" : "Add to notebook"}
            </button>
          </footer>
        )}
      </div>
    </div>
  );
}
