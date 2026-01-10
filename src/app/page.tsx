"use client";

import { useState, useCallback, useMemo } from "react";
import ImageUploader from "@/components/ImageUploader";
import ParticlePreview from "@/components/ParticlePreview";
import ControlPanel from "@/components/ControlPanel";
import CodeExporter from "@/components/CodeExporter";
import MaskingTool from "@/components/MaskingTool";
import MaskManager from "@/components/MaskManager";
import ParticleEditor from "@/components/ParticleEditor";
import { ParticleConfig, ImageData, OptionalMask, ParticleEdit } from "@/types";
import { extractParticleData } from "@/utils/particleUtils";

const defaultConfig: ParticleConfig = {
  resolution: 5,
  particleSize: 2,
  minParticleSize: 1,
  sizeVariation: 1,
  friction: 0.92,
  returnSpeed: 0.08,
  mouseRadius: 100,
  mouseForce: 15,
  mouseInteractionMode: "push",
  orbitSpeed: 1.5,
  turbulenceIntensity: 1.5,
  useOriginalColors: true,
  customColors: ["#6366f1", "#8b5cf6", "#a855f7", "#d946ef"],
  alphaThreshold: 128,
  colorClustering: false,
  clusterCount: 8,
  maxParticles: 10000,
  enableInitialAnimation: false,
  particlesPerSecond: 2000,
  shootingDirection: "top-to-bottom",
  particleSpeed: 1,
  enableBounce: false,
  bounceIntensity: 1,
  bounceDamping: 0.85,
  mouseInteractionDuringAnimation: false,
};

export default function Home() {
  const [imageData, setImageData] = useState<ImageData | null>(null);
  const [config, setConfig] = useState<ParticleConfig>(defaultConfig);
  const [activeTab, setActiveTab] = useState<"preview" | "mask" | "particles" | "code">("preview");
  const [maskData, setMaskData] = useState<Uint8ClampedArray | undefined>(undefined);
  const [canvasScale, setCanvasScale] = useState(1);

  // Optional masks state
  const [optionalMasks, setOptionalMasks] = useState<OptionalMask[]>([]);
  const [activeMaskId, setActiveMaskId] = useState<string | null>(null);
  const [isEditingOptionalMask, setIsEditingOptionalMask] = useState(false);

  // Particle edits state
  const [particleEdits, setParticleEdits] = useState<ParticleEdit[]>([]);
  const [selectedMaskSlugs, setSelectedMaskSlugs] = useState<string[]>([]);

  // Extract particles with all data for ParticleEditor
  const particles = useMemo(() => {
    if (!imageData) return [];
    return extractParticleData(imageData, config, maskData, optionalMasks, particleEdits);
  }, [imageData, config, maskData, optionalMasks, particleEdits]);

  const handleImageLoad = useCallback((data: ImageData) => {
    setImageData(data);
    setMaskData(undefined);
    setOptionalMasks([]);
    setActiveMaskId(null);
    setParticleEdits([]);
  }, []);

  const handleConfigChange = useCallback((newConfig: Partial<ParticleConfig>) => {
    setConfig(prev => ({ ...prev, ...newConfig }));
  }, []);

  const handleReset = useCallback(() => {
    setConfig(defaultConfig);
  }, []);

  const handleMaskChange = useCallback((newMaskData: Uint8ClampedArray) => {
    setMaskData(newMaskData);
  }, []);

  const handleCanvasScaleChange = useCallback((scale: number) => {
    setCanvasScale(scale);
    setMaskData(undefined);
    setOptionalMasks([]);
    setParticleEdits([]);
  }, []);

  const handleOptionalMaskChange = useCallback((maskId: string, data: Uint8ClampedArray) => {
    setOptionalMasks(prev => prev.map(m =>
      m.id === maskId ? { ...m, data } : m
    ));
  }, []);

  return (
    <main className="min-h-screen bg-[#0a0a0a]">
      {/* Header */}
      <header className="border-b border-gray-800 bg-[#111]">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-white">
            🎨 Particle Animation Generator
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Upload an image → Configure animation → Export React code
          </p>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid lg:grid-cols-[350px_1fr] gap-6">
          {/* Left Sidebar - Controls */}
          <div className="space-y-6">
            <ImageUploader
              onImageLoad={handleImageLoad}
              canvasScale={canvasScale}
              onCanvasScaleChange={handleCanvasScaleChange}
            />
            
            {imageData && (
              <ControlPanel
                config={config}
                onChange={handleConfigChange}
                onReset={handleReset}
                imageData={imageData}
              />
            )}
          </div>

          {/* Main Content Area */}
          <div className="space-y-4">
            {/* Tab Navigation */}
            {imageData && (
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => setActiveTab("preview")}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    activeTab === "preview"
                      ? "bg-indigo-600 text-white"
                      : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                  }`}
                >
                  👁️ Preview
                </button>
                <button
                  onClick={() => setActiveTab("mask")}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    activeTab === "mask"
                      ? "bg-indigo-600 text-white"
                      : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                  }`}
                >
                  🎭 Masking
                </button>
                <button
                  onClick={() => setActiveTab("particles")}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    activeTab === "particles"
                      ? "bg-indigo-600 text-white"
                      : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                  }`}
                >
                  ✨ Particles
                </button>
                <button
                  onClick={() => setActiveTab("code")}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    activeTab === "code"
                      ? "bg-indigo-600 text-white"
                      : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                  }`}
                >
                  📋 Export Code
                </button>
              </div>
            )}

            {/* Content */}
            {activeTab === "preview" ? (
              <ParticlePreview
                imageData={imageData}
                config={config}
                maskData={maskData}
                optionalMasks={optionalMasks}
                particleEdits={particleEdits}
              />
            ) : activeTab === "mask" && imageData ? (
              <div className="space-y-4">
                {/* Mask Type Toggle */}
                <div className="flex gap-2">
                  <button
                    onClick={() => setIsEditingOptionalMask(false)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      !isEditingOptionalMask
                        ? "bg-indigo-600 text-white"
                        : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                    }`}
                  >
                    Interaction Mask
                  </button>
                  <button
                    onClick={() => setIsEditingOptionalMask(true)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      isEditingOptionalMask
                        ? "bg-indigo-600 text-white"
                        : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                    }`}
                  >
                    Optional Masks ({optionalMasks.length})
                  </button>
                </div>

                {/* Optional Mask Manager */}
                {isEditingOptionalMask && (
                  <MaskManager
                    masks={optionalMasks}
                    activeMaskId={activeMaskId}
                    onMasksChange={setOptionalMasks}
                    onActiveMaskChange={setActiveMaskId}
                  />
                )}

                {/* Masking Tool */}
                <MaskingTool
                  imageData={imageData}
                  onMaskChange={handleMaskChange}
                  initialMaskData={maskData}
                  optionalMasks={optionalMasks}
                  activeMaskId={activeMaskId}
                  onOptionalMaskChange={handleOptionalMaskChange}
                  isEditingOptionalMask={isEditingOptionalMask}
                />
              </div>
            ) : activeTab === "particles" && imageData ? (
              <ParticleEditor
                imageData={imageData}
                particles={particles}
                edits={particleEdits}
                onEditsChange={setParticleEdits}
                optionalMasks={optionalMasks}
                selectedMaskSlugs={selectedMaskSlugs}
                onSelectedMaskSlugsChange={setSelectedMaskSlugs}
              />
            ) : (
              <CodeExporter
                imageData={imageData}
                config={config}
                maskData={maskData}
                optionalMasks={optionalMasks}
                particleEdits={particleEdits}
              />
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

