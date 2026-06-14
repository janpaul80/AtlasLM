// frontend/lib/research.ts
// Client for the Deep Research api/v1 endpoints. Token comes from your existing
// Supabase session helper (reuse whatever AddSourceModal uses).

export type ResearchResult = {
  id: string;
  type: "web" | "academic";
  title: string;
  url: string;
  snippet: string;
  source_label: string;        // "Web" | "arXiv" | "Crossref"
  domain?: string;
  date?: string;
  authors?: string;
  venue?: string;
  year?: string;
};

const API = process.env.NEXT_PUBLIC_API_BASE ?? "/api/v1";

function authHeaders(token: string) {
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

export async function searchResearch(
  workspaceId: string,
  token: string,
  opts: { query: string; web: boolean; academic: boolean; limit?: number },
): Promise<{ job_id: string; results: ResearchResult[] }> {
  const res = await fetch(`${API}/workspaces/${workspaceId}/research/search`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ ...opts, limit: opts.limit ?? 8 }),
  });
  if (!res.ok) throw new Error("Deep Research search failed");
  return res.json();
}

export async function ingestResearch(
  workspaceId: string,
  token: string,
  query: string,
  results: ResearchResult[],
  fetchFullText = true,
): Promise<{ job_id: string; status: string; queued: number }> {
  const res = await fetch(`${API}/workspaces/${workspaceId}/research/ingest`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ query, results, fetch_full_text: fetchFullText }),
  });
  if (!res.ok) throw new Error("Deep Research ingest failed");
  return res.json();
}

export async function pollResearchJob(
  token: string,
  jobId: string,
): Promise<{ status: string; result?: any }> {
  const res = await fetch(`${API}/research/jobs/${jobId}`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("job poll failed");
  return res.json();
}
