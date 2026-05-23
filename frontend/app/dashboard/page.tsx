"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import Logo from "../../components/brand/logo";

interface Workspace {
  id: string;
  name: string;
}

interface DocumentSource {
  id: string;
  filename: string;
  file_type: string;
  created_at: string;
  status: "parsing" | "embedding" | "grounded" | "failed";
}

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
  const [urlInput, setUrlInput] = useState("");
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
  
  const [activeProvider, setActiveProvider] = useState("langdock");
  const [citationsMap, setCitationsMap] = useState<Record<string, any>>({});
  const [selectedCitation, setSelectedCitation] = useState<any | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

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

  // Initialize workspaces
  useEffect(() => {
    fetchWorkspaces();
  }, []);

  // When workspace changes, fetch documents & sessions
  useEffect(() => {
    if (selectedWorkspace) {
      fetchDocuments(selectedWorkspace.id);
      fetchSessions(selectedWorkspace.id);
      setSelectedSessionId(null);
      setMessages([]);
      setStreamingText("");
      setCitationsMap({});
      setSelectedCitation(null);
    }
  }, [selectedWorkspace]);

  // When session changes, fetch session details
  useEffect(() => {
    if (selectedSessionId) {
      fetchSessionDetails(selectedSessionId);
    }
  }, [selectedSessionId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText]);

  // --- API CALLS ---

  const fetchWorkspaces = async () => {
    try {
      const res = await fetch(`${API_URL}/api/v1/workspaces`);
      const data = await res.json();
      setWorkspaces(data);
      if (data.length > 0 && !selectedWorkspace) {
        setSelectedWorkspace(data[0]);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorkspaceName.trim()) return;
    try {
      const res = await fetch(`${API_URL}/api/v1/workspaces`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newWorkspaceName }),
      });
      const data = await res.json();
      setWorkspaces((prev) => [data, ...prev]);
      setSelectedWorkspace(data);
      setNewWorkspaceName("");
    } catch (e) {
      console.error(e);
    }
  };

  const fetchDocuments = async (wsId: string) => {
    try {
      const res = await fetch(`${API_URL}/api/v1/workspaces/${wsId}/documents`);
      const data = await res.json();
      // Map server documents to source structure, marking grounded
      setSources(
        data.map((doc: any) => ({
          ...doc,
          status: "grounded",
        }))
      );
    } catch (e) {
      console.error(e);
    }
  };

  const fetchSessions = async (wsId: string) => {
    try {
      const res = await fetch(`${API_URL}/api/v1/workspaces/${wsId}/sessions`);
      const data = await res.json();
      setSessions(data);
      if (data.length > 0) {
        setSelectedSessionId(data[0].id);
      } else {
        // Create an initial session
        handleCreateSession(wsId);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateSession = async (wsId: string) => {
    try {
      const res = await fetch(`${API_URL}/api/v1/workspaces/${wsId}/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Notebook Chat" }),
      });
      const data = await res.json();
      setSessions((prev) => [data, ...prev]);
      setSelectedSessionId(data.id);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchSessionDetails = async (sessionId: string) => {
    try {
      const res = await fetch(`${API_URL}/api/v1/sessions/${sessionId}`);
      const data = await res.json();
      setMessages(data.messages || []);
    } catch (e) {
      console.error(e);
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
    formData.append("provider", activeProvider);

    try {
      setUploadProgress((prev: any) => ({
        ...prev,
        status: "Parsing document structure...",
        progress: 60,
      }));
      
      const res = await fetch(`${API_URL}/api/v1/workspaces/${selectedWorkspace.id}/documents`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Upload failed");

      const doc = await res.json();
      
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
          status: "grounded",
        },
        ...prev,
      ]);
      
      setUploadProgress(null);
    } catch (err) {
      console.error(err);
      setUploadProgress({
        fileName: file.name,
        status: "Failed to parse document.",
        progress: 100,
      });
      setTimeout(() => setUploadProgress(null), 3000);
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
      const res = await fetch(`${API_URL}/api/v1/workspaces/${selectedWorkspace.id}/documents/url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: urlInput, provider: activeProvider }),
      });

      if (!res.ok) throw new Error("URL crawler failed");
      const doc = await res.json();

      setSources((prev) => [
        {
          id: doc.id,
          filename: doc.filename,
          file_type: doc.file_type,
          created_at: doc.created_at,
          status: "grounded",
        },
        ...prev,
      ]);
      setUrlInput("");
      setUploadProgress(null);
    } catch (e) {
      console.error(e);
      setUploadProgress({
        fileName: urlInput,
        status: "Failed to crawl web URL.",
        progress: 100,
      });
      setTimeout(() => setUploadProgress(null), 3000);
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    try {
      await fetch(`${API_URL}/api/v1/documents/${docId}`, { method: "DELETE" });
      setSources((prev) => prev.filter((d) => d.id !== docId));
    } catch (e) {
      console.error(e);
    }
  };

  // --- RAG CHAT SSE STREAMING ---

  const handleSendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !selectedSessionId || chatLoading) return;

    const userQuery = chatInput;
    setChatInput("");
    setChatLoading(true);
    setStreamingText("");
    
    // Optimistic user bubble
    const userMsg: Message = {
      id: Math.random().toString(),
      role: "user",
      content: userQuery,
    };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const response = await fetch(`${API_URL}/api/v1/sessions/${selectedSessionId}/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: userQuery, provider: activeProvider }),
      });

      if (!response.ok) throw new Error("SSE connection failed");

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
        buffer = lines.pop() || ""; // Keep tail

        for (const line of lines) {
          const cleanLine = line.trim();
          if (!cleanLine) continue;

          if (cleanLine.startsWith("event: metadata")) {
            // Next line will contain data: {...}
            continue;
          }

          if (cleanLine.startsWith("data: ")) {
            const dataStr = cleanLine.substring(6).trim();
            if (dataStr === "[DONE]") {
              break;
            }
            try {
              const payload = JSON.parse(dataStr);
              if (payload.type === "metadata") {
                // Register matching citations dictionary
                setCitationsMap(payload.sources || {});
              } else if (payload.type === "chunk") {
                setStreamingText((prev) => prev + payload.content);
              }
            } catch (e) {
              // Not JSON, skip
            }
          }
        }
      }

      // Finalize and save streaming content to local bubble list
      setMessages((prev) => [
        ...prev,
        {
          id: Math.random().toString(),
          role: "assistant",
          content: streamingText,
          // Build references array from citations used
          citations: Object.values(citationsMap),
        },
      ]);
      setStreamingText("");
      setChatLoading(false);
    } catch (err) {
      console.error(err);
      setChatLoading(false);
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
  const renderMessageContentWithCitations = (content: string) => {
    const parts = content.split(/(\[source_\d+\])/g);

    
    return parts.map((part, idx) => {
      const match = part.match(/\[source_(\d+)\]/);
      if (match) {
        const tag = `source_${match[1]}`;
        const sourceDetails = citationsMap[tag] || null;
        
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
                    Active AI Model Provider
                  </label>
                  <select
                    value={activeProvider}
                    onChange={(e) => setActiveProvider(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-sm text-zinc-200 focus:outline-none focus:border-zinc-700 transition-colors"
                  >
                    <option value="langdock">Langdock AI (Default GPT-4o)</option>
                    <option value="blackbox">Blackbox AI</option>
                    <option value="openrouter">OpenRouter Auto</option>
                    <option value="ollama">Ollama (Server Local Llama3)</option>
                    <option value="openai">OpenAI Direct</option>
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
            <Logo size={28} />
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
              Pipeline Settings
            </span>
            <span className="text-[9px] uppercase font-bold tracking-wider text-orange-500 bg-orange-950/20 border border-orange-500/20 px-1.5 py-0.5 rounded">
              {activeProvider}
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
        </header>

        {/* Chat Message Scroll Window */}
        <div className="flex-grow overflow-y-auto p-6 flex flex-col gap-6">
          {messages.length === 0 && !streamingText ? (
            /* Empty State */
            <div className="flex-grow flex flex-col items-center justify-center text-center max-w-md mx-auto">
              <span className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-6">
                <WorkspaceIcon />
              </span>
              <h2 className="text-white font-extrabold text-base mb-2">Initialize Grounded Research</h2>
              <p className="text-xs text-zinc-500 leading-relaxed">
                Drag and drop PDF sources in the right-hand panel, then ask questions. The assistant will answer using only your uploaded materials, outputting clickable inline page citation pills.
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
                      {isUser ? msg.content : renderMessageContentWithCitations(msg.content)}
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

        {/* Message Input Box */}
        <div className="p-6 border-t border-zinc-900/60 flex-shrink-0 bg-zinc-950">
          <form onSubmit={handleSendChatMessage} className="max-w-3xl mx-auto relative flex items-center">
            <input
              type="text"
              placeholder={chatLoading ? "Grounded AI thinking..." : "Ask your source documents a question..."}
              disabled={chatLoading || sources.length === 0}
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              className="w-full bg-zinc-900/70 border border-zinc-850 rounded-xl py-4 pl-4 pr-14 text-xs text-zinc-150 placeholder-zinc-600 focus:outline-none focus:border-zinc-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <button
              type="submit"
              disabled={chatLoading || !chatInput.trim() || sources.length === 0}
              className="absolute right-3 bg-white p-2 rounded-lg transition-all hover:scale-105 active:scale-95 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
            >
              <SendIcon />
            </button>
          </form>
          {sources.length === 0 && (
            <p className="text-[10px] text-center text-zinc-600 mt-2 font-medium">Please ingest at least one source file in the right-hand panel to open the chat window.</p>
          )}
        </div>
      </section>

      {/* COLUMN 3: RIGHT PANEL (Sources Explorer & Citation drawer) */}
      <aside className="w-80 bg-zinc-950 border-l border-zinc-900/60 flex flex-col p-4 gap-6 flex-shrink-0">
        
        {/* Upload documents area */}
        <div className="flex flex-col gap-3">
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Sources Library</span>
          
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept=".pdf,.txt,.md"
            onChange={handleFileUpload}
          />
          
          {/* Drag and drop panel trigger */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-zinc-900 hover:border-orange-500/40 rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-colors group"
          >
            <UploadIcon />
            <h4 className="text-xs font-bold text-white mt-3 mb-1">Add Source Document</h4>
            <p className="text-[10px] text-zinc-500">PDF, TXT, or MD files up to 50MB</p>
          </div>

          {/* URL Ingestion Form */}
          <form onSubmit={handleURLIngest} className="relative flex items-center mt-1">
            <span className="absolute left-3">
              <GlobeIcon />
            </span>
            <input
              type="url"
              placeholder="Crawl website URL..."
              required
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              className="w-full bg-zinc-900/40 border border-zinc-850 rounded-lg py-2.5 pl-9 pr-12 text-[10px] text-zinc-200 placeholder-zinc-650 focus:outline-none focus:border-zinc-700 transition-colors"
            />
            <button
              type="submit"
              className="absolute right-2 text-[9px] font-bold text-orange-500 hover:text-orange-400 cursor-pointer"
            >
              Add
            </button>
          </form>
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
                <p className="text-[10px] text-zinc-600">No sources uploaded yet. Add a PDF file to begin RAG extraction.</p>
              </div>
            ) : (
              sources.map((src) => (
                <div
                  key={src.id}
                  className="p-3 rounded-lg border border-zinc-900 bg-zinc-950/30 flex items-center justify-between gap-3 group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Tiny visual document decorator */}
                    <span className="w-6 h-6 rounded bg-zinc-900 border border-zinc-850 flex items-center justify-center flex-shrink-0">
                      <svg className="w-3.5 h-3.5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </span>
                    <div className="flex flex-col min-w-0">
                      <span className="text-[11px] text-white font-semibold truncate">{src.filename}</span>
                      <span className="text-[9px] text-zinc-500 uppercase font-medium">{src.file_type}</span>
                    </div>
                  </div>
                  
                  {/* Delete button */}
                  <button
                    onClick={() => handleDeleteDocument(src.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-red-950/20 border border-transparent hover:border-red-900/30 rounded cursor-pointer"
                  >
                    <TrashIcon />
                  </button>
                </div>
              ))
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
                <span className="text-[9px] text-zinc-500">Page {selectedCitation.page_number}</span>
              </div>
              <p className="text-[10px] text-zinc-300 leading-relaxed bg-zinc-950/80 border border-zinc-900 rounded p-2.5 max-h-[120px] overflow-y-auto font-sans">
                &quot;{selectedCitation.content}&quot;
              </p>
            </motion.div>
          )}
        </AnimatePresence>
        
      </aside>

    </div>
  );
}
