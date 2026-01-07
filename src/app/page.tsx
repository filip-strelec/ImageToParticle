"use client";

import { useState, useCallback } from "react";
import ImageUploader from "@/components/ImageUploader";
import ParticlePreview from "@/components/ParticlePreview";
import ControlPanel from "@/components/ControlPanel";
import CodeExporter from "@/components/CodeExporter";
import { ParticleConfig, ImageData } from "@/types";

const defaultConfig: ParticleConfig = {
  resolution: 5,
  particleSize: 2,
  sizeVariation: 1,
  friction: 0.92,
  returnSpeed: 0.08,
  mouseRadius: 100,
  mouseForce: 15,
  useOriginalColors: true,
  customColors: ["#6366f1", "#8b5cf6", "#a855f7", "#d946ef"],
  alphaThreshold: 128,
  colorClustering: false,
  clusterCount: 8,
  maxParticles: 10000,
};

export default function Home() {
  const [imageData, setImageData] = useState<ImageData | null>(null);
  const [config, setConfig] = useState<ParticleConfig>(defaultConfig);
  const [activeTab, setActiveTab] = useState<"preview" | "code">("preview");

  const handleImageLoad = useCallback((data: ImageData) => {
    setImageData(data);
  }, []);

  const handleConfigChange = useCallback((newConfig: Partial<ParticleConfig>) => {
    setConfig(prev => ({ ...prev, ...newConfig }));
  }, []);

  const handleReset = useCallback(() => {
    setConfig(defaultConfig);
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
            <ImageUploader onImageLoad={handleImageLoad} />
            
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
              <div className="flex gap-2">
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
              <ParticlePreview imageData={imageData} config={config} />
            ) : (
              <CodeExporter imageData={imageData} config={config} />
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

