// frontend/lib/connections.ts
// Client wrapper for the Patch 011 Google Workspace connector endpoints.
// Reuses the same auth token the rest of the dashboard uses.
const API = (process.env.NEXT_PUBLIC_API_BASE || "").replace(/\/$/, "") || "/api/v1";

function authHeaders(token: string): HeadersInit {
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

export type ConnStatus = { connected: boolean; account_email?: string; scope?: string };

export type PickerConfig = {
  access_token: string;
  app_id: string;
  api_key: string;
  client_id: string;
};

export type IngestResult = {
  imported: { id: string; name: string; kind: string; ok: boolean; blocks: number; error?: string }[];
  ok_count: number;
  fail_count: number;
};

export async function getStatus(workspaceId: string, token: string): Promise<ConnStatus> {
  const r = await fetch(`${API}/connections/google?workspace_id=${encodeURIComponent(workspaceId)}`,
    { headers: authHeaders(token) });
  if (!r.ok) return { connected: false };
  return r.json();
}

// Opens Google consent. Server returns the auth_url; we redirect the top window.
export async function startConnect(workspaceId: string, token: string): Promise<void> {
  const r = await fetch(`${API}/connections/google/start?workspace_id=${encodeURIComponent(workspaceId)}`,
    { method: "POST", headers: authHeaders(token) });
  if (!r.ok) throw new Error("Could not start the Google connection.");
  const { auth_url } = await r.json();
  window.location.href = auth_url;
}

export async function getPickerConfig(workspaceId: string, token: string): Promise<PickerConfig> {
  const r = await fetch(`${API}/connections/google/picker-config?workspace_id=${encodeURIComponent(workspaceId)}`,
    { headers: authHeaders(token) });
  if (!r.ok) throw new Error("Could not load Drive access. Try reconnecting.");
  return r.json();
}

export async function ingestFiles(workspaceId: string, fileIds: string[], token: string): Promise<IngestResult> {
  const r = await fetch(`${API}/workspaces/${encodeURIComponent(workspaceId)}/connections/google/ingest`,
    { method: "POST", headers: authHeaders(token), body: JSON.stringify({ file_ids: fileIds }) });
  if (!r.ok) throw new Error("Import failed. Please try again.");
  return r.json();
}

export async function disconnect(workspaceId: string, token: string): Promise<void> {
  await fetch(`${API}/connections/google?workspace_id=${encodeURIComponent(workspaceId)}`,
    { method: "DELETE", headers: authHeaders(token) });
}

// Lazy-load Google's Picker + GIS scripts once.
let pickerLoaded: Promise<void> | null = null;
export function loadGooglePicker(): Promise<void> {
  if (pickerLoaded) return pickerLoaded;
  pickerLoaded = new Promise((resolve, reject) => {
    if (typeof window === "undefined") return reject(new Error("no window"));
    const w = window as any;
    if (w.google?.picker) return resolve();
    const s = document.createElement("script");
    s.src = "https://apis.google.com/js/api.js";
    s.async = true;
    s.onload = () => w.gapi.load("picker", { callback: () => resolve() });
    s.onerror = () => reject(new Error("Could not load the Google Picker."));
    document.body.appendChild(s);
  });
  return pickerLoaded;
}

// Opens the Picker and resolves with the chosen file ids (drive.file scope).
export function openPicker(cfg: PickerConfig): Promise<string[]> {
  return new Promise(async (resolve, reject) => {
    try {
      await loadGooglePicker();
      const w = window as any;
      const view = new w.google.picker.DocsView(w.google.picker.ViewId.DOCS)
        .setMode(w.google.picker.DocsViewMode.LIST)
        .setIncludeFolders(true);
      const builder = new w.google.picker.PickerBuilder()
        .setOAuthToken(cfg.access_token)
        .addView(view)
        .enableFeature(w.google.picker.Feature.MULTISELECT_ENABLED)
        .setCallback((data: any) => {
          if (data.action === w.google.picker.Action.PICKED) {
            resolve((data.docs || []).map((d: any) => d.id));
          } else if (data.action === w.google.picker.Action.CANCEL) {
            resolve([]);
          }
        });
      if (cfg.api_key) builder.setDeveloperKey(cfg.api_key);
      if (cfg.app_id) builder.setAppId(cfg.app_id);
      builder.build().setVisible(true);
    } catch (e) {
      reject(e);
    }
  });
}
