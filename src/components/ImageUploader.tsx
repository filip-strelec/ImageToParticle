"use client";

import { useCallback, useRef, useState, useEffect } from "react";
import { Upload, Image as ImageIcon, X, ZoomIn } from "lucide-react";
import { ImageData } from "@/types";

interface ImageUploaderProps {
  onImageLoad: (data: ImageData) => void;
  canvasScale: number;
  onCanvasScaleChange: (scale: number) => void;
}

export default function ImageUploader({ onImageLoad, canvasScale, onCanvasScaleChange }: ImageUploaderProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [isDragging, setIsDragging] = useState(false);
  const [originalDimensions, setOriginalDimensions] = useState<{ width: number; height: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isSvgRef = useRef(false);

  const processImageWithScale = useCallback((dataUrl: string, name: string, scale: number) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");

      // For SVGs, we render at the target resolution to preserve quality
      // For raster images, we scale from the original
      const isSvg = name.toLowerCase().endsWith('.svg') || dataUrl.startsWith('data:image/svg');
      isSvgRef.current = isSvg;

      let baseWidth = img.width;
      let baseHeight = img.height;

      // Apply MAX_DIMENSION limit to base dimensions (before user scaling)
      const MAX_DIMENSION = 800;
      if (baseWidth > MAX_DIMENSION || baseHeight > MAX_DIMENSION) {
        const limitScale = MAX_DIMENSION / Math.max(baseWidth, baseHeight);
        baseWidth = Math.floor(baseWidth * limitScale);
        baseHeight = Math.floor(baseHeight * limitScale);
      }

      // Store original dimensions (after MAX_DIMENSION limiting but before user scale)
      const origWidth = baseWidth;
      const origHeight = baseHeight;

      // Apply user scale
      const width = Math.floor(baseWidth * scale);
      const height = Math.floor(baseHeight * scale);

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // For SVGs, enable image smoothing for crisp rendering at any scale
      if (isSvg) {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
      }

      ctx.drawImage(img, 0, 0, width, height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      onImageLoad({
        width: canvas.width,
        height: canvas.height,
        pixels: imageData.data,
        dataUrl,
        fileName: name,
        originalWidth: origWidth,
        originalHeight: origHeight,
        canvasScale: scale,
      });
    };
    img.src = dataUrl;
  }, [onImageLoad]);

  // Re-process image when scale changes
  useEffect(() => {
    if (preview && fileName) {
      processImageWithScale(preview, fileName, canvasScale);
    }
  }, [canvasScale, preview, fileName, processImageWithScale]);

  const processImage = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setPreview(dataUrl);
      setFileName(file.name);

      // Get original dimensions first
      const img = new Image();
      img.onload = () => {
        const MAX_DIMENSION = 800;
        let w = img.width;
        let h = img.height;
        if (w > MAX_DIMENSION || h > MAX_DIMENSION) {
          const s = MAX_DIMENSION / Math.max(w, h);
          w = Math.floor(w * s);
          h = Math.floor(h * s);
        }
        setOriginalDimensions({ width: w, height: h });
      };
      img.src = dataUrl;

      // Process with current scale
      processImageWithScale(dataUrl, file.name, canvasScale);
    };
    reader.readAsDataURL(file);
  }, [canvasScale, processImageWithScale]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith("image/")) {
      processImage(file);
    }
  }, [processImage]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      processImage(file);
    }
  }, [processImage]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const clearImage = useCallback(() => {
    setPreview(null);
    setFileName("");
    setOriginalDimensions(null);
    onCanvasScaleChange(1); // Reset scale when clearing
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [onCanvasScaleChange]);

  return (
    <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
      <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
        <ImageIcon className="w-5 h-5 text-indigo-400" />
        Image Source
      </h2>

      {preview ? (
        <div className="space-y-3">
          <div className="relative">
            <img
              src={preview}
              alt="Preview"
              className="w-full h-40 object-contain bg-gray-800 rounded-lg"
            />
            <button
              onClick={clearImage}
              className="absolute top-2 right-2 p-1 bg-red-500 rounded-full hover:bg-red-600 transition-colors"
            >
              <X className="w-4 h-4 text-white" />
            </button>
          </div>
          <p className="text-sm text-gray-400 truncate">{fileName}</p>

          {/* Canvas Scale Slider */}
          <div className="space-y-2 pt-2 border-t border-gray-800">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400 flex items-center gap-1.5">
                <ZoomIn className="w-4 h-4" />
                Canvas Scale
              </span>
              <span className="text-sm text-white font-mono">{canvasScale.toFixed(1)}x</span>
            </div>
            <input
              type="range"
              min={0.5}
              max={10}
              step={0.1}
              value={canvasScale}
              onChange={(e) => onCanvasScaleChange(parseFloat(e.target.value))}
              className="w-full"
            />
            {originalDimensions && (
              <p className="text-xs text-gray-500">
                {Math.floor(originalDimensions.width * canvasScale)} × {Math.floor(originalDimensions.height * canvasScale)}px
                {isSvgRef.current && <span className="text-indigo-400 ml-1">(SVG - lossless)</span>}
              </p>
            )}
          </div>
        </div>
      ) : (
        <div
          onClick={() => fileInputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            isDragging
              ? "border-indigo-500 bg-indigo-500/10"
              : "border-gray-700 hover:border-gray-600"
          }`}
        >
          <Upload className="w-10 h-10 text-gray-500 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">
            Drop an image here or click to upload
          </p>
          <p className="text-gray-500 text-xs mt-1">PNG, JPG, GIF, WebP, SVG</p>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
}

