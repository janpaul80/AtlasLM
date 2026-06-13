"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import Logo from "../../components/brand/logo";
import { apiClient } from "@/lib/apiClient";
import { supabaseBrowser } from "@/lib/supabaseClient";
import StudioPanel from "@/app/components/studio/StudioPanel";
import AddSourceModal from "@/app/components/sources/AddSourceModal";
import { citationLabel } from "@/lib/sources";

interface Workspace {
  id: string;
  name: string;
}

interface DocumentSource {
  id: string;
  filename: string;
  file_type: string;
  created_at: string;
  status: "processing" | "ready" | "failed";
  error_message?: string | null;
}

type SourceTab = "files" | "website" | "youtube" | "audio" | "image" | "paste";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: Array<{
    filename: string;
    page_number: number;
    content: string;
  }>;
}

export default function Dashboard() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(null);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  
  const [sources, setSources] = useState<DocumentSource[]>([]);
  const [showAddSource, setShowAddSource] = useState(false);
  const hasReadySources = sources.some((src) => src.status === "ready" || !src.status || (src.status as string) === "grounded");
  const [activeSourceTab, setActiveSourceTab] = useState<SourceTab>("files");
  const [urlInput, setUrlInput] = useState("");
  const [pasteTitle, setPasteTitle] = useState("");
  const [pasteContent, setPasteContent] = useState("");
  const [uploadProgress, setUploadProgress] = useState<{
    fileName: string;
    status: string;
    progress: number;
  } | null>(null);

  const [sessions, setSessions] = useState<any[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  
  const [activeProvider, setActiveProvider] = useState("atlas-cloud");
  const [availableProviders, setAvailableProviders] = useState<{ id: string, name: string, status: string }[]>([]);
  const atlasProviderLabel = availableProviders.find((p) => p.id === activeProvider)?.name || "AtlasLM Engine";
  const [citationsMap, setCitationsMap] = useState<Record<string, any>>({});
  const [selectedCitation, setSelectedCitation] = useState<any | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [uiError, setUiError] = useState<string>("");
  const [token, setToken] = useState<string>("");

  // Studio State
  interface StudioOutput {
    id: string;
    workspace_id: string;
    output_type: string;
    title: string;
    content: string | null;
    citations: any[] | null;
    status: "pending" | "processing" | "ready" | "failed";
    error_message: string | null;
    created_at: string;
  }
  const [studioOutputs, setStudioOutputs] = useState<StudioOutput[]>([]);
  const [studioTypes, setStudioTypes] = useState<{id: string; label: string}[]>([]);
  const [openOutput, setOpenOutput] = useState<StudioOutput | null>(null);
  const [activeTab, setActiveTab] = useState<"chat" | "studio">("chat");


  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // accumulate streaming chunks outside React state to avoid stale closures
  const streamingAccumRef = useRef<string>("");
  const citationsMapRef = useRef<Record<string, any>>({});

  // SVG Icons (no emojis, professional)
  const WorkspaceIcon = () => (
    <svg className="w-4 h-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  );

  const UploadIcon = () => (
    <svg className="w-8 h-8 text-zinc-600 group-hover:text-orange-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
    </svg>
  );

  const SendIcon = () => (
    <svg className="w-4.5 h-4.5 text-zinc-950" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
    </svg>
  );

  const GlobeIcon = () => (
    <svg className="w-4 h-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
    </svg>
  );

  const SettingsIcon = () => (
    <svg className="w-4 h-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );

  const TrashIcon = () => (
    <svg className="w-3.5 h-3.5 text-zinc-650 hover:text-red-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );

  const RefreshIcon = () => (
    <svg className="w-3.5 h-3.5 text-zinc-400 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 7.89M9 11l3-3m0 0l3 3m-3-3v8" />
    </svg>
  );

  // Initialize workspaces and restore session from localStorage
  useEffect(() => {
    const restoreSession = async () => {
      const data = await apiClient.get<Workspace[]>("/api/v1/workspaces");
      setWorkspaces(data);
      
      // Restore selected workspace from localStorage
      const savedWorkspaceId = typeof window !== 'undefined' ? localStorage.getItem("selectedWorkspaceId") : null;
      let ws = data.find((w) => w.id === savedWorkspaceId) || data[0];
      if (ws) {
        setSelectedWorkspace(ws);
      }
    };
    
    const fetchProviders = async () => {
      try {
        const data = await apiClient.get<any>("/api/v1/settings/providers");
        if (data && data.providers) {
          setAvailableProviders(data.providers);
          const cloud = data.providers.find((p: any) => p.id === "atlas-cloud");
          const local = data.providers.find((p: any) => p.id === "atlas-local");
          if (cloud && cloud.status === "active") {
            setActiveProvider("atlas-cloud");
          } else if (local) {
            setActiveProvider("atlas-local");
          }
        }
      } catch (e) {
        console.error("Failed to load providers:", e);
      }
    };

    const fetchStudioTypes = async () => {
      try {
        const res = await apiClient.get<{ types: { id: string; label: string }[] }>("/api/v1/studio/types");
        setStudioTypes(res.types);
      } catch (e) {
        console.error("Failed to load studio types:", e);
      }
    };
    
    fetchWorkspaces();
    restoreSession().catch(console.error);
    fetchProviders().catch(console.error);
    fetchStudioTypes().catch(console.error);
  }, []);

  useEffect(() => {
    const fetchToken = async () => {
      try {
        const supabase = supabaseBrowser();
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          setToken(session.access_token);
        }
      } catch (err) {
        console.error("Failed to fetch token", err);
      }
    };
    fetchToken();
  }, []);

  const fetchStudioOutputs = async (wsId: string) => {
    try {
      const data = await apiClient.get<StudioOutput[]>(`/api/v1/workspaces/${wsId}/studio`);
      setStudioOutputs(data);
      // Resume polling for any pending or processing jobs loaded from DB
      data.forEach((out) => {
        if (out.status === "pending" || out.status === "processing") {
          pollStudioOutput(out.id);
        }
      });
    } catch (e) {
      console.error("Failed to load studio outputs:", e);
    }
  };

  // When workspace changes, fetch documents & sessions + save to localStorage
  useEffect(() => {
    if (selectedWorkspace) {
      if (typeof window !== 'undefined') {
        localStorage.setItem("selectedWorkspaceId", selectedWorkspace.id);
      }
      fetchDocuments(selectedWorkspace.id);
      fetchSessions(selectedWorkspace.id);
      fetchStudioOutputs(selectedWorkspace.id);
      setSelectedSessionId(null);
      setMessages([]);
      setStreamingText("");
      setCitationsMap({});
      setSelectedCitation(null);
      setOpenOutput(null);
    }
  }, [selectedWorkspace]);

  // When session changes, fetch session details + save to localStorage
  useEffect(() => {
    if (selectedSessionId) {
      if (typeof window !== 'undefined') {
        localStorage.setItem("selectedSessionId", selectedSessionId);
      }
      fetchSessionDetails(selectedSessionId);
    }
  }, [selectedSessionId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText]);

  // Poll workspace documents if any are processing
  useEffect(() => {
    if (!selectedWorkspace) return;
    const hasProcessing = sources.some((src) => src.status === "processing");
    if (!hasProcessing) return;

    const interval = setInterval(() => {
      fetchDocuments(selectedWorkspace.id);
    }, 3000);

    return () => clearInterval(interval);
  }, [sources, selectedWorkspace]);

  // --- API CALLS (all authenticated via apiClient) ---
  const getErrorMessage = (err: unknown, fallback: string) => {
    if (err instanceof Error && err.message) return err.message;
    return fallback;
  };

  const fetchWorkspaces = async () => {
    try {
      const data = await apiClient.get<Workspace[]>("/api/v1/workspaces");
      setWorkspaces(data);
      if (data.length > 0 && !selectedWorkspace) {
        setSelectedWorkspace(data[0]);
      }
    } catch (e) {
      console.error(e);
      setUiError(getErrorMessage(e, "Failed to load notebooks. Please refresh and try again."));
    }
  };

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorkspaceName.trim()) return;
    try {
      const data = await apiClient.post<Workspace>("/api/v1/workspaces", { name: newWorkspaceName });
      setWorkspaces((prev) => [data, ...prev]);
      setSelectedWorkspace(data);
      setNewWorkspaceName("");
      setUiError("");
    } catch (e) {
      console.error(e);
      setUiError(getErrorMessage(e, "Failed to create notebook. Please try a different name."));
    }
  };

  const fetchDocuments = async (wsId: string) => {
    try {
      const data = await apiClient.get<any[]>(`/api/v1/workspaces/${wsId}/documents`);
      setSources(
        data.map((doc: any) => ({
          ...doc,
          status: doc.status || "ready",
        }))
      );
    } catch (e) {
      console.error(e);
      setUiError(getErrorMessage(e, "Failed to load sources for this notebook."));
    }
  };

  const fetchSessions = async (wsId: string) => {
    try {
      const data = await apiClient.get<any[]>(`/api/v1/workspaces/${wsId}/sessions`);
      setSessions(data);
      
      // Try to restore selected session from localStorage
      const savedSessionId = typeof window !== 'undefined' ? localStorage.getItem("selectedSessionId") : null;
      const savedSession = savedSessionId ? data.find((s) => s.id === savedSessionId) : null;
      
      if (savedSession) {
        setSelectedSessionId(savedSession.id);
      } else if (data.length > 0) {
        setSelectedSessionId(data[0].id);
      } else {
        // Create an initial session if none exist
        handleCreateSession(wsId);
      }
    } catch (e) {
      console.error(e);
      setUiError(getErrorMessage(e, "Failed to load chat sessions for this notebook."));
    }
  };

  const handleCreateSession = async (wsId: string) => {
    try {
      const data = await apiClient.post<any>(`/api/v1/workspaces/${wsId}/sessions`, { title: "Notebook Chat" });
      setSessions((prev) => [data, ...prev]);
      setSelectedSessionId(data.id);
    } catch (e) {
      console.error(e);
      setUiError(getErrorMessage(e, "Failed to create chat session. Please retry."));
    }
  };

  const fetchSessionDetails = async (sessionId: string) => {
    try {
      const data = await apiClient.get<any>(`/api/v1/sessions/${sessionId}`);
      setMessages(data.messages || []);
    } catch (e) {
      console.error(e);
      setUiError(getErrorMessage(e, "Failed to load selected chat session."));
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedWorkspace) return;

    setUploadProgress({
      fileName: file.name,
      status: "Uploading document...",
      progress: 25,
    });

    const formData = new FormData();
    formData.append("file", file);

    try {
      setUploadProgress((prev: any) => ({
        ...prev,
        status: "Parsing document structure...",
        progress: 60,
      }));
      
      const doc = await apiClient.postForm<any>(`/api/v1/workspaces/${selectedWorkspace.id}/documents`, formData);

      
      setUploadProgress((prev: any) => ({
        ...prev,
        status: "Generating vector embeddings...",
        progress: 90,
      }));

      // Refresh documents
      setSources((prev) => [
        {
          id: doc.id,
          filename: doc.filename,
          file_type: doc.file_type,
          created_at: doc.created_at,
          status: doc.status || "ready",
          error_message: doc.error_message,
        },
        ...prev,
      ]);
      
      setUploadProgress(null);
      setUiError("");
    } catch (err) {
      console.error(err);
      setUploadProgress({
        fileName: file.name,
        status: "Failed to parse document.",
        progress: 100,
      });
      setUiError(getErrorMessage(err, "File upload failed. Please verify format (PDF/DOCX/TXT/MD/CSV) and size."));
      setTimeout(() => setUploadProgress(null), 3000);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleURLIngest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim() || !selectedWorkspace) return;

    setUploadProgress({
      fileName: urlInput,
      status: "Crawling URL...",
      progress: 30,
    });

    try {
      const doc = await apiClient.post<any>(
        `/api/v1/workspaces/${selectedWorkspace.id}/documents/url`,
        { url: urlInput }
      );

      setSources((prev) => [
        {
          id: doc.id,
          filename: doc.filename,
          file_type: doc.file_type,
          created_at: doc.created_at,
          status: doc.status || "ready",
          error_message: doc.error_message,
        },
        ...prev,
      ]);
      setUrlInput("");
      setUploadProgress(null);
      setUiError("");
    } catch (e) {
      console.error(e);
      setUploadProgress({
        fileName: urlInput,
        status: "Failed to crawl web URL.",
        progress: 100,
      });
      setUiError(getErrorMessage(e, "Website ingestion failed. Check URL and try again."));
    }
  };

  const generateStudioOutput = async (outputType: string) => {
    if (!selectedWorkspace) return;
    try {
      const res = await apiClient.postRaw(`/api/v1/workspaces/${selectedWorkspace.id}/studio`, {
        output_type: outputType,
      });
      const body = await res.json();
      if (res.status === 202) {
        setStudioOutputs((prev) => [body, ...prev]);
        pollStudioOutput(body.id);
        setActiveTab("studio");
        setUiError("");
      } else if (res.status === 201 || res.status === 200) {
        setStudioOutputs((prev) => [body, ...prev]);
        setActiveTab("studio");
        setOpenOutput(body);
        setUiError("");
      } else {
        setUiError(body.detail || "Failed to generate Studio output.");
      }
    } catch (e) {
      console.error(e);
      setUiError(getErrorMessage(e, "Failed to generate Studio output. Please check sources."));
    }
  };

  const pollStudioOutput = (outputId: string) => {
    const interval = setInterval(async () => {
      try {
        const out = await apiClient.get<StudioOutput>(`/api/v1/studio/${outputId}`);
        setStudioOutputs((prev) => prev.map((o) => (o.id === out.id ? out : o)));
        
        // Also update open output details if open
        setOpenOutput((currentOpen) => {
          if (currentOpen && currentOpen.id === out.id) {
            return out;
          }
          return currentOpen;
        });

        if (out.status === "ready" || out.status === "failed") {
          clearInterval(interval);
        }
      } catch (err) {
        console.error("Polling error for Studio output:", err);
        clearInterval(interval);
      }
    }, 2000);
  };

  const handleDeleteStudioOutput = async (outputId: string) => {
    try {
      await apiClient.del(`/api/v1/studio/${outputId}`);
      setStudioOutputs((prev) => prev.filter((o) => o.id !== outputId));
      setOpenOutput((curr) => (curr && curr.id === outputId ? null : curr));
    } catch (e) {
      console.error(e);
      setUiError(getErrorMessage(e, "Failed to delete Studio output."));
    }
  };



  const handleTextIngest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pasteContent.trim() || !selectedWorkspace) return;

    const title = pasteTitle.trim() || "Untitled research note";
    const content = pasteContent.trim();

    setUploadProgress({
      fileName: title,
      status: "Preparing pasted text...",
      progress: 35,
    });

    try {
      const doc = await apiClient.post<any>(
        `/api/v1/workspaces/${selectedWorkspace.id}/documents/text`,
        { title, content }
      );

      setUploadProgress((prev: any) => ({
        ...prev,
        status: "Generating vector embeddings...",
        progress: 90,
      }));

      setSources((prev) => [
        {
          id: doc.id,
          filename: doc.filename,
          file_type: doc.file_type,
          created_at: doc.created_at,
          status: doc.status || "ready",
        },
        ...prev,
      ]);
      setPasteTitle("");
      setPasteContent("");
      setUploadProgress(null);
      setUiError("");
    } catch (e) {
      console.error(e);
      setUploadProgress({
        fileName: title,
        status: "Failed to ingest pasted text.",
        progress: 100,
      });
      setUiError(getErrorMessage(e, "Paste text ingestion failed. Please retry."));
      setTimeout(() => setUploadProgress(null), 3000);
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    try {
      await apiClient.del(`/api/v1/documents/${docId}`);
      setSources((prev) => prev.filter((d) => d.id !== docId));
    } catch (e) {
      console.error(e);
      setUiError(getErrorMessage(e, "Failed to delete source."));
    }
  };

  // --- RAG CHAT SSE STREAMING ---

  const handleSendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !selectedSessionId || chatLoading) return;

    const userQuery = chatInput;
    const sessionId = selectedSessionId; // capture outside closure
    setChatInput("");
    setChatLoading(true);
    setStreamingText("");
    // Reset ref-based accumulators – avoids stale closure captures of state
    streamingAccumRef.current = "";
    citationsMapRef.current = {};
    
    // Optimistic user bubble
    const userMsg: Message = {
      id: Math.random().toString(),
      role: "user",
      content: userQuery,
    };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const response = await apiClient.stream(
        `/api/v1/sessions/${sessionId}/chat/stream`,
        { content: userQuery }
      );

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) return;

      let buffer = "";
      
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        
        // Split by SSE lines
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; // Keep incomplete tail for next iteration

        for (const line of lines) {
          const cleanLine = line.trim();
          if (!cleanLine) continue;

          if (cleanLine.startsWith("data: ")) {
            const dataStr = cleanLine.substring(6).trim();
            if (dataStr === "[DONE]") break;
            try {
              const payload = JSON.parse(dataStr);
              if (payload.type === "metadata") {
                // Store citation map in ref (not state) to avoid stale closure
                citationsMapRef.current = payload.sources || {};
                setCitationsMap(payload.sources || {});
              } else if (payload.type === "chunk") {
                // Accumulate in ref AND update state for live render
                streamingAccumRef.current += payload.content;
                setStreamingText(streamingAccumRef.current);
              } else if (payload.error) {
                throw new Error(payload.error);
              }
            } catch {
              // Non-JSON line, skip
            }
          }
        }
      }

      // Use ref values to avoid stale closure – always correct final text
      const finalContent = streamingAccumRef.current;
      const finalCitations = citationsMapRef.current;

      setMessages((prev) => [
        ...prev,
        {
          id: Math.random().toString(),
          role: "assistant",
          content: finalContent,
          citations: Object.values(finalCitations),
        },
      ]);
      setStreamingText("");
      setChatLoading(false);
      setUiError("");
    } catch (err) {
      console.error(err);
      setChatLoading(false);
      setUiError(getErrorMessage(err, "Chat failed. Please confirm you have an ingested source and try again."));
      setMessages((prev) => [
        ...prev,
        {
          id: Math.random().toString(),
          role: "assistant",
          content: "Failed to connect to the intelligence pipeline.",
        },
      ]);
    }
  };

  // --- Citation Parser Helper ---
  // Replaces tokens like [source_1] with a glowing clickable visual badge component
  const renderMessageContentWithCitations = (content: string, msgCitations?: any[]) => {
    const parts = content.split(/(\[source_\d+\])/g);

    return parts.map((part, idx) => {
      const match = part.match(/\[source_(\d+)\]/);
      if (match) {
        const tag = `source_${match[1]}`;
        // Resolve from message's own saved citations, or fallback to active session citationsMap
        const sourceDetails = 
          (msgCitations && msgCitations.find((c: any) => c.tag === tag)) || 
          citationsMap[tag] || 
          null;
        
        return (
          <button
            key={idx}
            onClick={() => sourceDetails && setSelectedCitation(sourceDetails)}
            className="inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-orange-950/40 text-orange-400 border border-orange-500/30 hover:bg-orange-500/20 transition-all duration-200 cursor-pointer ml-1 select-none"
          >
            {match[1]}
          </button>
        );
      }
      return <span key={idx}>{part}</span>;
    });
  };

  return (
    <div className="h-screen w-screen bg-zinc-950 flex overflow-hidden text-zinc-150 relative">
      
      {/* Settings Modal Slideover */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6"
            onClick={() => setShowSettings(false)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="w-full max-w-md rounded-2xl glass-panel p-8 bg-zinc-950/95"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-bold text-white mb-6">Pipeline Settings</h3>
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                    AtlasLM Intelligence Mode
                  </label>
                  <select
                    value={activeProvider}
                    onChange={(e) => setActiveProvider(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-sm text-zinc-200 focus:outline-none focus:border-zinc-700 transition-colors"
                  >
                    {availableProviders.map((prov) => (
                      <option key={prov.id} value={prov.id} disabled={prov.status === "inactive"}>
                        {prov.name} {prov.status === "inactive" ? "(Inactive)" : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <button
                onClick={() => setShowSettings(false)}
                className="w-full bg-zinc-900 border border-zinc-850 hover:bg-zinc-800 text-white font-bold py-3 rounded-lg text-xs tracking-wider uppercase mt-8 transition-colors"
              >
                Save configurations
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* COLUMN 1: LEFT SIDEBAR (Workspaces Selector) */}
      <aside className="w-64 bg-zinc-950 border-r border-zinc-900/60 flex flex-col justify-between p-4 flex-shrink-0">
        <div className="flex flex-col gap-6">
          <Link href="/">
            <Logo size={44} />
          </Link>
          
          {/* Create Workspace */}
          <form onSubmit={handleCreateWorkspace} className="flex flex-col gap-2">
            <input
              type="text"
              placeholder="New Notebook..."
              required
              value={newWorkspaceName}
              onChange={(e) => setNewWorkspaceName(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-850 rounded-lg px-3 py-2 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-700 transition-colors"
            />
            <button
              type="submit"
              className="w-full bg-zinc-900 hover:bg-zinc-800 text-white border border-zinc-800 rounded-lg py-2 text-xs font-bold transition-all duration-200"
            >
              Create Notebook
            </button>
          </form>

          {/* Notebook List */}
          <div className="flex flex-col gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 px-2">Workspaces</span>
            <div className="flex flex-col gap-1 max-h-[300px] overflow-y-auto">
              {workspaces.map((ws) => {
                const isSelected = selectedWorkspace?.id === ws.id;
                return (
                  <button
                    key={ws.id}
                    onClick={() => setSelectedWorkspace(ws)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs text-left transition-colors cursor-pointer ${
                      isSelected
                        ? "bg-zinc-900 text-white font-semibold border border-zinc-800"
                        : "text-zinc-400 hover:bg-zinc-900/40 hover:text-zinc-200"
                    }`}
                  >
                    <WorkspaceIcon />
                    <span className="truncate">{ws.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* User / Settings footer */}
        <div className="flex flex-col gap-2 border-t border-zinc-900/60 pt-4">
          <button
            onClick={() => setShowSettings(true)}
            className="w-full flex items-center justify-between px-3 py-2 text-xs text-zinc-400 hover:text-white transition-colors hover:bg-zinc-900/40 rounded-lg cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <SettingsIcon />
              AtlasLM Settings
            </span>
            <span className="text-[9px] uppercase font-bold tracking-wider text-orange-500 bg-orange-950/20 border border-orange-500/20 px-1.5 py-0.5 rounded">
              {atlasProviderLabel}
            </span>
          </button>
        </div>
      </aside>

      {/* COLUMN 2: CENTRAL WORKSPACE (Grounded Chat) */}
      <section className="flex-grow flex flex-col justify-between bg-zinc-950">
        
        {/* Workspace header */}
        <header className="h-14 border-b border-zinc-900/60 px-6 flex items-center justify-between flex-shrink-0 bg-zinc-950/90 backdrop-blur">
          <div className="flex items-center gap-3">
            <span className="text-zinc-650 text-xs">Active Workspace /</span>
            <span className="text-white text-xs font-bold">{selectedWorkspace?.name || "No active workspace"}</span>
          </div>

          {/* Chat / Studio Tab Toggle */}
          <div className="flex bg-zinc-900 p-0.5 rounded-lg border border-zinc-800">
            <button
              onClick={() => setActiveTab("chat")}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                activeTab === "chat"
                  ? "bg-zinc-800 text-white shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Grounded Chat
            </button>
            <button
              onClick={() => setActiveTab("studio")}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                activeTab === "studio"
                  ? "bg-zinc-800 text-white shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              AtlasLM Studio
            </button>
          </div>
        </header>

        {uiError && (
          <div className="mx-6 mt-4 rounded-lg border border-red-500/30 bg-red-950/20 px-3 py-2 text-[11px] text-red-300">
            {uiError}
          </div>
        )}

        {/* Tab Content Rendering */}
        {activeTab === "studio" ? (
          <div className="flex-grow overflow-y-auto p-6 flex flex-col gap-6">
            {openOutput ? (
              /* Reader View */
              <div className="max-w-3xl mx-auto w-full flex flex-col gap-4">
                <div className="flex items-center justify-between border-b border-zinc-900/60 pb-4">
                  <div>
                    <button
                      onClick={() => setOpenOutput(null)}
                      className="text-orange-500 hover:text-orange-400 text-xs font-bold mb-1 flex items-center gap-1 cursor-pointer"
                    >
                      &larr; Back to Studio outputs
                    </button>
                    <h2 className="text-white text-lg font-bold">{openOutput.title}</h2>
                    <span className="text-[9px] uppercase tracking-wider font-bold text-zinc-500 bg-zinc-900 px-2 py-0.5 rounded mt-1 inline-block">
                      {openOutput.output_type.replace("_", " ")}
                    </span>
                  </div>
                  <button
                    onClick={() => handleDeleteStudioOutput(openOutput.id)}
                    className="bg-red-950/40 text-red-400 border border-red-900/30 hover:bg-red-900/20 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                  >
                    Delete Output
                  </button>
                </div>
                <div className="text-zinc-200 text-xs leading-relaxed whitespace-pre-wrap font-sans bg-zinc-950/30 border border-zinc-900/60 p-6 rounded-xl">
                  {renderMessageContentWithCitations(openOutput.content || "", openOutput.citations || [])}
                </div>
              </div>
            ) : (
              /* Grid / Main List View */
              <div className="max-w-3xl mx-auto w-full flex flex-col gap-6">
                <div className="flex items-center justify-between border-b border-zinc-900/60 pb-4">
                  <div>
                    <h2 className="text-white font-extrabold text-base">AtlasLM Studio</h2>
                    <p className="text-[10px] text-zinc-500">Generate structured reports and executive summaries grounded on your workspace corpus.</p>
                  </div>
                  
                  {/* Generate menu */}
                  <div className="flex items-center gap-2">
                    {studioTypes.map((type) => (
                      <button
                        key={type.id}
                        onClick={() => generateStudioOutput(type.id)}
                        disabled={!hasReadySources}
                        className="bg-orange-600 hover:bg-orange-500 disabled:opacity-40 disabled:pointer-events-none text-white font-bold px-3 py-2 rounded-lg text-xs transition-colors cursor-pointer"
                      >
                        Generate {type.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Outputs List */}
                <div className="flex flex-col gap-3">
                  {studioOutputs.length === 0 ? (
                    <div className="text-center p-12 border border-zinc-900 border-dashed rounded-xl">
                      <p className="text-xs text-zinc-500">No Studio outputs generated yet. Choose a format above to begin.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {studioOutputs.map((out) => {
                        const isPending = out.status === "pending" || out.status === "processing";
                        const isFailed = out.status === "failed";
                        return (
                          <div
                            key={out.id}
                            onClick={() => !isPending && !isFailed && setOpenOutput(out)}
                            className={`p-4 rounded-xl border transition-all flex flex-col justify-between h-36 ${
                              isPending
                                ? "border-zinc-900 bg-zinc-900/20"
                                : isFailed
                                ? "border-red-950/40 bg-red-950/5"
                                : "border-zinc-900 bg-zinc-950/30 hover:border-zinc-800 cursor-pointer hover:bg-zinc-900/10"
                            }`}
                          >
                            <div>
                              <div className="flex items-start justify-between gap-2">
                                <h3 className="text-white text-xs font-bold line-clamp-2">{out.title}</h3>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteStudioOutput(out.id);
                                  }}
                                  className="text-zinc-650 hover:text-red-500 transition-colors p-1"
                                >
                                  <TrashIcon />
                                </button>
                              </div>
                              <span className="text-[9px] uppercase tracking-wider font-bold text-zinc-500 bg-zinc-900/60 px-1.5 py-0.5 rounded mt-1.5 inline-block">
                                {out.output_type.replace("_", " ")}
                              </span>
                            </div>

                            <div className="mt-4 flex items-center justify-between text-[10px]">
                              {isPending ? (
                                <span className="text-orange-500 font-bold flex items-center gap-1.5">
                                  <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                  </svg>
                                  Generating...
                                </span>
                              ) : isFailed ? (
                                <span className="text-red-500 font-bold max-w-[200px] truncate" title={out.error_message || "Generation failed"}>
                                  Failed: {out.error_message || "Unknown error"}
                                </span>
                              ) : (
                                <span className="text-zinc-550">Ready</span>
                              )}
                              <span className="text-zinc-600 text-[9px]">
                                {new Date(out.created_at).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Chat Window Tab Content */
          <div className="flex-grow overflow-y-auto p-6 flex flex-col gap-6">
            {messages.length === 0 && !streamingText ? (
              /* Empty State */
              <div className="flex-grow flex flex-col items-center justify-center text-center max-w-md mx-auto">
                <span className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-6">
                  <WorkspaceIcon />
                </span>
                <h2 className="text-white font-extrabold text-base mb-2">Initialize Grounded Research</h2>
                <p className="text-xs text-zinc-500 leading-relaxed">
                  Create notebook → Add source → Ask question. Start by creating/selecting a notebook, then ingest a PDF, DOCX, TXT, MD, or CSV file, website URL, or pasted text.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-6 max-w-3xl mx-auto w-full">
                {messages.map((msg) => {
                  const isUser = msg.role === "user";
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col gap-2 max-w-[85%] ${isUser ? "self-end items-end" : "self-start items-start"}`}
                    >
                      <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-600">
                        {isUser ? "You" : "AtlasLM"}
                      </span>
                      <div
                        className={`p-4 rounded-xl text-xs leading-relaxed border ${
                          isUser
                            ? "bg-zinc-900 border-zinc-800 text-white"
                            : "bg-zinc-950/30 border-zinc-900/60 text-zinc-200"
                        }`}
                      >
                        {isUser ? msg.content : renderMessageContentWithCitations(msg.content, msg.citations)}
                      </div>
                    </div>
                  );
                })}

                {/* SSE Live Streaming text chunk render */}
                {streamingText && (
                  <div className="flex flex-col gap-2 max-w-[85%] self-start items-start">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-600">AtlasLM</span>
                    <div className="p-4 rounded-xl text-xs leading-relaxed border bg-zinc-950/30 border-zinc-900/60 text-zinc-200">
                      {renderMessageContentWithCitations(streamingText)}
                      <span className="inline-block w-1.5 h-3 ml-1 bg-orange-500 animate-pulse" />
                    </div>
                  </div>
                )}
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}


        {/* Message Input Box */}
        <div className="p-6 border-t border-zinc-900/60 flex-shrink-0 bg-zinc-950">
          <form onSubmit={handleSendChatMessage} className="max-w-3xl mx-auto relative flex items-center">
            <input
              type="text"
              placeholder={chatLoading ? "Grounded AI thinking..." : "Ask your notebook sources a question..."}
              disabled={chatLoading || !hasReadySources}
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              className="w-full bg-zinc-900/70 border border-zinc-850 rounded-xl py-4 pl-4 pr-14 text-xs text-zinc-150 placeholder-zinc-600 focus:outline-none focus:border-zinc-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <button
              type="submit"
              disabled={chatLoading || !chatInput.trim() || !hasReadySources}
              className="absolute right-3 bg-white p-2 rounded-lg transition-all hover:scale-105 active:scale-95 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
            >
              <SendIcon />
            </button>
          </form>
          {!hasReadySources && (
            <p className="text-[10px] text-center text-zinc-650 mt-2 font-medium">Add at least one grounded source in the right-hand panel to open the chat window.</p>
          )}
        </div>
      </section>

      {/* COLUMN 3: RIGHT PANEL (Sources Explorer & Citation drawer) */}
      <aside className="w-80 bg-zinc-950 border-l border-zinc-900/60 flex flex-col p-4 gap-6 flex-shrink-0">
        
        {/* Source ingestion area */}
        <div className="flex flex-col gap-3">
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Sources Library</span>
          {selectedWorkspace ? (
            <button
              onClick={() => setShowAddSource(true)}
              className="w-full py-3 px-4 rounded-xl border border-dashed border-zinc-800 bg-zinc-900/40 text-[11px] font-bold uppercase tracking-wider text-orange-500 hover:border-orange-500/40 hover:bg-orange-950/5 transition-all text-center cursor-pointer flex items-center justify-center gap-2 group"
            >
              <UploadIcon />
              <span>Add Source</span>
            </button>
          ) : (
            <p className="text-[10px] text-zinc-650">Select a notebook to add sources.</p>
          )}
        </div>

        {/* Uploading progress states */}
        {uploadProgress && (
          <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-850 flex flex-col gap-2">
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-white font-semibold truncate max-w-[150px]">{uploadProgress.fileName}</span>
              <span className="text-orange-500 font-medium flex items-center gap-1.5">
                <RefreshIcon />
                {uploadProgress.progress}%
              </span>
            </div>
            <p className="text-[9px] text-zinc-500">{uploadProgress.status}</p>
            <div className="w-full h-1 bg-zinc-950 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-orange-500 to-red-500 transition-all duration-300"
                style={{ width: `${uploadProgress.progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Sources List */}
        <div className="flex-grow flex flex-col gap-3 min-h-0">
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Ingested Sources ({sources.length})</span>
          <div className="flex-grow overflow-y-auto flex flex-col gap-2 pr-1">
            {sources.length === 0 ? (
              <div className="flex-grow flex items-center justify-center text-center p-8 border border-zinc-900 border-dashed rounded-xl">
                <p className="text-[10px] text-zinc-600">No sources grounded yet. Add a file, website, or pasted text source to begin research.</p>
              </div>
            ) : (
              sources.map((src) => {
                const isProcessing = src.status === "processing";
                const isFailed = src.status === "failed";

                return (
                  <div
                    key={src.id}
                    className={`p-3 rounded-lg border flex items-center justify-between gap-3 group transition-colors ${
                      isFailed
                        ? "border-red-950/40 bg-red-950/5"
                        : "border-zinc-900 bg-zinc-950/30"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {/* Tiny visual document decorator */}
                      <span className="w-6 h-6 rounded bg-zinc-900 border border-zinc-850 flex items-center justify-center flex-shrink-0">
                        {isProcessing ? (
                          <svg className="w-3.5 h-3.5 text-orange-500 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                        ) : (
                          <svg className={`w-3.5 h-3.5 ${isFailed ? "text-red-500" : "text-zinc-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        )}
                      </span>
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-[11px] text-white font-semibold truncate">{src.filename}</span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[9px] text-zinc-500 uppercase font-medium">{src.file_type}</span>
                          {isProcessing && (
                            <span className="text-[9px] text-orange-500 font-bold flex items-center gap-1">
                              <span className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-pulse" />
                              Processing...
                            </span>
                          )}
                          {isFailed && (
                            <span
                              className="text-[9px] text-red-500 font-bold cursor-help truncate max-w-[150px]"
                              title={src.error_message || "Ingestion failed"}
                            >
                              Failed: {src.error_message || "Unknown error"}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Delete button */}
                    <button
                      onClick={() => handleDeleteDocument(src.id)}
                      className={`transition-opacity p-1 hover:bg-red-950/20 border border-transparent hover:border-red-900/30 rounded cursor-pointer ${
                        isFailed ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                      }`}
                      title={isFailed ? "Remove failed upload" : "Delete source"}
                    >
                      <TrashIcon />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* COLUMN 3 LOWER DRAWER: Citation Viewer Panel (NotebookLM inspired!) */}
        <AnimatePresence>
          {selectedCitation && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="p-4 rounded-xl border border-orange-500/20 bg-orange-950/5 flex flex-col gap-3 relative shadow-lg shadow-orange-950/5"
            >
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold uppercase tracking-wider text-orange-400">
                  Grounded Citation
                </span>
                <button
                  onClick={() => setSelectedCitation(null)}
                  className="text-[10px] text-zinc-550 hover:text-zinc-300 font-bold px-1.5 py-0.5 rounded cursor-pointer"
                >
                  Close
                </button>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[11px] text-white font-semibold truncate">{selectedCitation.filename}</span>
                <span className="text-[9px] text-zinc-550">
                  {citationLabel({
                    page: selectedCitation.page_number,
                    sheet: selectedCitation.sheet,
                    timestamp: selectedCitation.timestamp,
                  })}
                </span>
              </div>
              <p className="text-[10px] text-zinc-300 leading-relaxed bg-zinc-950/80 border border-zinc-900 rounded p-2.5 max-h-[120px] overflow-y-auto font-sans">
                &quot;{selectedCitation.content}&quot;
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </aside>

      {selectedWorkspace && (
        <StudioPanel
          notebookId={selectedWorkspace.id}
          selectedSourceIds={sources
            .filter((s) => s.status === "ready" || !s.status || (s.status as string) === "grounded")
            .map((s) => s.id)}
          token={token}
        />
      )}

      {showAddSource && selectedWorkspace && (
        <AddSourceModal
          notebookId={selectedWorkspace.id}
          token={token}
          onClose={() => setShowAddSource(false)}
          onAdded={() => {
            setShowAddSource(false);
            fetchDocuments(selectedWorkspace.id);
          }}
        />
      )}

    </div>
  );
}
