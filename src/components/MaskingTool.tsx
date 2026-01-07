"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { ImageData as ImageDataType } from "@/types";
import { Eraser, Trash2, Eye, EyeOff, Paintbrush, ZoomIn } from "lucide-react";

interface MaskingToolProps {
  imageData: ImageDataType;
  onMaskChange: (maskData: Uint8ClampedArray) => void;
  initialMaskData?: Uint8ClampedArray;
}

export default function MaskingTool({ imageData, onMaskChange, initialMaskData }: MaskingToolProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushSize, setBrushSize] = useState(20);
  const [showMask, setShowMask] = useState(true);
  const [toolMode, setToolMode] = useState<"draw" | "erase">("draw");
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const lastPanPos = useRef({ x: 0, y: 0 });
  const scaleRef = useRef(1);
  const offsetRef = useRef({ x: 0, y: 0 });
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);

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
      ctx.globalAlpha = 0.5;
      ctx.drawImage(maskCanvas, offsetX, offsetY, imageData.width * scale, imageData.height * scale);
      ctx.globalAlpha = 1;
    }
  }, [imageData, showMask, zoomLevel, panOffset]);

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
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;

    const ctx = maskCanvas.getContext("2d");
    if (!ctx) return;

    // Draw or erase based on tool mode
    if (toolMode === "draw") {
      // Draw black circle on mask (black = masked)
      ctx.fillStyle = "black";
    } else {
      // Erase (white = unmasked)
      ctx.fillStyle = "white";
    }

    ctx.beginPath();
    ctx.arc(x, y, brushSize / scaleRef.current, 0, Math.PI * 2);
    ctx.fill();

    drawCanvas();

    // Notify parent of mask change
    const maskData = ctx.getImageData(0, 0, maskCanvas.width, maskCanvas.height).data;
    onMaskChange(maskData);
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
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;

    const ctx = maskCanvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);
    drawCanvas();

    const maskData = ctx.getImageData(0, 0, maskCanvas.width, maskCanvas.height).data;
    onMaskChange(maskData);
  };

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
      <div className="p-3 border-b border-gray-800">
        <span className="text-sm text-gray-400">Masking Tool</span>
        <p className="text-xs text-gray-500 mt-1">
          Draw to mask areas • Shift+Drag to pan when zoomed • Middle-click to pan
        </p>
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

        {/* Action Buttons */}
        <div className="flex gap-2">
          <button
            onClick={() => setShowMask(!showMask)}
            className="flex-1 px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-gray-300 transition-colors flex items-center justify-center gap-2"
          >
            {showMask ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            {showMask ? "Hide" : "Show"}
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

