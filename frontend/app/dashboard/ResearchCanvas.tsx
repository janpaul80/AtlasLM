"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { apiClient } from "@/lib/apiClient";
import "./research-canvas.css";

// Types
type Doc = {
  id: string;
  filename: string;
  file_type: string;
  status: "pending" | "processing" | "ready" | "failed";
  created_at: string;
};

type Edge = {
  id: string;
  workspace_id: string;
  from_document_id: string;
  to_document_id: string;
  created_at: string;
};

type Pos = {
  document_id: string;
  x_pos: number;
  y_pos: number;
};

type SynthesisNode = {
  id: string;
  workspace_id: string;
  title: string;
  x_pos: number;
  y_pos: number;
  input_document_ids: string[];
  created_at: string;
};

interface ResearchCanvasProps {
  workspaceId: string;
  documents: Doc[];
  studioOutputs: any[];
  onAddSourceClick: () => void;
  onAskClick: (scopeNode?: { id: string; title: string; count: number }) => void;
}

export default function ResearchCanvas({
  workspaceId,
  documents,
  studioOutputs,
  onAddSourceClick,
  onAskClick,
}: ResearchCanvasProps) {
  const [edges, setEdges] = useState<Edge[]>([]);
  const [synthesisNodes, setSynthesisNodes] = useState<SynthesisNode[]>([]);
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({});
  
  // Drag-to-connect state
  const [activeLink, setActiveLink] = useState<{
    fromNodeId: string;
    fromSide: "left" | "right";
    cursorX: number;
    cursorY: number;
  } | null>(null);
  const [hoveredPort, setHoveredPort] = useState<{
    nodeId: string;
    side: "left" | "right";
  } | null>(null);

  // Drag node state
  const [draggingNode, setDraggingNode] = useState<{
    nodeId: string;
    offsetX: number;
    offsetY: number;
  } | null>(null);

  // Left dock collapse state
  const [dockCollapsed, setDockCollapsed] = useState(false);

  // Right panel task lists collapse states
  const [tasksOpen, setTasksOpen] = useState<Record<string, boolean>>({
    outputs: true,
    progress: true,
    next: false,
  });

  const canvasRef = useRef<HTMLDivElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initialize and load graph + positions
  const loadGraphData = useCallback(() => {
    if (!workspaceId) return;
    Promise.all([
      apiClient.get<Edge[]>(`/api/v1/workspaces/${workspaceId}/graph`),
      apiClient.get<Pos[]>(`/api/v1/workspaces/${workspaceId}/graph/positions`),
      apiClient.get<SynthesisNode[]>(`/api/v1/workspaces/${workspaceId}/synthesis`),
    ])
      .then(([edgeRows, posRows, synthesisRows]) => {
        setEdges(edgeRows?? []);
        setSynthesisNodes(synthesisRows?? []);
        const map: Record<string, { x: number; y: number }> = {};
        
        // Match positions
        (posRows?? []).forEach((p) => {
          map[p.document_id] = { x: p.x_pos, y: p.y_pos };
        });

        // Set positions for synthesis nodes directly from their x_pos, y_pos
        (synthesisRows?? []).forEach((n) => {
          map[n.id] = { x: n.x_pos, y: n.y_pos };
        });

        // Fallback layout for documents without positions
        const docList = documents || [];
        docList.forEach((d, idx) => {
          if (!map[d.id]) {
            // Distribute them in a default layout: staggered columns
            const col = idx % 2;
            const row = Math.floor(idx / 2);
            map[d.id] = {
              x: 180 + col * 260,
              y: 180 + row * 220,
            };
          }
        });

        setPositions(map);
      })
      .catch((err) => {
        console.error("Failed to load canvas data:", err);
      });
  }, [workspaceId, documents]);

  useEffect(() => {
    loadGraphData();
  }, [loadGraphData]);

  // Add edge API call
  const addEdge = useCallback(async (fromId: string, toId: string) => {
    if (fromId === toId) return; // self-edge guard

    const isToSynthesis = synthesisNodes.some((sn) => sn.id === toId);
    if (isToSynthesis) {
      const node = synthesisNodes.find((sn) => sn.id === toId);
      if (!node) return;
      if (node.input_document_ids.includes(fromId)) return; // duplicate guard
      try {
        await apiClient.post(`/api/v1/workspaces/${workspaceId}/synthesis/${toId}/inputs`, {
          document_id: fromId,
        });
        setSynthesisNodes((prev) =>
          prev.map((sn) =>
            sn.id === toId
              ? {...sn, input_document_ids: [...sn.input_document_ids, fromId] }
              : sn
          )
        );
      } catch (err) {
        console.error("Failed to add synthesis input:", err);
      }
      return;
    }

    // Check duplicates
    if (edges.some((e) => e.from_document_id === fromId && e.to_document_id === toId)) return;
    
    try {
      const created = await apiClient.post<Edge>(`/api/v1/workspaces/${workspaceId}/graph`, {
        from_document_id: fromId,
        to_document_id: toId,
      });
      setEdges((prev) => [...prev, created]);
    } catch (err) {
      console.error("Failed to create connection:", err);
    }
  }, [edges, workspaceId, synthesisNodes]);

  // Remove edge API call
  const removeEdge = useCallback(async (edgeId: string) => {
    try {
      await apiClient.del(`/api/v1/workspaces/${workspaceId}/graph/${edgeId}`);
      setEdges((prev) => prev.filter((e) => e.id!== edgeId));
    } catch (err) {
      console.error("Failed to delete connection:", err);
    }
  }, [workspaceId]);

  // Save node position API call (debounced)
  const saveNodePosition = useCallback((nodeId: string, x: number, y: number) => {
    const isSynthesis = synthesisNodes.some((sn) => sn.id === nodeId);
    if (isSynthesis) {
      apiClient.patch(`/api/v1/workspaces/${workspaceId}/synthesis/${nodeId}`, {
        x_pos: x,
        y_pos: y,
      }).catch((err) => console.error("Failed to save synthesis node position:", err));
      return;
    }

    setPositions((prev) => {
      const nextPositions = {...prev, [nodeId]: { x, y } };
      
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        const docPositions = Object.entries(nextPositions).filter(([id]) => {
          return!synthesisNodes.some((sn) => sn.id === id);
        });
        const payload = docPositions.map(([document_id, p]) => ({
          document_id,
          x_pos: p.x,
          y_pos: p.y,
        }));
        apiClient.put(`/api/v1/workspaces/${workspaceId}/graph/positions`, payload)
          .catch((err) => console.error("Failed to save positions:", err));
      }, 600);

      return nextPositions;
    });
  }, [workspaceId, synthesisNodes]);

  // Port coordinates helper relative to the canvas wrap container
  const getPortPos = useCallback((nodeId: string, side: "left" | "right") => {
    const nodePos = positions[nodeId];
    if (!nodePos) return { x: 0, y: 0 };
    
    const nodeEl = document.getElementById(`node-${nodeId}`);
    const height = nodeEl? nodeEl.offsetHeight: 150;
    const width = nodeEl? nodeEl.offsetWidth: 218;

    return {
      x: side === "right"? nodePos.x + width: nodePos.x,
      y: nodePos.y + height / 2,
    };
  }, [positions]);

  // Bezier curve path calculator
  const getCurvePath = useCallback((p1: { x: number; y: number }, p2: { x: number; y: number }) => {
    const dx = Math.max(60, Math.abs(p2.x - p1.x) * 0.5);
    return `M ${p1.x} ${p1.y} C ${p1.x + dx} ${p1.y}, ${p2.x - dx} ${p2.y}, ${p2.x} ${p2.y}`;
  }, []);

  // Check if a port has any active connections
  const isPortConnected = useCallback((nodeId: string, side: "left" | "right") => {
    return edges.some((e) => {
      if (side === "right") {
        return e.from_document_id === nodeId;
      } else {
        return e.to_document_id === nodeId;
      }
    }) || (side === "left" && synthesisNodes.some((sn) => sn.id === nodeId && sn.input_document_ids.length > 0)) ||
      (side === "right" && synthesisNodes.some((sn) => sn.input_document_ids.includes(nodeId)));
  }, [edges, synthesisNodes]);

  // Node Drag handlers
  const handleNodePointerDown = (docId: string, e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest(".port") || (e.target as HTMLElement).closest("button")) {
      return;
    }
    const nodePos = positions[docId] || { x: 0, y: 0 };
    setDraggingNode({
      nodeId: docId,
      offsetX: e.clientX - nodePos.x,
      offsetY: e.clientY - nodePos.y,
    });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    e.stopPropagation();
  };

  const handleNodePointerMove = (e: React.PointerEvent) => {
    if (!draggingNode) return;
    const x = e.clientX - draggingNode.offsetX;
    const y = e.clientY - draggingNode.offsetY;
    
    // Bounds guard: prevent nodes from being dragged off left and top boundaries
    const boundedX = Math.max(10, x);
    const boundedY = Math.max(10, y);

    setPositions((prev) => ({
      ...prev,
      [draggingNode.nodeId]: { x: boundedX, y: boundedY },
    }));
    e.stopPropagation();
  };

  const handleNodePointerUp = (e: React.PointerEvent) => {
    if (!draggingNode) return;
    const nodePos = positions[draggingNode.nodeId];
    if (nodePos) {
      saveNodePosition(draggingNode.nodeId, nodePos.x, nodePos.y);
    }
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    setDraggingNode(null);
    e.stopPropagation();
  };

  // Port Drag-to-connect handlers
  const handlePortPointerDown = (docId: string, side: "left" | "right", e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();

    if (!canvasRef.current) return;
    const cr = canvasRef.current.getBoundingClientRect();
    const startX = e.clientX - cr.left;
    const startY = e.clientY - cr.top;

    setActiveLink({
      fromNodeId: docId,
      fromSide: side,
      cursorX: startX,
      cursorY: startY,
    });

    document.body.classList.add("linking");
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePortPointerMove = (e: React.PointerEvent) => {
    if (!activeLink ||!canvasRef.current) return;
    const cr = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - cr.left;
    const y = e.clientY - cr.top;

    setActiveLink((prev) => prev? {...prev, cursorX: x, cursorY: y }: null);

    // Hit test target ports
    const target = document.elementFromPoint(e.clientX, e.clientY);
    const portEl = target?.closest(".port");
    
    if (portEl) {
      const nodeId = portEl.getAttribute("data-node-id");
      const side = portEl.classList.contains("right")? "right": "left";
      
      if (nodeId && nodeId!== activeLink.fromNodeId) {
        setHoveredPort({ nodeId, side: side as "left" | "right" });
        return;
      }
    }
    setHoveredPort(null);
  };

  const handlePortPointerUp = (e: React.PointerEvent) => {
    if (!activeLink) return;
    
    if (hoveredPort && hoveredPort.nodeId!== activeLink.fromNodeId) {
      // Connect ports: from side and to side should ideally be different
      let fromId = activeLink.fromNodeId;
      let toId = hoveredPort.nodeId;
      
      // Always normalize edge direction from a 'right' port to a 'left' port when possible
      if (activeLink.fromSide === "left" && hoveredPort.side === "right") {
        fromId = hoveredPort.nodeId;
        toId = activeLink.fromNodeId;
      }
      
      addEdge(fromId, toId);
    }

    setActiveLink(null);
    setHoveredPort(null);
    document.body.classList.remove("linking");
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  };

  // Helper for source type icon
  const renderSourceIcon = (type: string) => {
    const t = type.toLowerCase();
    if (t === "pdf") {
      return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path d="M14 2v6h6" />
        </svg>
      );
    } else if (t === "xlsx" || t === "csv" || t === "spreadsheet") {
      return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M3 9h18M9 3v18" />
        </svg>
      );
    } else if (t === "youtube") {
      return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22.5 7.5s-.2-1.6-.9-2.3c-.9-.9-1.9-.9-2.4-1C16.1 4 12 4 12 4s-4.1 0-7.2.2c-.5.1-1.5.1-2.4 1-.7.7-.9 2.3-.9 2.3S1.3 9.4 1.3 11.3v1.4c0 1.9.2 3.8.2 3.8s.2 1.6.9 2.3c.9.9 2.9 2.6 1 1.9.2 7.2 7.2s4.1 0 7.2-.2c.5-.1 1.5-.1 2.4-1.7-.7.9-2.3.9-2.3s.2-1.9.2-3.8v-1.4c0-1.9-.2-3.8-.2-3.8z" />
          <path d="M9.8 8.8v6.4l6-3.2z" fill="#ef4444" stroke="none" />
        </svg>
      );
    } else if (t === "url" || t === "website") {
      return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" />
        </svg>
      );
    } else {
      return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path d="M14 2v6h6M8 13h8M8 17h5" />
        </svg>
      );
    }
  };

  // Node rendering helper
  const renderNode = (doc: Doc) => {
    const pos = positions[doc.id] || { x: 50, y: 50 };
    
    // Status colors
    let statusColor = "var(--text-faint)";
    let statusText = "Pending";
    if (doc.status === "ready") {
      statusColor = "var(--green)";
      statusText = "Ready";
    } else if (doc.status === "processing") {
      statusColor = "var(--amber)";
      statusText = "Processing";
    } else if (doc.status === "failed") {
      statusColor = "var(--red)";
      statusText = "Failed";
    }

    const isLeftLit = isPortConnected(doc.id, "left");
    const isRightLit = isPortConnected(doc.id, "right");
    const isLeftHoverTarget = hoveredPort?.nodeId === doc.id && hoveredPort?.side === "left";
    const isRightHoverTarget = hoveredPort?.nodeId === doc.id && hoveredPort?.side === "right";

    return (
      <div
        key={doc.id}
        id={`node-${doc.id}`}
        className={`node ${doc.status === "processing"? "ghost": ""}`}
        style={{ left: pos.x, top: pos.y }}
        onPointerDown={(e) => handleNodePointerDown(doc.id, e)}
        onPointerMove={handleNodePointerMove}
        onPointerUp={handleNodePointerUp}
        data-node
      >
        {/* Left Input Port */}
        <span
          className={`port left ${isLeftLit? "lit": ""} ${isLeftHoverTarget? "drag-target": ""}`}
          data-node-id={doc.id}
          onPointerDown={(e) => handlePortPointerDown(doc.id, "left", e)}
          onPointerMove={handlePortPointerMove}
          onPointerUp={handlePortPointerUp}
        />

        <div className="node-head">
          <span className="nh-dot" style={{ backgroundColor: statusColor }} />
          <span className="nh-title" title={doc.filename}>
            {doc.filename}
          </span>
          <span className="nh-ic">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="5" r="1.2" fill="currentColor" />
              <circle cx="12" cy="12" r="1.2" fill="currentColor" />
              <circle cx="12" cy="19" r="1.2" fill="currentColor" />
            </svg>
          </span>
        </div>
        
        <div className="node-body">
          <div className="node-rows">
            <div className="node-row">
              <span className="k">Format</span>
              <span className="v uppercase">{doc.file_type}</span>
            </div>
            <div className="node-row">
              <span className="k">Status</span>
              <span className="v" style={{ color: statusColor }}>
                {statusText}
              </span>
            </div>
          </div>
          
          <div className="node-tags">
            <span className={`tag ${doc.status === "ready"? "green": doc.status === "failed"? "red": "amber"}`}>
              {doc.status === "ready"? "Grounded": statusText}
            </span>
          </div>
        </div>

        {/* Right Output Port */}
        <span
          className={`port right ${isRightLit? "lit": ""} ${isRightHoverTarget? "drag-target": ""}`}
          data-node-id={doc.id}
          onPointerDown={(e) => handlePortPointerDown(doc.id, "right", e)}
          onPointerMove={handlePortPointerMove}
          onPointerUp={handlePortPointerUp}
        />
      </div>
    );
  };

  // Synthesis node rendering helper
  const renderSynthesisNode = (node: SynthesisNode) => {
    const pos = positions[node.id] || { x: 50, y: 50 };
    const isLeftHoverTarget = hoveredPort?.nodeId === node.id && hoveredPort?.side === "left";
    const isLeftLit = node.input_document_ids.length > 0;

    return (
      <div
        key={node.id}
        id={`node-${node.id}`}
        className="node synthesis-node"
        style={{ left: pos.x, top: pos.y }}
        onPointerDown={(e) => handleNodePointerDown(node.id, e)}
        onPointerMove={handleNodePointerMove}
        onPointerUp={handleNodePointerUp}
        data-node
      >
        {/* Left Input Port */}
        <span
          className={`port left ${isLeftLit? "lit": ""} ${isLeftHoverTarget? "drag-target": ""}`}
          data-node-id={node.id}
          onPointerDown={(e) => handlePortPointerDown(node.id, "left", e)}
          onPointerMove={handlePortPointerMove}
          onPointerUp={handlePortPointerUp}
        />

        <div className="node-head">
          <span className="nh-dot synthesis-dot" />
          <input
            type="text"
            className="nh-title-input"
            value={node.title}
            onChange={(e) => {
              const newTitle = e.target.value;
              setSynthesisNodes((prev) =>
                prev.map((sn) => (sn.id === node.id? {...sn, title: newTitle }: sn))
              );
              if (saveTimer.current) clearTimeout(saveTimer.current);
              saveTimer.current = setTimeout(() => {
                apiClient.patch(`/api/v1/workspaces/${workspaceId}/synthesis/${node.id}`, {
                  title: newTitle,
                }).catch((err) => console.error("Failed to update synthesis title:", err));
              }, 600);
            }}
          />
          <button
            className="node-delete-btn"
            onClick={async () => {
              try {
                await apiClient.del(`/api/v1/workspaces/${workspaceId}/synthesis/${node.id}`);
                setSynthesisNodes((prev) => prev.filter((sn) => sn.id!== node.id));
              } catch (err) {
                console.error("Failed to delete synthesis node:", err);
              }
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="node-body">
          <div className="node-rows">
            <div className="node-row">
              <span className="k">Inputs</span>
              <span className="v font-bold">{node.input_document_ids.length} sources</span>
            </div>
          </div>
          
          <button
            className="run-synthesis-btn"
            onClick={() => {
              onAskClick({ id: node.id, title: node.title, count: node.input_document_ids.length });
            }}
          >
            Run synthesis
          </button>
        </div>
      </div>
    );
  };

  // Generate standard bars layout for Weekly Activity
  const barHeights = [28, 34, 30, 38, 32, 40, 36, 44, 40, 48, 42, 52, 46, 56, 50, 60, 54, 64, 58, 70, 62, 74, 66, 80, 72, 86, 78, 92, 84, 96];

  return (
    <div className="canvas-wrap" id="canvas-wrap" ref={canvasRef}>
      {/* SVG overlay for wires */}
      <svg className="wires">
        <defs>
          <linearGradient id="wireGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#14532d" />
            <stop offset="50%" stopColor="#22c55e" />
            <stop offset="100%" stopColor="#14532d" />
          </linearGradient>
        </defs>

        {/* Render persistent edges */}
        {edges.map((edge) => {
          const p1 = getPortPos(edge.from_document_id, "right");
          const p2 = getPortPos(edge.to_document_id, "left");
          
          if (p1.x === 0 || p2.x === 0) return null; // Wait for positions to load

          const d = getCurvePath(p1, p2);

          return (
            <g key={edge.id} className="edge" style={{ pointerEvents: "auto" }}>
              <path d={d} className="wire active" />
              <path
                d={d}
                className="wire-hit"
                onClick={() => removeEdge(edge.id)}
              />
              <circle r="3.2" className="wire-dot">
                <animateMotion dur="3s" repeatCount="indefinite" path={d} />
              </circle>
            </g>
          );
        })}

        {/* Render synthesis input wires */}
        {synthesisNodes.flatMap((node) =>
          node.input_document_ids.map((docId) => {
            const p1 = getPortPos(docId, "right");
            const p2 = getPortPos(node.id, "left");
            
            if (p1.x === 0 || p2.x === 0) return null;

            const d = getCurvePath(p1, p2);

            return (
              <g key={`${node.id}-${docId}`} className="edge" style={{ pointerEvents: "auto" }}>
                <path d={d} className="wire active synthesis-wire" />
                <path
                  d={d}
                  className="wire-hit"
                  onClick={async () => {
                    try {
                      await apiClient.del(`/api/v1/workspaces/${workspaceId}/synthesis/${node.id}/inputs/${docId}`);
                      setSynthesisNodes((prev) =>
                        prev.map((sn) =>
                          sn.id === node.id
                            ? {
                                ...sn,
                                input_document_ids: sn.input_document_ids.filter((id) => id!== docId),
                              }
                            : sn
                        )
                      );
                    } catch (err) {
                      console.error("Failed to remove synthesis input:", err);
                    }
                  }}
                />
                <circle r="3.2" className="wire-dot synthesis-wire-dot">
                  <animateMotion dur="3s" repeatCount="indefinite" path={d} />
                </circle>
              </g>
            );
          })
        )}

        {/* Render active dragging wire */}
        {activeLink && (() => {
          const startPos = getPortPos(activeLink.fromNodeId, activeLink.fromSide);
          const endPos = { x: activeLink.cursorX, y: activeLink.cursorY };
          const d = activeLink.fromSide === "right"
            ? getCurvePath(startPos, endPos)
            : getCurvePath(endPos, startPos);

          return <path d={d} className="wire temp" />;
        })()}
      </svg>

      <div className="canvas-vignette" />

      {/* Top Left Title */}
      <div className="canvas-title">
        <h1>{documents && documents.length > 0? "Corpus Mapping Canvas": "Research Dashboard"}</h1>
        <p>AtlasLM Notebook · {documents?.length || 0} sources · Live updates</p>
      </div>

      {/* Left Source Dock */}
      {!dockCollapsed && (
        <div className="dock" id="dock" style={{ left: 0 }}>
          <button className="dock-toggle" style={{ right: "-13px" }} onClick={() => setDockCollapsed(true)}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          
          <h3>Sources</h3>
          
          <div className="flex-grow overflow-y-auto flex flex-col gap-2 max-h-[70vh]">
            {(documents || []).map((doc) => (
              <div key={doc.id} className="dock-item" title={doc.filename}>
                <div className="di-ic">{renderSourceIcon(doc.file_type)}</div>
                <div className="overflow-hidden flex-grow">
                  <div className="di-name truncate">{doc.filename}</div>
                  <div className="di-meta uppercase">{doc.file_type}</div>
                </div>
              </div>
            ))}
          </div>

          <button className="dock-add" onClick={onAddSourceClick}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Add Source
          </button>
        </div>
      )}

      {dockCollapsed && (
        <button
          className="dock-toggle"
          style={{ left: "12px", top: "92px", position: "absolute", zIndex: 30 }}
          onClick={() => setDockCollapsed(false)}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      )}

      {/* Center Draggable Nodes */}
      {(documents || []).map((doc) => renderNode(doc))}
      {synthesisNodes.map((node) => renderSynthesisNode(node))}

      {/* Right Rail Details */}
      <div className="right-panel">
        {/* Weekly Activity */}
        <div className="rp-card">
          <div className="rp-head">
            <h2>Activity Logs</h2>
          </div>
          <div className="activity-inner">
            <h3>Intel Operations</h3>
            <span className="link" onClick={() => onAskClick()}>Open Grounded Chat</span>
            
            <div className="chart-zone">
              <div className="callout-dot" />
              <div className="bars">
                {barHeights.map((h, idx) => (
                  <div
                    key={idx}
                    className={`bar ${idx > 24? "hot": idx < 6? "dim": ""}`}
                    style={{ height: `${h}%` }}
                  />
                ))}
              </div>
              <div className="divider-v" />
              <div className="chart-callout">
                <div className="big">100<span>%</span></div>
                <div className="sub">grounded rate</div>
              </div>
            </div>

            <div className="day-axis">
              <span>Sat</span><span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span>
            </div>
            
            <div className="stat-row">
              <div className="stat-big">
                <div className="num">{documents?.length || 0}</div>
                <div className="lbl">Active Nodes</div>
                <div className="delta">+{edges.length} connected wires</div>
              </div>
            </div>
          </div>

          {/* Completed Deliverables List */}
          <div className={`task-group ${tasksOpen.outputs? "open": ""}`} onClick={() => setTasksOpen(prev => ({...prev, outputs:!prev.outputs }))}>
            <div className="tg-text">
              <h4>Grounded Artifacts</h4>
              <p>{studioOutputs?.length || 0} deliverables generated</p>
            </div>
            <span className="chev">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </span>
          </div>

          {tasksOpen.outputs && (
            <div className="tg-items">
              {(studioOutputs || []).slice(0, 3).map((out) => (
                <div key={out.id} className="tg-item">
                  <span className="ti-dot" style={{ backgroundColor: "var(--green)" }} />
                  <span className="truncate">{out.title}</span>
                </div>
              ))}
              {studioOutputs?.length === 0 && (
                <div className="tg-item text-zinc-500 italic">No studio outputs yet</div>
              )}
            </div>
          )}

          {/* In Progress tasks */}
          <div className={`task-group ${tasksOpen.progress? "open": ""}`} onClick={() => setTasksOpen(prev => ({...prev, progress:!prev.progress }))}>
            <div className="tg-text">
              <h4>System Threads</h4>
              <p>Pipeline is active</p>
            </div>
            <span className="chev">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </span>
          </div>

          {tasksOpen.progress && (
            <div className="tg-items">
              <div className="tg-item">
                <span className="ti-dot" style={{ backgroundColor: "var(--green)" }} />
                <span>RAG indexing engine online</span>
              </div>
              <div className="tg-item">
                <span className="ti-dot" style={{ backgroundColor: "var(--green)" }} />
                <span>Redis worker queue listening</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Toolbar */}
      <div className="toolbar">
        <button className="tb-btn primary" title="Select Tool">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 3l7.5 18 2.5-7.5L20.5 11z" />
          </svg>
        </button>
        <button className="tb-btn" title="Notebook Links" onClick={onAddSourceClick}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2l10 6-10 6L2 8z" />
            <path d="M2 14l10 6 10-6" />
          </svg>
        </button>
        <button
          className="tb-btn"
          title="Add Synthesis Node"
          onClick={async () => {
            try {
              const node = await apiClient.post<SynthesisNode>(`/api/v1/workspaces/${workspaceId}/synthesis`, {
                title: "Synthesis",
                x_pos: 150 + Math.random() * 150,
                y_pos: 150 + Math.random() * 150,
              });
              setSynthesisNodes((prev) => [...prev, node]);
              setPositions((prev) => ({
                ...prev,
                [node.id]: { x: node.x_pos, y: node.y_pos },
              }));
            } catch (err) {
              console.error("Failed to create synthesis node:", err);
            }
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v8M8 12h8" />
          </svg>
        </button>
        <div className="tb-sep" />
        <div className="tb-status" onClick={() => onAskClick()}>
          <span className="pulse" />
          Engine Ready
        </div>
        <button className="tb-send" title="Ask AtlasLM Chat" onClick={() => onAskClick()}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 2L11 13M22 2l-7 20-4-9-9-4z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
