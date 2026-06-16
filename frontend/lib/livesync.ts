// frontend/lib/livesync.ts
// Client wrapper for the Patch 012 live-sync endpoints.
const API = (process.env.NEXT_PUBLIC_API_BASE || "").replace(/\/$/, "") || "/api/v1";

function authHeaders(token: string): HeadersInit {
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

export type LiveSource = {
  source_id: string; file_id: string; live: boolean;
  expiration?: number; last_synced?: number;
};

export async function listLiveSync(workspaceId: string, token: string): Promise<LiveSource[]> {
  const r = await fetch(`${API}/workspaces/${encodeURIComponent(workspaceId)}/livesync`,
    { headers: authHeaders(token) });
  if (!r.ok) return [];
  const j = await r.json();
  return j.sources || [];
}

export async function setLiveSync(
  workspaceId: string, sourceId: string, fileId: string, enabled: boolean, token: string,
): Promise<void> {
  const r = await fetch(
    `${API}/workspaces/${encodeURIComponent(workspaceId)}/sources/${encodeURIComponent(sourceId)}/livesync`,
    { method: "POST", headers: authHeaders(token), body: JSON.stringify({ enabled, file_id: fileId }) });
  if (!r.ok) throw new Error((await r.text()) || "Could not update live sync.");
}
