"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { ImageData as ImageDataType, OptionalMask } from "@/types";
import { Eraser, Trash2, Eye, EyeOff, Paintbrush, ZoomIn, Undo2 } from "lucide-react";

interface MaskingToolProps {
  imageData: ImageDataType;
  onMaskChange: (maskData: Uint8ClampedArray) => void;
  initialMaskData?: Uint8ClampedArray;
  // Optional mask support
  optionalMasks?: OptionalMask[];
  activeMaskId?: string | null;
  onOptionalMaskChange?: (maskId: string, data: Uint8ClampedArray) => void;
  isEditingOptionalMask?: boolean; // true = edit optional mask, false = edit main interaction mask
}

export default function MaskingTool({
  imageData,
  onMaskChange,
  initialMaskData,
  optionalMasks = [],
  activeMaskId = null,
  onOptionalMaskChange,
  isEditingOptionalMask = false,
}: MaskingToolProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushSize, setBrushSize] = useState(20);
  const [showMask, setShowMask] = useState(true);
  const [showOtherMasks, setShowOtherMasks] = useState(true);
  const [toolMode, setToolMode] = useState<"draw" | "erase">("draw");
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const lastPanPos = useRef({ x: 0, y: 0 });
  const scaleRef = useRef(1);
  const offsetRef = useRef({ x: 0, y: 0 });
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);

  // Undo history - stores mask data snapshots
  const historyRef = useRef<Uint8ClampedArray[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const MAX_HISTORY = 20;

  // Load image once
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imageRef.current = img;
      drawCanvas();
    };
    img.src = imageData.dataUrl;
  }, [imageData.dataUrl]);

  // Initialize mask canvas
  useEffect(() => {
    const maskCanvas = document.createElement("canvas");
    maskCanvas.width = imageData.width;
    maskCanvas.height = imageData.height;
    maskCanvasRef.current = maskCanvas;

    const maskCtx = maskCanvas.getContext("2d");
    if (maskCtx) {
      if (initialMaskData) {
        // Restore existing mask data
        // Create a new Uint8ClampedArray from the data to ensure proper type
        const clampedArray = new Uint8ClampedArray(initialMaskData);
        const maskImageData = new ImageData(clampedArray, maskCanvas.width, maskCanvas.height);
        maskCtx.putImageData(maskImageData, 0, 0);
      } else {
        // Clear mask (white = unmasked)
        maskCtx.fillStyle = "white";
        maskCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);
      }
    }

    drawCanvas();
  }, [imageData, initialMaskData]);

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const maskCanvas = maskCanvasRef.current;
    const img = imageRef.current;
    if (!canvas || !maskCanvas || !img) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    // Only resize canvas if dimensions changed
    const newWidth = rect.width * dpr;
    const newHeight = rect.height * dpr;
    if (canvas.width !== newWidth || canvas.height !== newHeight) {
      canvas.width = newWidth;
      canvas.height = newHeight;
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Calculate scale and offset with zoom
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

    // Clear and draw
    ctx.clearRect(0, 0, cssWidth, cssHeight);
    ctx.drawImage(img, offsetX, offsetY, imageData.width * scale, imageData.height * scale);

    // Draw mask overlay if visible
    if (showMask) {
      // Helper to draw a mask overlay
      const drawMaskOverlay = (
        data: Uint8ClampedArray,
        r: number,
        g: number,
        b: number,
        alpha: number
      ) => {
        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = imageData.width;
        tempCanvas.height = imageData.height;
        const tempCtx = tempCanvas.getContext("2d");
        if (tempCtx) {
          const overlayData = tempCtx.createImageData(imageData.width, imageData.height);
          for (let i = 0; i < data.length; i += 4) {
            if (data[i] < 128) {
              overlayData.data[i] = r;
              overlayData.data[i + 1] = g;
              overlayData.data[i + 2] = b;
              overlayData.data[i + 3] = alpha;
            } else {
              overlayData.data[i + 3] = 0;
            }
          }
          tempCtx.putImageData(overlayData, 0, 0);
          ctx.drawImage(tempCanvas, offsetX, offsetY, imageData.width * scale, imageData.height * scale);
        }
      };

      // Determine what to draw based on editing mode
      const isEditingInteraction = !isEditingOptionalMask;

      // Draw other masks first (bottom layer) if showOtherMasks is enabled
      if (showOtherMasks) {
        // Draw optional masks (if we're editing interaction mask)
        if (isEditingInteraction) {
          for (const mask of optionalMasks) {
            if (mask.data) {
              const colorMatch = mask.color.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
              const r = colorMatch ? parseInt(colorMatch[1], 16) : 255;
              const g = colorMatch ? parseInt(colorMatch[2], 16) : 0;
              const b = colorMatch ? parseInt(colorMatch[3], 16) : 0;
              drawMaskOverlay(mask.data, r, g, b, 80);
            }
          }
        } else {
          // Draw interaction mask (if we're editing optional mask)
          const maskCtx = maskCanvas.getContext("2d");
          if (maskCtx) {
            const maskImageData = maskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
            drawMaskOverlay(maskImageData.data as unknown as Uint8ClampedArray, 99, 102, 241, 80);
          }

          // Draw other optional masks (not the active one)
          for (const mask of optionalMasks) {
            if (mask.data && mask.id !== activeMaskId) {
              const colorMatch = mask.color.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
              const r = colorMatch ? parseInt(colorMatch[1], 16) : 255;
              const g = colorMatch ? parseInt(colorMatch[2], 16) : 0;
              const b = colorMatch ? parseInt(colorMatch[3], 16) : 0;
              drawMaskOverlay(mask.data, r, g, b, 80);
            }
          }
        }
      }

      // Draw the currently editing mask on top (highest visibility)
      if (isEditingInteraction) {
        // Draw interaction mask on top
        const maskCtx = maskCanvas.getContext("2d");
        if (maskCtx) {
          const maskImageData = maskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
          drawMaskOverlay(maskImageData.data as unknown as Uint8ClampedArray, 99, 102, 241, 180);
        }
      } else {
        // Draw active optional mask on top
        const activeMask = optionalMasks.find(m => m.id === activeMaskId);
        if (activeMask?.data) {
          const colorMatch = activeMask.color.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
          const r = colorMatch ? parseInt(colorMatch[1], 16) : 255;
          const g = colorMatch ? parseInt(colorMatch[2], 16) : 0;
          const b = colorMatch ? parseInt(colorMatch[3], 16) : 0;
          drawMaskOverlay(activeMask.data, r, g, b, 180);
        }
      }
    }
  }, [imageData, showMask, showOtherMasks, zoomLevel, panOffset, optionalMasks, activeMaskId, isEditingOptionalMask]);

  useEffect(() => {
    drawCanvas();
    window.addEventListener("resize", drawCanvas);
    return () => window.removeEventListener("resize", drawCanvas);
  }, [drawCanvas]);

  const getCanvasCoords = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    // Convert to image coordinates
    const imgX = (x - offsetRef.current.x) / scaleRef.current;
    const imgY = (y - offsetRef.current.y) / scaleRef.current;

    return { x: imgX, y: imgY };
  };

  const drawMask = (x: number, y: number) => {
    // Determine if we're editing an optional mask or the main interaction mask
    if (isEditingOptionalMask && activeMaskId && onOptionalMaskChange) {
      // Find the active optional mask
      const activeMask = optionalMasks.find(m => m.id === activeMaskId);
      if (!activeMask) return;

      // Create or get the mask canvas for this optional mask
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = imageData.width;
      tempCanvas.height = imageData.height;
      const tempCtx = tempCanvas.getContext("2d");
      if (!tempCtx) return;

      // Restore existing mask data if present
      if (activeMask.data) {
        const existingData = new ImageData(
          new Uint8ClampedArray(activeMask.data),
          imageData.width,
          imageData.height
        );
        tempCtx.putImageData(existingData, 0, 0);
      } else {
        // Start with white (unmasked)
        tempCtx.fillStyle = "white";
        tempCtx.fillRect(0, 0, imageData.width, imageData.height);
      }

      // Draw or erase
      if (toolMode === "draw") {
        tempCtx.fillStyle = "black";
      } else {
        tempCtx.fillStyle = "white";
      }

      tempCtx.beginPath();
      tempCtx.arc(x, y, brushSize / scaleRef.current, 0, Math.PI * 2);
      tempCtx.fill();

      // Notify parent
      const maskData = tempCtx.getImageData(0, 0, imageData.width, imageData.height).data;
      onOptionalMaskChange(activeMaskId, maskData);
    } else {
      // Edit main interaction mask
      const maskCanvas = maskCanvasRef.current;
      if (!maskCanvas) return;

      const ctx = maskCanvas.getContext("2d");
      if (!ctx) return;

      // Draw or erase based on tool mode
      if (toolMode === "draw") {
        ctx.fillStyle = "black";
      } else {
        ctx.fillStyle = "white";
      }

      ctx.beginPath();
      ctx.arc(x, y, brushSize / scaleRef.current, 0, Math.PI * 2);
      ctx.fill();

      // Notify parent of mask change
      const maskData = ctx.getImageData(0, 0, maskCanvas.width, maskCanvas.height).data;
      onMaskChange(maskData);
    }

    drawCanvas();
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    // Middle mouse button or space+left click for panning
    if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
      setIsPanning(true);
      lastPanPos.current = { x: e.clientX, y: e.clientY };
      e.preventDefault();
      return;
    }

    // Left click for drawing/erasing
    if (e.button === 0) {
      // Save current state before drawing for undo
      saveToHistory();
      setIsDrawing(true);
      const coords = getCanvasCoords(e.clientX, e.clientY);
      if (coords) drawMask(coords.x, coords.y);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    // Update cursor position for brush indicator
    const canvas = canvasRef.current;
    if (canvas) {
      const rect = canvas.getBoundingClientRect();
      setCursorPos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
    }

    if (isPanning) {
      const dx = e.clientX - lastPanPos.current.x;
      const dy = e.clientY - lastPanPos.current.y;
      setPanOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      lastPanPos.current = { x: e.clientX, y: e.clientY };
      return;
    }

    if (!isDrawing) return;
    const coords = getCanvasCoords(e.clientX, e.clientY);
    if (coords) drawMask(coords.x, coords.y);
  };

  const handleMouseLeave = () => {
    setCursorPos(null);
  };

  const handleMouseUp = () => {
    setIsDrawing(false);
    setIsPanning(false);
  };

  const clearMask = () => {
    // Save current state before clearing for undo
    saveToHistory();

    if (isEditingOptionalMask && activeMaskId && onOptionalMaskChange) {
      // Clear the active optional mask
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = imageData.width;
      tempCanvas.height = imageData.height;
      const tempCtx = tempCanvas.getContext("2d");
      if (!tempCtx) return;

      tempCtx.fillStyle = "white";
      tempCtx.fillRect(0, 0, imageData.width, imageData.height);

      const maskData = tempCtx.getImageData(0, 0, imageData.width, imageData.height).data;
      onOptionalMaskChange(activeMaskId, maskData);
    } else {
      // Clear main interaction mask
      const maskCanvas = maskCanvasRef.current;
      if (!maskCanvas) return;

      const ctx = maskCanvas.getContext("2d");
      if (!ctx) return;

      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);

      const maskData = ctx.getImageData(0, 0, maskCanvas.width, maskCanvas.height).data;
      onMaskChange(maskData);
    }
    drawCanvas();
  };

  // Save current mask state to history (call before making changes)
  const saveToHistory = useCallback(() => {
    let currentData: Uint8ClampedArray | null = null;

    if (isEditingOptionalMask && activeMaskId) {
      const activeMask = optionalMasks.find(m => m.id === activeMaskId);
      if (activeMask?.data) {
        currentData = new Uint8ClampedArray(activeMask.data);
      }
    } else {
      const maskCanvas = maskCanvasRef.current;
      if (maskCanvas) {
        const ctx = maskCanvas.getContext("2d");
        if (ctx) {
          currentData = new Uint8ClampedArray(ctx.getImageData(0, 0, maskCanvas.width, maskCanvas.height).data);
        }
      }
    }

    if (currentData) {
      historyRef.current.push(currentData);
      // Limit history size
      if (historyRef.current.length > MAX_HISTORY) {
        historyRef.current.shift();
      }
      setCanUndo(true);
    }
  }, [isEditingOptionalMask, activeMaskId, optionalMasks]);

  // Undo last action
  const undo = useCallback(() => {
    if (historyRef.current.length === 0) return;

    const previousData = historyRef.current.pop()!;
    setCanUndo(historyRef.current.length > 0);

    if (isEditingOptionalMask && activeMaskId && onOptionalMaskChange) {
      onOptionalMaskChange(activeMaskId, previousData);
    } else {
      const maskCanvas = maskCanvasRef.current;
      if (maskCanvas) {
        const ctx = maskCanvas.getContext("2d");
        if (ctx) {
          const imgData = new ImageData(previousData, maskCanvas.width, maskCanvas.height);
          ctx.putImageData(imgData, 0, 0);
          onMaskChange(previousData);
        }
      }
    }
    drawCanvas();
  }, [isEditingOptionalMask, activeMaskId, onOptionalMaskChange, onMaskChange, drawCanvas]);

  // Keyboard shortcuts (Ctrl+Z for undo)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undo]);

  // Get current mask info for display
  const getActiveMaskInfo = () => {
    if (isEditingOptionalMask && activeMaskId) {
      const mask = optionalMasks.find(m => m.id === activeMaskId);
      return mask ? { name: mask.name, color: mask.color } : null;
    }
    return { name: "Interaction Mask", color: "#000000" };
  };
  const activeMaskInfo = getActiveMaskInfo();

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
      <div className="p-3 border-b border-gray-800">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm text-gray-400">Masking Tool</span>
            <p className="text-xs text-gray-500 mt-1">
              Draw to mask areas • Shift+Drag to pan when zoomed
            </p>
          </div>
          {activeMaskInfo && (
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: activeMaskInfo.color }}
              />
              <span className="text-xs text-gray-300">
                Editing: <span className="font-medium">{activeMaskInfo.name}</span>
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="relative">
        <canvas
          ref={canvasRef}
          className={`w-full h-[400px] ${isPanning ? 'cursor-grab' : 'cursor-crosshair'}`}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={(e) => {
            handleMouseUp();
            handleMouseLeave();
          }}
          onContextMenu={(e) => e.preventDefault()}
        />

        {/* Brush size indicator */}
        {cursorPos && !isPanning && (
          <div
            className="pointer-events-none absolute rounded-full border-2"
            style={{
              left: cursorPos.x,
              top: cursorPos.y,
              width: brushSize * 2,
              height: brushSize * 2,
              transform: 'translate(-50%, -50%)',
              borderColor: toolMode === "draw" ? 'rgba(99, 102, 241, 0.8)' : 'rgba(239, 68, 68, 0.8)',
              backgroundColor: toolMode === "draw" ? 'rgba(99, 102, 241, 0.1)' : 'rgba(239, 68, 68, 0.1)',
            }}
          />
        )}
      </div>

      <div className="p-4 space-y-3 border-t border-gray-800">
        {/* Tool Mode Toggle */}
        <div className="flex gap-2">
          <button
            onClick={() => setToolMode("draw")}
            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
              toolMode === "draw"
                ? "bg-indigo-600 text-white"
                : "bg-gray-800 text-gray-300 hover:bg-gray-700"
            }`}
          >
            <Paintbrush className="w-4 h-4" />
            Draw Mask
          </button>
          <button
            onClick={() => setToolMode("erase")}
            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
              toolMode === "erase"
                ? "bg-indigo-600 text-white"
                : "bg-gray-800 text-gray-300 hover:bg-gray-700"
            }`}
          >
            <Eraser className="w-4 h-4" />
            Erase Mask
          </button>
        </div>

        {/* Brush Size */}
        <div className="space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Brush Size</span>
            <span className="text-white font-mono">{brushSize}px</span>
          </div>
          <input
            type="range"
            min={5}
            max={100}
            value={brushSize}
            onChange={(e) => setBrushSize(parseInt(e.target.value))}
            className="w-full"
          />
        </div>

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
        </div>

        {/* Visibility Toggles */}
        <div className="flex gap-2">
          <button
            onClick={() => setShowMask(!showMask)}
            className={`flex-1 px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-center gap-2 ${
              showMask
                ? "bg-indigo-600 text-white"
                : "bg-gray-800 text-gray-300 hover:bg-gray-700"
            }`}
          >
            {showMask ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            All Masks
          </button>
          <button
            onClick={() => setShowOtherMasks(!showOtherMasks)}
            className={`flex-1 px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-center gap-2 ${
              showOtherMasks
                ? "bg-gray-700 text-white"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700"
            }`}
            title="Toggle visibility of masks you're not currently editing"
          >
            {showOtherMasks ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            Other Masks
          </button>
        </div>

        {/* Undo and Clear Buttons */}
        <div className="flex gap-2">
          <button
            onClick={undo}
            disabled={!canUndo}
            className={`flex-1 px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-center gap-2 ${
              canUndo
                ? "bg-gray-700 hover:bg-gray-600 text-white"
                : "bg-gray-800 text-gray-500 cursor-not-allowed"
            }`}
            title="Undo (Ctrl+Z)"
          >
            <Undo2 className="w-4 h-4" />
            Undo
          </button>
          <button
            onClick={clearMask}
            className="flex-1 px-3 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm text-white transition-colors flex items-center justify-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Clear
          </button>
        </div>
      </div>
    </div>
  );
}

