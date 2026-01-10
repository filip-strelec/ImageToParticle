"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { ImageData as ImageDataType, ParticleData, ParticleEdit, OptionalMask } from "@/types";
import { Plus, Trash2, Eye, EyeOff, ZoomIn } from "lucide-react";

type EditMode = "add" | "delete" | "view";

interface ParticleEditorProps {
  imageData: ImageDataType;
  particles: ParticleData[];
  edits: ParticleEdit[];
  onEditsChange: (edits: ParticleEdit[]) => void;
  optionalMasks?: OptionalMask[];
  selectedMaskSlugs?: string[]; // Which masks to apply to new particles
  onSelectedMaskSlugsChange?: (slugs: string[]) => void;
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

export default function ParticleEditor({
  imageData,
  particles,
  edits,
  onEditsChange,
  optionalMasks = [],
  selectedMaskSlugs = [],
  onSelectedMaskSlugsChange,
}: ParticleEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [editMode, setEditMode] = useState<EditMode>("view");
  const [brushSize, setBrushSize] = useState(15);
  const [particleColor, setParticleColor] = useState("#ffffff");
  const [showParticles, setShowParticles] = useState(true);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const scaleRef = useRef(1);
  const offsetRef = useRef({ x: 0, y: 0 });
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const lastPanPos = useRef({ x: 0, y: 0 });

  // Load image
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imageRef.current = img;
      drawCanvas();
    };
    img.src = imageData.dataUrl;
  }, [imageData.dataUrl]);

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    const newWidth = rect.width * dpr;
    const newHeight = rect.height * dpr;
    if (canvas.width !== newWidth || canvas.height !== newHeight) {
      canvas.width = newWidth;
      canvas.height = newHeight;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Calculate scale with zoom
    const cssWidth = rect.width;
    const cssHeight = rect.height;
    const imgAspect = imageData.width / imageData.height;
    const canvasAspect = cssWidth / cssHeight;

    let scale: number, offsetX: number, offsetY: number;
    if (imgAspect > canvasAspect) {
      scale = (cssWidth / imageData.width) * zoomLevel;
      offsetX = (cssWidth - imageData.width * scale) / 2 + panOffset.x;
      offsetY = (cssHeight - imageData.height * scale) / 2 + panOffset.y;
    } else {
      scale = (cssHeight / imageData.height) * zoomLevel;
      offsetX = (cssWidth - imageData.width * scale) / 2 + panOffset.x;
      offsetY = (cssHeight - imageData.height * scale) / 2 + panOffset.y;
    }

    scaleRef.current = scale;
    offsetRef.current = { x: offsetX, y: offsetY };

    // Draw image with slight dimming
    ctx.clearRect(0, 0, cssWidth, cssHeight);
    ctx.globalAlpha = 0.5;
    ctx.drawImage(img, offsetX, offsetY, imageData.width * scale, imageData.height * scale);
    ctx.globalAlpha = 1;

    // Build a set of deleted particle zones for efficient checking
    const deleteZones = edits.filter(e => e.type === "delete");

    // Helper to check if a particle is deleted
    const isParticleDeleted = (x: number, y: number) => {
      for (const zone of deleteZones) {
        const dx = x - zone.x;
        const dy = y - zone.y;
        const radius = zone.radius || brushSize;
        if (dx * dx + dy * dy < radius * radius) {
          return true;
        }
      }
      return false;
    };

    // Draw existing particles
    if (showParticles) {
      ctx.globalAlpha = 0.6;
      for (const p of particles) {
        // Check if particle was deleted
        if (isParticleDeleted(p.x, p.y)) continue;

        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(
          offsetX + p.x * scale,
          offsetY + p.y * scale,
          3, 0, Math.PI * 2
        );
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // Draw added particles (from edits)
    for (const edit of edits) {
      if (edit.type === "add") {
        // Check if this added particle was subsequently deleted
        if (isParticleDeleted(edit.x, edit.y)) continue;

        ctx.fillStyle = edit.color || "#ffffff";
        ctx.beginPath();
        ctx.arc(
          offsetX + edit.x * scale,
          offsetY + edit.y * scale,
          (edit.size || 3) * scale,
          0, Math.PI * 2
        );
        ctx.fill();

        // Only show ring indicator when not in view mode
        if (editMode !== "view") {
          ctx.strokeStyle = "#22c55e";
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      } else if (edit.type === "delete" && editMode !== "view") {
        // Only show delete zones when not in view mode
        ctx.strokeStyle = "rgba(239, 68, 68, 0.5)";
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(
          offsetX + edit.x * scale,
          offsetY + edit.y * scale,
          (edit.radius || brushSize) * scale,
          0, Math.PI * 2
        );
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }, [imageData, particles, edits, showParticles, brushSize, editMode, zoomLevel, panOffset]);

  useEffect(() => {
    drawCanvas();
    window.addEventListener("resize", drawCanvas);
    return () => window.removeEventListener("resize", drawCanvas);
  }, [drawCanvas]);

  const getImageCoords = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const x = (clientX - rect.left - offsetRef.current.x) / scaleRef.current;
    const y = (clientY - rect.top - offsetRef.current.y) / scaleRef.current;
    return { x, y };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    // Middle mouse button or shift+left click for panning
    if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
      setIsPanning(true);
      lastPanPos.current = { x: e.clientX, y: e.clientY };
      e.preventDefault();
      return;
    }

    if (editMode === "view") return;

    const coords = getImageCoords(e.clientX, e.clientY);
    if (!coords) return;

    // Check bounds
    if (coords.x < 0 || coords.x > imageData.width || coords.y < 0 || coords.y > imageData.height) {
      return;
    }

    if (editMode === "add") {
      const newEdit: ParticleEdit = {
        id: generateId(),
        type: "add",
        x: coords.x,
        y: coords.y,
        color: particleColor,
        size: 3,
        optionalMasks: selectedMaskSlugs.length > 0 ? [...selectedMaskSlugs] : undefined,
      };
      onEditsChange([...edits, newEdit]);
    } else if (editMode === "delete") {
      const newEdit: ParticleEdit = {
        id: generateId(),
        type: "delete",
        x: coords.x,
        y: coords.y,
        radius: brushSize,
      };
      onEditsChange([...edits, newEdit]);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (canvas) {
      const rect = canvas.getBoundingClientRect();
      setCursorPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    }

    if (isPanning) {
      const dx = e.clientX - lastPanPos.current.x;
      const dy = e.clientY - lastPanPos.current.y;
      setPanOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      lastPanPos.current = { x: e.clientX, y: e.clientY };
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  const undoLastEdit = () => {
    if (edits.length > 0) {
      onEditsChange(edits.slice(0, -1));
    }
  };

  const clearAllEdits = () => {
    onEditsChange([]);
  };

  const toggleMaskSlug = (slug: string) => {
    if (!onSelectedMaskSlugsChange) return;
    if (selectedMaskSlugs.includes(slug)) {
      onSelectedMaskSlugsChange(selectedMaskSlugs.filter(s => s !== slug));
    } else {
      onSelectedMaskSlugsChange([...selectedMaskSlugs, slug]);
    }
  };

  const addedCount = edits.filter(e => e.type === "add").length;
  const deletedCount = edits.filter(e => e.type === "delete").length;

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
      <div className="p-3 border-b border-gray-800">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm text-gray-400">Particle Editor</span>
            <p className="text-xs text-gray-500 mt-1">
              Add or delete particles manually
            </p>
          </div>
          <div className="text-xs text-gray-400">
            <span className="text-green-400">+{addedCount}</span> / <span className="text-red-400">-{deletedCount}</span>
          </div>
        </div>
      </div>

      <div className="relative">
        <canvas
          ref={canvasRef}
          className={`w-full h-[400px] ${isPanning ? "cursor-grab" : editMode === "view" ? "cursor-default" : "cursor-crosshair"}`}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => {
            handleMouseUp();
            setCursorPos(null);
          }}
          onContextMenu={(e) => e.preventDefault()}
        />

        {/* Cursor indicator */}
        {cursorPos && editMode !== "view" && !isPanning && (
          <div
            className="pointer-events-none absolute rounded-full border-2"
            style={{
              left: cursorPos.x,
              top: cursorPos.y,
              width: editMode === "delete" ? brushSize * 2 * zoomLevel : 10,
              height: editMode === "delete" ? brushSize * 2 * zoomLevel : 10,
              transform: "translate(-50%, -50%)",
              borderColor: editMode === "add" ? "#22c55e" : "#ef4444",
              backgroundColor: editMode === "add" ? "rgba(34, 197, 94, 0.2)" : "rgba(239, 68, 68, 0.2)",
            }}
          />
        )}
      </div>

      <div className="p-4 space-y-3 border-t border-gray-800">
        {/* Mode Selection */}
        <div className="flex gap-2">
          <button
            onClick={() => setEditMode("view")}
            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
              editMode === "view" ? "bg-gray-600 text-white" : "bg-gray-800 text-gray-300 hover:bg-gray-700"
            }`}
          >
            <Eye className="w-4 h-4" />
            View
          </button>
          <button
            onClick={() => setEditMode("add")}
            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
              editMode === "add" ? "bg-green-600 text-white" : "bg-gray-800 text-gray-300 hover:bg-gray-700"
            }`}
          >
            <Plus className="w-4 h-4" />
            Add
          </button>
          <button
            onClick={() => setEditMode("delete")}
            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
              editMode === "delete" ? "bg-red-600 text-white" : "bg-gray-800 text-gray-300 hover:bg-gray-700"
            }`}
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
        </div>

        {/* Add Mode Options */}
        {editMode === "add" && (
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <label className="text-sm text-gray-400">Color:</label>
              <input
                type="color"
                value={particleColor}
                onChange={(e) => setParticleColor(e.target.value)}
                className="w-8 h-8 rounded cursor-pointer"
              />
              <span className="text-xs text-gray-500 font-mono">{particleColor}</span>
            </div>

            {optionalMasks.length > 0 && (
              <div>
                <label className="text-sm text-gray-400 block mb-1">Assign to masks:</label>
                <div className="flex flex-wrap gap-2">
                  {optionalMasks.map(mask => (
                    <button
                      key={mask.id}
                      onClick={() => toggleMaskSlug(mask.slug)}
                      className={`px-2 py-1 rounded text-xs transition-colors flex items-center gap-1 ${
                        selectedMaskSlugs.includes(mask.slug)
                          ? "bg-indigo-600 text-white"
                          : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                      }`}
                    >
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: mask.color }} />
                      {mask.slug}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Delete Mode Options */}
        {editMode === "delete" && (
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Delete Radius</span>
              <span className="text-white font-mono">{brushSize}px</span>
            </div>
            <input
              type="range"
              min={1}
              max={50}
              value={brushSize}
              onChange={(e) => setBrushSize(parseInt(e.target.value))}
              className="w-full"
            />
          </div>
        )}

        {/* Zoom Level */}
        <div className="space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400 flex items-center gap-1">
              <ZoomIn className="w-3 h-3" />
              Zoom Level
            </span>
            <div className="flex items-center gap-2">
              <span className="text-white font-mono">{zoomLevel.toFixed(1)}x</span>
              {zoomLevel > 1 && (
                <button
                  onClick={() => {
                    setZoomLevel(1);
                    setPanOffset({ x: 0, y: 0 });
                  }}
                  className="text-xs text-indigo-400 hover:text-indigo-300"
                >
                  Reset
                </button>
              )}
            </div>
          </div>
          <input
            type="range"
            min={1}
            max={5}
            step={0.1}
            value={zoomLevel}
            onChange={(e) => setZoomLevel(parseFloat(e.target.value))}
            className="w-full"
          />
          {zoomLevel > 1 && (
            <p className="text-xs text-gray-500">Shift+Drag to pan when zoomed</p>
          )}
        </div>

        {/* Toggle & Actions */}
        <div className="flex gap-2">
          <button
            onClick={() => setShowParticles(!showParticles)}
            className="flex-1 px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-gray-300 transition-colors flex items-center justify-center gap-2"
          >
            {showParticles ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            {showParticles ? "Hide" : "Show"} Particles
          </button>
          <button
            onClick={undoLastEdit}
            disabled={edits.length === 0}
            className="px-3 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm text-gray-300 transition-colors"
          >
            Undo
          </button>
          <button
            onClick={clearAllEdits}
            disabled={edits.length === 0}
            className="px-3 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm text-white transition-colors"
          >
            Clear All
          </button>
        </div>
      </div>
    </div>
  );
}

