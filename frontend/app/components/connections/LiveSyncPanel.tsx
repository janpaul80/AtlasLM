"use client";
// frontend/app/components/connections/LiveSyncPanel.tsx
// Patch 012 - per-source live-sync controls under the Google connector.
// Master toggle governs the whole connection; per-source switches default off.
// Brand colors come from atlas-theme.css variables.
import { useEffect, useState, useCallback } from "react";
import { listLiveSync, setLiveSync, type LiveSource } from "@/lib/livesync";
import "./livesync.css";

type SourceRow = { source_id: string; file_id: string; name: string; kind: string };
type Props = { workspaceId: string; token: string; sources: SourceRow[] };

function relTime(epoch?: number): string {
  if (!epoch) return "never";
  const s = Math.max(0, Math.floor(Date.now() / 1000 - epoch));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function LiveSyncPanel({ workspaceId, token, sources }: Props) {
  const [master, setMaster] = useState(true);
  const [live, setLive] = useState<Record<string, LiveSource>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const rows = await listLiveSync(workspaceId, token);
    setLive(Object.fromEntries(rows.map((r) => [r.source_id, r])));
  }, [workspaceId, token]);

  useEffect(() => { refresh(); }, [refresh]);

  async function toggle(row: SourceRow) {
    setError(null);
    const currentlyLive = !!live[row.source_id]?.live;
    setBusy(row.source_id);
    try {
      await setLiveSync(workspaceId, row.source_id, row.file_id, !currentlyLive, token);
      await refresh();
    } catch (e: any) {
      setError(e.message || "Could not update live sync.");
    } finally { setBusy(null); }
  }

  const liveCount = Object.values(live).filter((l) => l.live).length;

  return (
    <div className="ls-wrap">
      <div className="ls-master">
        <span className="ls-bolt" data-on={master} aria-hidden>{boltIcon}</span>
        <div className="ls-master-text">
          <div className="ls-title">Live sync</div>
          <div className="ls-sub">
            {master
              ? `Files you turn on update automatically when they change in Drive. ${liveCount} on.`
              : "Paused for the whole connection. Per-file switches stay set."}
          </div>
        </div>
        <button className="ls-toggle" data-on={master} onClick={() => setMaster((m) => !m)}
                aria-pressed={master} aria-label="Toggle live sync for the connection">
          <span className="ls-knob" />
        </button>
      </div>

      {error && <div className="ls-error" role="alert">{error}</div>}

      <div className="ls-list">
        <div className="ls-list-head">Imported from Drive ({sources.length})</div>
        {sources.map((row) => {
          const ls = live[row.source_id];
          const on = !!ls?.live;
          const shown = !master && on ? "Paused" : on ? "Synced" : "Not syncing";
          const cls = !master && on ? "paused" : on ? "synced" : "off";
          return (
            <div className="ls-row" key={row.source_id}>
              <div className="ls-row-main">
                <div className="ls-name">{row.name}</div>
                <div className="ls-meta">
                  <span className="ls-kind">{row.kind}</span>
                  <span className={`ls-status ${cls}`}>{shown}</span>
                  {on && <span className="ls-when">updated {relTime(ls?.last_synced)}</span>}
                </div>
              </div>
              <button className="ls-toggle" data-on={on} disabled={busy === row.source_id}
                      onClick={() => toggle(row)} aria-pressed={on}
                      aria-label={`Live sync ${row.name}`}>
                <span className="ls-knob" />
              </button>
            </div>
          );
        })}
        {sources.length === 0 && (
          <div className="ls-empty">Import files from Drive to enable live sync.</div>
        )}
      </div>
    </div>
  );
}

const boltIcon = (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z" />
  </svg>
);
