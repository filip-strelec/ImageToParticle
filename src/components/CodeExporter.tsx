"use client";

import { useState, useMemo } from "react";
import { Copy, Check, Code, FileCode } from "lucide-react";
import { ImageData, ParticleConfig, OptionalMask, ParticleEdit } from "@/types";
import { extractParticleData } from "@/utils/particleUtils";
import { generateComponentCode, generateParticleDataCode } from "@/utils/codeGenerator";

export interface CodeExporterProps {
  imageData: ImageData | null;
  config: ParticleConfig;
  maskData?: Uint8ClampedArray;
  optionalMasks?: OptionalMask[];
  particleEdits?: ParticleEdit[];
}

export default function CodeExporter({
  imageData,
  config,
  maskData,
  optionalMasks,
  particleEdits,
}: CodeExporterProps) {
  const [copied, setCopied] = useState<string | null>(null);
  const [exportMode, setExportMode] = useState<"inline" | "separate">("inline");

  const particleData = useMemo(() => {
    if (!imageData) return [];
    return extractParticleData(imageData, config, maskData, optionalMasks, particleEdits);
  }, [imageData, config, maskData, optionalMasks, particleEdits]);

  const componentCode = useMemo(() => {
    if (!imageData) return "";
    return generateComponentCode(particleData, config, imageData, exportMode);
  }, [particleData, config, imageData, exportMode]);

  const dataCode = useMemo(() => {
    if (exportMode !== "separate" || !imageData) return "";
    return generateParticleDataCode(particleData);
  }, [particleData, exportMode, imageData]);

  const copyToClipboard = async (code: string, id: string) => {
    await navigator.clipboard.writeText(code);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  if (!imageData) {
    return (
      <div className="bg-gray-900 rounded-xl border border-gray-800 h-[500px] flex items-center justify-center">
        <div className="text-center text-gray-500">
          <div className="text-6xl mb-4">📋</div>
          <p>Upload an image to generate code</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Export Mode Toggle */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
        <h3 className="text-sm font-medium text-gray-300 mb-3">Export Mode</h3>
        <div className="flex gap-2">
          <button
            onClick={() => setExportMode("inline")}
            className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
              exportMode === "inline"
                ? "bg-indigo-600 text-white"
                : "bg-gray-800 text-gray-300 hover:bg-gray-700"
            }`}
          >
            <FileCode className="w-4 h-4" />
            Single File (Inline Data)
          </button>
          <button
            onClick={() => setExportMode("separate")}
            className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
              exportMode === "separate"
                ? "bg-indigo-600 text-white"
                : "bg-gray-800 text-gray-300 hover:bg-gray-700"
            }`}
          >
            <Code className="w-4 h-4" />
            Separate Files
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          {exportMode === "inline"
            ? "All particle data embedded in component (~" + (componentCode.length / 1024).toFixed(1) + "KB)"
            : "Component + separate data file for cleaner code"}
        </p>
      </div>

      {/* Main Component Code */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <div className="flex items-center justify-between p-3 border-b border-gray-800">
          <span className="text-sm text-gray-300 font-medium">
            {exportMode === "inline" ? "ParticleAnimation.tsx" : "ParticleAnimation.tsx"}
          </span>
          <button
            onClick={() => copyToClipboard(componentCode, "component")}
            className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-sm text-white transition-colors"
          >
            {copied === "component" ? (
              <>
                <Check className="w-4 h-4" /> Copied!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" /> Copy
              </>
            )}
          </button>
        </div>
        <pre className="p-4 text-sm text-gray-300 overflow-auto max-h-[400px] font-mono">
          <code>{componentCode}</code>
        </pre>
      </div>

      {/* Separate Data File (if applicable) */}
      {exportMode === "separate" && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          <div className="flex items-center justify-between p-3 border-b border-gray-800">
            <span className="text-sm text-gray-300 font-medium">particleData.ts</span>
            <button
              onClick={() => copyToClipboard(dataCode, "data")}
              className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-sm text-white transition-colors"
            >
              {copied === "data" ? (
                <>
                  <Check className="w-4 h-4" /> Copied!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" /> Copy
                </>
              )}
            </button>
          </div>
          <pre className="p-4 text-sm text-gray-300 overflow-auto max-h-[300px] font-mono">
            <code>{dataCode}</code>
          </pre>
        </div>
      )}

      {/* Instructions */}
      <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
        <h3 className="text-sm font-medium text-indigo-400 mb-2">📖 Usage Instructions</h3>
        <ol className="text-sm text-gray-400 space-y-1 list-decimal list-inside">
          <li>Copy the code above into your React/Next.js project</li>
          <li>Import and use: <code className="bg-gray-800 px-1 rounded">&lt;ParticleAnimation /&gt;</code></li>
          <li>Wrap in a container with defined dimensions</li>
          <li>Works with both React and Next.js (uses &quot;use client&quot;)</li>
        </ol>
      </div>
    </div>
  );
}

