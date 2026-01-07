"use client";

import { Settings, RotateCcw, Palette, Zap, MousePointer } from "lucide-react";
import { ParticleConfig, ImageData } from "@/types";
import { useMemo } from "react";

interface ControlPanelProps {
  config: ParticleConfig;
  onChange: (config: Partial<ParticleConfig>) => void;
  onReset: () => void;
  imageData: ImageData;
}

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  suffix?: string;
}

function Slider({ label, value, min, max, step = 1, onChange, suffix = "" }: SliderProps) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-gray-400">{label}</span>
        <span className="text-white font-mono">{value}{suffix}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full"
      />
    </div>
  );
}

export default function ControlPanel({ config, onChange, onReset, imageData }: ControlPanelProps) {
  const estimatedParticles = useMemo(() => {
    const gap = config.resolution;
    const count = Math.ceil(imageData.width / gap) * Math.ceil(imageData.height / gap);
    return Math.min(count, config.maxParticles);
  }, [config.resolution, config.maxParticles, imageData.width, imageData.height]);

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-800">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <Settings className="w-5 h-5 text-indigo-400" />
          Configuration
        </h2>
        <button
          onClick={onReset}
          className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          title="Reset to defaults"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 space-y-6 max-h-[60vh] overflow-y-auto">
        {/* Resolution Section */}
        <section>
          <h3 className="text-sm font-medium text-indigo-400 mb-3 flex items-center gap-2">
            <Zap className="w-4 h-4" /> Resolution & Size
          </h3>
          <div className="space-y-4">
            <Slider
              label="Resolution (gap)"
              value={config.resolution}
              min={1}
              max={20}
              onChange={(v) => onChange({ resolution: v })}
              suffix="px"
            />
            <Slider
              label="Particle Size"
              value={config.particleSize}
              min={0.5}
              max={10}
              step={0.5}
              onChange={(v) => onChange({ particleSize: v })}
              suffix="px"
            />
            <Slider
              label="Size Variation"
              value={config.sizeVariation}
              min={0}
              max={5}
              step={0.5}
              onChange={(v) => onChange({ sizeVariation: v })}
            />
            <Slider
              label="Max Particles"
              value={config.maxParticles}
              min={1000}
              max={50000}
              step={1000}
              onChange={(v) => onChange({ maxParticles: v })}
            />
            <p className="text-xs text-gray-500">
              Estimated particles: ~{estimatedParticles.toLocaleString()}
            </p>
          </div>
        </section>

        {/* Physics Section */}
        <section>
          <h3 className="text-sm font-medium text-indigo-400 mb-3 flex items-center gap-2">
            <MousePointer className="w-4 h-4" /> Physics & Interaction
          </h3>
          <div className="space-y-4">
            <Slider
              label="Friction"
              value={config.friction}
              min={0.8}
              max={0.99}
              step={0.01}
              onChange={(v) => onChange({ friction: v })}
            />
            <Slider
              label="Return Speed"
              value={config.returnSpeed}
              min={0.01}
              max={0.2}
              step={0.01}
              onChange={(v) => onChange({ returnSpeed: v })}
            />
            <Slider
              label="Mouse Radius"
              value={config.mouseRadius}
              min={20}
              max={200}
              step={10}
              onChange={(v) => onChange({ mouseRadius: v })}
              suffix="px"
            />
            <Slider
              label="Mouse Force"
              value={config.mouseForce}
              min={5}
              max={30}
              onChange={(v) => onChange({ mouseForce: v })}
            />
          </div>
        </section>

        {/* Color Section */}
        <section>
          <h3 className="text-sm font-medium text-indigo-400 mb-3 flex items-center gap-2">
            <Palette className="w-4 h-4" /> Colors
          </h3>
          <div className="space-y-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={config.useOriginalColors}
                onChange={(e) => onChange({ useOriginalColors: e.target.checked })}
                className="w-4 h-4 rounded bg-gray-700 border-gray-600 accent-indigo-500"
              />
              <span className="text-sm text-gray-300">Use original image colors</span>
            </label>

            {!config.useOriginalColors && (
              <div className="space-y-2">
                <span className="text-sm text-gray-400">Custom Colors</span>
                <div className="flex flex-wrap gap-2">
                  {config.customColors.map((color, i) => (
                    <input
                      key={i}
                      type="color"
                      value={color}
                      onChange={(e) => {
                        const newColors = [...config.customColors];
                        newColors[i] = e.target.value;
                        onChange({ customColors: newColors });
                      }}
                      className="w-8 h-8 rounded cursor-pointer border-0"
                    />
                  ))}
                  <button
                    onClick={() => onChange({ customColors: [...config.customColors, "#ffffff"] })}
                    className="w-8 h-8 rounded bg-gray-700 text-gray-400 hover:bg-gray-600 text-lg"
                  >
                    +
                  </button>
                </div>
              </div>
            )}

            <Slider
              label="Alpha Threshold"
              value={config.alphaThreshold}
              min={0}
              max={255}
              onChange={(v) => onChange({ alphaThreshold: v })}
            />

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={config.colorClustering}
                onChange={(e) => onChange({ colorClustering: e.target.checked })}
                className="w-4 h-4 rounded bg-gray-700 border-gray-600 accent-indigo-500"
              />
              <span className="text-sm text-gray-300">Color clustering (quantize)</span>
            </label>

            {config.colorClustering && (
              <Slider
                label="Color Clusters"
                value={config.clusterCount}
                min={2}
                max={32}
                onChange={(v) => onChange({ clusterCount: v })}
              />
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

