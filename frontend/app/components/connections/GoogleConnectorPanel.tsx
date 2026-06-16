"use client";
// frontend/app/components/connections/GoogleConnectorPanel.tsx
// Patch 011 - Settings panel: connect Google, pick files via the Google Picker,
// import into the workspace, and manage/disconnect. Full OAuth runs server-side;
// this component only kicks off consent and drives the Picker.
import { useEffect, useState, useCallback } from "react";
import {
  getStatus, startConnect, getPickerConfig, openPicker, ingestFiles, disconnect,
  type ConnStatus, type IngestResult,
} from "@/lib/connections";
import "./connections.css";

type Props = { workspaceId: string; token: string };

export default function GoogleConnectorPanel({ workspaceId, token }: Props) {
  const [status, setStatusState] = useState<ConnStatus>({ connected: false });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<IngestResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try { setStatusState(await getStatus(workspaceId, token)); }
    finally { setLoading(false); }
  }, [workspaceId, token]);

  useEffect(() => {
    refresh();
    // Reflect the callback redirect result, if present.
    const p = new URLSearchParams(window.location.search).get("google");
    if (p === "error") setError("Google sign-in did not complete. Please try again.");
  }, [refresh]);

  async function onConnect() {
    setError(null);
    try { await startConnect(workspaceId, token); }
    catch (e: any) { setError(e.message || "Could not start the connection."); }
  }

  async function onPickAndImport() {
    setError(null); setResult(null); setBusy(true);
    try {
      const cfg = await getPickerConfig(workspaceId, token);
      const ids = await openPicker(cfg);
      if (ids.length === 0) { setBusy(false); return; }
      setResult(await ingestFiles(workspaceId, ids, token));
    } catch (e: any) {
      setError(e.message || "Import failed.");
    } finally { setBusy(false); }
  }

  async function onDisconnect() {
    setBusy(true);
    try { await disconnect(workspaceId, token); setResult(null); await refresh(); }
    finally { setBusy(false); }
  }

  if (loading) {
    return <div className="gc-card gc-muted">Loading connection...</div>;
  }

  return (
    <div className="gc-card">
      <div className="gc-head">
        <span className="gc-glyph" aria-hidden>{googleG}</span>
        <div className="gc-head-text">
          <div className="gc-title">
            Google Workspace
            {status.connected && (
              <span className="gc-badge"><span className="gc-dot" /> Connected</span>
            )}
          </div>
          <div className="gc-sub">
            {status.connected? status.account_email: "Bring Docs, Sheets, Slides, and PDFs from Drive."}
          </div>
        </div>
        <span className="gc-lock" title="Tokens are encrypted at rest">{lockIcon} Encrypted</span>
      </div>

      {error && <div className="gc-error" role="alert">{error}</div>}

      {!status.connected? (
        <div className="gc-connect">
          <p className="gc-blurb">
            You choose exactly which files to bring in. AtlasLM never browses your whole Drive.
          </p>
          <button className="gc-google-btn" onClick={onConnect}>
            <span className="gc-glyph-sm" aria-hidden>{googleG}</span>
            Connect Google Drive
          </button>
          <ul className="gc-assure">
            <li>You pick each file</li>
            <li>Encrypted token vault</li>
            <li>Revoke any time</li>
          </ul>
        </div>
      ): (
        <div className="gc-manage">
          <div className="gc-actions">
            <button className="gc-primary" onClick={onPickAndImport} disabled={busy}>
              {busy? "Working...": "Add files from Drive"}
            </button>
            <button className="gc-danger" onClick={onDisconnect} disabled={busy}>
              Disconnect
            </button>
          </div>

          {result && (
            <div className="gc-result">
              <div className="gc-result-head">
                Imported {result.ok_count} of {result.imported.length}
                {result.fail_count > 0 && <span className="gc-fail"> ({result.fail_count} failed)</span>}
              </div>
              <ul className="gc-files">
                {result.imported.map((f) => (
                  <li key={f.id} className={f.ok? "ok": "bad"}>
                    <span className="gc-file-name">{f.name}</span>
                    <span className="gc-kind">{f.kind}</span>
                    <span className="gc-state">
                      {f.ok? `synced (${f.blocks} blocks)`: (f.error || "failed")}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const googleG = (
  <svg width="18" height="18" viewBox="0 0 48 48">
    <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.8 6.1C12.3 13.2 17.6 9.5 24 9.5z"/>
    <path fill="#4285F4" d="M46.1 24.6c0-1.6-.1-3.2-.4-4.6H24v9.1h12.4c-.5 2.9-2.1 5.3-4.6 7l7.2 5.6c4.2-3.9 6.6-9.6 6.6-17.1z"/>
    <path fill="#FBBC05" d="M10.4 28.7c-.5-1.4-.8-2.9-.8-4.7s.3-3.3.8-4.7l-7.8-6.1C1 16.5 0 20.1 0 24s1 7.5 2.6 10.8l7.8-6.1z"/>
    <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.2-5.6c-2 1.4-4.6 2.2-8.7 2.2-6.4 0-11.7-3.7-13.6-8.9l-7.8 6.1C6.5 42.6 14.6 48 24 48z"/>
  </svg>
);
const lockIcon = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="5" y="11" width="14" height="10" /><path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </svg>
);
