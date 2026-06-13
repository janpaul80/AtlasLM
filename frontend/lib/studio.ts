// frontend/lib/studio.ts
export type StudioType =
  | "report" | "mindmap" | "flashcards" | "quiz" | "table" | "slides" | "audio";

const API = process.env.NEXT_PUBLIC_API_BASE ?? "";

export async function generateStudio(
  type: StudioType,
  notebookId: string,
  sourceIds: string[],
  token: string,
) {
  const res = await fetch(`${API}/api/studio/${type}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ notebook_id: notebookId, source_ids: sourceIds }),
  });
  if (!res.ok) throw new Error("AtlasLM Engine could not generate this output.");
  return res.json();
}

export const STUDIO_OUTPUTS = [
  { id: "report",     label: "Report",         desc: "Executive, business, research & technical reports", tint: "#FF5A1F" },
  { id: "mindmap",    label: "Mind Map",       desc: "Visual knowledge graph of your sources",            tint: "#3B82F6" },
  { id: "flashcards", label: "Flashcards",     desc: "Study & certification cards",                       tint: "#A855F7" },
  { id: "quiz",       label: "Quiz",           desc: "MCQ, true/false & practice exams",                  tint: "#22C55E" },
  { id: "audio",      label: "Audio Overview", desc: "Podcast-style spoken summary",                      tint: "#EC4899" },
  { id: "slides",     label: "Slide Deck",     desc: "Investor, sales & research decks",                  tint: "#EAB308" },
  { id: "table",      label: "Data Table",     desc: "Metrics, findings & comparisons",                   tint: "#14B8A6" },
] as const;
