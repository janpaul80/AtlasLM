// Patch 013 - client helpers for the Teams API. Mirrors frontend/lib/livesync.ts.
export type Role = "owner" | "editor" | "viewer";

export interface Member { id: string; user_id: string; role: Role; added_by?: string; }
export interface Invite { id: string; email: string; role: Role; expires_at?: number; }
export interface TeamState { members: Member[]; invites: Invite[]; your_role: Role; }

const base = (ws: string) => `/api/v1/workspaces/${ws}`;

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || "Request failed. Try again.");
  }
  return res.json();
}

export async function getTeam(ws: string): Promise<TeamState> {
  return json(await fetch(`${base(ws)}/members`, { credentials: "include" }));
}

export async function inviteMember(ws: string, email: string, role: Role): Promise<Invite> {
  return json(await fetch(`${base(ws)}/invites`, {
    method: "POST", credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, role }),
  }));
}

export async function revokeInvite(ws: string, inviteId: string): Promise<void> {
  await json(await fetch(`${base(ws)}/invites/${inviteId}`, {
    method: "DELETE", credentials: "include",
  }));
}

export async function changeRole(ws: string, userId: string, role: Role): Promise<void> {
  await json(await fetch(`${base(ws)}/members/${userId}`, {
    method: "PATCH", credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role }),
  }));
}

export async function removeMember(ws: string, userId: string): Promise<void> {
  await json(await fetch(`${base(ws)}/members/${userId}`, {
    method: "DELETE", credentials: "include",
  }));
}
