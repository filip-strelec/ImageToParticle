"use client";

import { Settings, RotateCcw, Palette, Zap, MousePointer, Sparkles, Layers, Download, Upload } from "lucide-react";
import { ParticleConfig, ImageData, ShootingDirection, MouseInteractionMode, ColorFilter, ParticleShape, IdleAnimationMode, VelocityColorMode } from "@/types";
import { useMemo, useRef } from "react";

// Built-in presets
const PRESETS: Record<string, Partial<ParticleConfig>> = {
  default: {},
  "high-quality": {
    resolution: 2,
    maxParticles: 100000,
    particleShape: "circle",
  },
  "performance": {
    resolution: 6,
    maxParticles: 20000,
    particleShape: "square",
    autoPerformance: true,
  },
  "dreamy": {
    enableTrails: true,
    trailLength: 0.15,
    trailBackgroundColor: "#ffffff",
    friction: 0.92,
    returnSpeed: 0.02,
    enableIdleAnimation: true,
    idleAnimationMode: "float",
    idleAnimationSpeed: 0.5,
    idleAnimationIntensity: 8,
  },
  "connected": {
    enableConnections: true,
    connectionDistance: 60,
    connectionOpacity: 0.4,
    connectionColor: "#6366f1",
    resolution: 5,
  },
  "explosive": {
    enableInitialAnimation: true,
    shootingDirection: "all-directions",
    particleSpeed: 3,
    friction: 0.85,
    enableBounce: true,
    bounceIntensity: 2,
  },
  "gentle-float": {
    enableIdleAnimation: true,
    idleAnimationMode: "float",
    idleAnimationSpeed: 0.3,
    idleAnimationIntensity: 5,
    friction: 0.95,
    returnSpeed: 0.01,
    enableMouseInteraction: false,
  },
  "turbulence-field": {
    enableIdleAnimation: true,
    idleAnimationMode: "turbulence",
    idleAnimationSpeed: 0.8,
    idleAnimationIntensity: 10,
    friction: 0.9,
    returnSpeed: 0.03,
  },
  "velocity-glow": {
    enableVelocityColor: true,
    velocityColorMode: "brighten",
    velocityColorIntensity: 1.5,
    friction: 0.88,
    mouseForce: 20,
  },
  "hue-shift": {
    enableVelocityColor: true,
    velocityColorMode: "hue-shift",
    velocityColorIntensity: 1.2,
    friction: 0.9,
    mouseForce: 15,
  },
  "stars": {
    particleShape: "star",
    resolution: 8,
    enableIdleAnimation: true,
    idleAnimationMode: "wave",
    idleAnimationSpeed: 0.4,
    idleAnimationIntensity: 3,
  },
};

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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const estimatedParticles = useMemo(() => {
    const gap = config.resolution;
    const count = Math.ceil(imageData.width / gap) * Math.ceil(imageData.height / gap);
    return Math.min(count, config.maxParticles);
  }, [config.resolution, config.maxParticles, imageData.width, imageData.height]);

  // Apply a preset
  const applyPreset = (presetName: string) => {
    if (presetName === "default") {
      onReset();
    } else {
      const preset = PRESETS[presetName];
      if (preset) {
        onChange(preset);
      }
    }
  };

  // Export current config as JSON
  const exportConfig = () => {
    const json = JSON.stringify(config, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "particle-config.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  // Import config from JSON file
  const importConfig = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string);
        onChange(imported);
      } catch {
        alert("Invalid config file");
      }
    };
    reader.readAsText(file);
    e.target.value = ""; // Reset input
  };

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
        {/* Presets Section */}
        <section>
          <h3 className="text-sm font-medium text-indigo-400 mb-3 flex items-center gap-2">
            <Sparkles className="w-4 h-4" /> Presets
          </h3>
          <div className="space-y-3">
            <select
              onChange={(e) => applyPreset(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200"
              defaultValue=""
            >
              <option value="" disabled>Apply a preset...</option>
              <option value="default">Default</option>
              <option value="high-quality">High Quality</option>
              <option value="performance">Performance</option>
              <option value="dreamy">Dreamy (trails + float)</option>
              <option value="connected">Connected Particles</option>
              <option value="explosive">Explosive Entry</option>
              <option value="gentle-float">Gentle Float</option>
              <option value="velocity-glow">Velocity Glow</option>
              <option value="stars">Star Particles</option>
            </select>

            <div className="flex gap-2">
              <button
                onClick={exportConfig}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-sm text-gray-300 transition-colors"
              >
                <Download className="w-4 h-4" /> Export
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-sm text-gray-300 transition-colors"
              >
                <Upload className="w-4 h-4" /> Import
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={importConfig}
                className="hidden"
              />
            </div>
          </div>
        </section>

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
              step={1}
              onChange={(v) => onChange({ resolution: v })}
              suffix="px"
            />
            <Slider
              label="Particle Size"
              value={config.particleSize}
              min={0.2}
              max={10}
              step={0.2}
              onChange={(v) => onChange({ particleSize: v })}
              suffix="px"
            />
            <Slider
              label="Min Particle Size"
              value={config.minParticleSize}
              min={0.2}
              max={5}
              step={0.2}
              onChange={(v) => onChange({ minParticleSize: v })}
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

            <div className="space-y-3 pt-2 border-t border-gray-800">
              <label className="text-sm text-gray-400">Particle Shape</label>
              <select
                value={config.particleShape}
                onChange={(e) => {
                  const shape = e.target.value as ParticleShape;
                  // Sync renderMode for code generator compatibility
                  const renderMode = shape === "square" ? "squares" : "circles";
                  onChange({ particleShape: shape, renderMode });
                }}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="square">Square (Fastest)</option>
                <option value="circle">Circle (Fast)</option>
                <option value="diamond">Diamond (Medium)</option>
                <option value="triangle">Triangle (Medium)</option>
                <option value="star">Star (Slow)</option>
                <option value="heart">Heart (Slow)</option>
              </select>
              <p className="text-xs text-gray-500 mb-2">
                {config.particleShape === "square" && "Best performance. Simple filled rectangles."}
                {config.particleShape === "circle" && "Good performance. Uses arc drawing."}
                {config.particleShape === "diamond" && "Moderate performance. Path-based shape."}
                {config.particleShape === "triangle" && "Moderate performance. Path-based shape."}
                {config.particleShape === "star" && "Lower performance. Complex multi-point path."}
                {config.particleShape === "heart" && "Lower performance. Bezier curve paths."}
              </p>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.autoPerformance}
                  onChange={(e) => onChange({ autoPerformance: e.target.checked })}
                  className="w-4 h-4 rounded bg-gray-700 border-gray-600 accent-indigo-500"
                />
                <span className="text-sm text-gray-300">Auto Performance Mode</span>
              </label>
              <p className="text-xs text-gray-500">
                Automatically switch to squares when low FPS is detected.
              </p>
            </div>
          </div>
        </section>

        {/* Physics Section */}
        <section>
          <h3 className="text-sm font-medium text-indigo-400 mb-3 flex items-center gap-2">
            <MousePointer className="w-4 h-4" /> Physics & Interaction
          </h3>
          <div className="space-y-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={config.enableMouseInteraction}
                onChange={(e) => onChange({ enableMouseInteraction: e.target.checked })}
                className="w-4 h-4 rounded bg-gray-700 border-gray-600 accent-indigo-500"
              />
              <span className="text-sm text-gray-300">Enable mouse interaction</span>
            </label>

            {config.enableMouseInteraction && (
              <div className="space-y-2">
                <label className="text-sm text-gray-400">Mouse Interaction Mode</label>
                <select
                  value={config.mouseInteractionMode}
                  onChange={(e) => onChange({ mouseInteractionMode: e.target.value as MouseInteractionMode })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="push">Push Away</option>
                  <option value="pull">Pull Toward</option>
                  <option value="orbit">Orbital Motion</option>
                  <option value="turbulence">Turbulence</option>
                </select>
              </div>
            )}

            <Slider
              label="Friction"
              value={config.friction}
              min={0.2}
              max={0.98}
              step={0.01}
              onChange={(v) => onChange({ friction: v })}
            />
            <Slider
              label="Return Speed"
              value={config.returnSpeed}
              min={0.001}
              max={0.3}
              step={0.001}
              onChange={(v) => onChange({ returnSpeed: v })}
            />
            {config.enableMouseInteraction && (
              <>
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

                {config.mouseInteractionMode === "orbit" && (
                  <Slider
                    label="Orbit Speed"
                    value={config.orbitSpeed}
                    min={0.5}
                    max={3}
                    step={0.1}
                    onChange={(v) => onChange({ orbitSpeed: v })}
                    suffix="x"
                  />
                )}

                {config.mouseInteractionMode === "turbulence" && (
                  <Slider
                    label="Turbulence Intensity"
                    value={config.turbulenceIntensity}
                    min={0.5}
                    max={3}
                    step={0.1}
                    onChange={(v) => onChange({ turbulenceIntensity: v })}
                    suffix="x"
                  />
                )}
              </>
            )}
          </div>
        </section>

        {/* Masking Section */}
        <section>
          <h3 className="text-sm font-medium text-indigo-400 mb-3 flex items-center gap-2">
            <Layers className="w-4 h-4" /> Interaction Mask
          </h3>
          <div className="space-y-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={config.maskedParticlesOnTop}
                onChange={(e) => onChange({ maskedParticlesOnTop: e.target.checked })}
                className="w-4 h-4 rounded bg-gray-700 border-gray-600 accent-indigo-500"
              />
              <span className="text-sm text-gray-300">Masked particles on top</span>
            </label>
            <p className="text-xs text-gray-500">
              When enabled, masked particles render above non-masked ones. When disabled, they render below.
            </p>
          </div>
        </section>

        {/* Animation Section */}
        <section>
          <h3 className="text-sm font-medium text-indigo-400 mb-3 flex items-center gap-2">
            <Sparkles className="w-4 h-4" /> Initial Animation
          </h3>
          <div className="space-y-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={config.enableInitialAnimation}
                onChange={(e) => onChange({ enableInitialAnimation: e.target.checked })}
                className="w-4 h-4 rounded bg-gray-700 border-gray-600 accent-indigo-500"
              />
              <span className="text-sm text-gray-300">Enable sequential shooting animation</span>
            </label>

            {config.enableInitialAnimation && (
              <>
                <div className="space-y-2">
                  <label className="text-sm text-gray-400">Shooting Direction</label>
                  <select
                    value={config.shootingDirection}
                    onChange={(e) => onChange({ shootingDirection: e.target.value as ShootingDirection })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="top-to-bottom">Top to Bottom</option>
                    <option value="all-directions">All Directions (Center Out)</option>
                  </select>
                </div>

                <Slider
                  label="Particles Per Second"
                  value={config.particlesPerSecond}
                  min={100}
                  max={10000}
                  step={100}
                  onChange={(v) => onChange({ particlesPerSecond: v })}
                  suffix="/s"
                />

                <Slider
                  label="Particle Speed"
                  value={config.particleSpeed}
                  min={0.5}
                  max={3}
                  step={0.1}
                  onChange={(v) => onChange({ particleSpeed: v })}
                  suffix="x"
                />

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.enableBounce}
                    onChange={(e) => onChange({ enableBounce: e.target.checked })}
                    className="w-4 h-4 rounded bg-gray-700 border-gray-600 accent-indigo-500"
                  />
                  <span className="text-sm text-gray-300">Add bounce effect</span>
                </label>

                {config.enableBounce && (
                  <>
                    <Slider
                      label="Bounce Intensity"
                      value={config.bounceIntensity}
                      min={0.5}
                      max={2}
                      step={0.1}
                      onChange={(v) => onChange({ bounceIntensity: v })}
                    />

                    <Slider
                      label="Bounce Damping"
                      value={config.bounceDamping}
                      min={0.7}
                      max={0.95}
                      step={0.01}
                      onChange={(v) => onChange({ bounceDamping: v })}
                    />
                  </>
                )}

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.mouseInteractionDuringAnimation}
                    onChange={(e) => onChange({ mouseInteractionDuringAnimation: e.target.checked })}
                    className="w-4 h-4 rounded bg-gray-700 border-gray-600 accent-indigo-500"
                  />
                  <span className="text-sm text-gray-300">Mouse interaction during animation</span>
                </label>
              </>
            )}
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

            {/* Color Filter Dropdown */}
            <div className="space-y-2">
              <span className="text-sm text-gray-400">Color Filter</span>
              <select
                value={config.colorFilter}
                onChange={(e) => onChange({ colorFilter: e.target.value as ColorFilter })}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200"
              >
                <option value="none">None</option>
                <option value="grayscale">Grayscale</option>
                <option value="sepia">Sepia</option>
                <option value="inverted">Inverted</option>
                <option value="saturated">Saturated</option>
                <option value="desaturated">Desaturated</option>
                <option value="warm">Warm</option>
                <option value="cool">Cool</option>
                <option value="vintage">Vintage</option>
              </select>
            </div>
          </div>
        </section>

        {/* Effects Section */}
        <section>
          <h3 className="text-sm font-medium text-indigo-400 mb-3 flex items-center gap-2">
            <Sparkles className="w-4 h-4" /> Effects
          </h3>
          <div className="space-y-4">
            {/* Particle Trails */}
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={config.enableTrails}
                onChange={(e) => onChange({ enableTrails: e.target.checked })}
                className="w-4 h-4 rounded bg-gray-700 border-gray-600 accent-indigo-500"
              />
              <span className="text-sm text-gray-300">Particle trails</span>
            </label>
            {config.enableTrails && (
              <>
                <Slider
                  label="Trail Length"
                  value={config.trailLength}
                  min={0.05}
                  max={0.5}
                  step={0.01}
                  onChange={(v) => onChange({ trailLength: v })}
                />
                <div className="space-y-2">
                  <span className="text-sm text-gray-400">Trail Background</span>
                  <input
                    type="color"
                    value={config.trailBackgroundColor}
                    onChange={(e) => onChange({ trailBackgroundColor: e.target.value })}
                    className="w-full h-8 rounded bg-gray-800 border border-gray-700 cursor-pointer"
                  />
                </div>
              </>
            )}

            {/* Particle Connections */}
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={config.enableConnections}
                onChange={(e) => onChange({ enableConnections: e.target.checked })}
                className="w-4 h-4 rounded bg-gray-700 border-gray-600 accent-indigo-500"
              />
              <span className="text-sm text-gray-300">Particle connections</span>
            </label>
            {config.enableConnections && (
              <>
                <Slider
                  label="Connection Distance"
                  value={config.connectionDistance}
                  min={10}
                  max={150}
                  step={5}
                  onChange={(v) => onChange({ connectionDistance: v })}
                  suffix="px"
                />
                <Slider
                  label="Connection Opacity"
                  value={config.connectionOpacity}
                  min={0.1}
                  max={1}
                  step={0.05}
                  onChange={(v) => onChange({ connectionOpacity: v })}
                />
                <div className="space-y-2">
                  <span className="text-sm text-gray-400">Connection Color</span>
                  <input
                    type="color"
                    value={config.connectionColor}
                    onChange={(e) => onChange({ connectionColor: e.target.value })}
                    className="w-full h-8 rounded bg-gray-800 border border-gray-700 cursor-pointer"
                  />
                </div>
              </>
            )}

            {/* Idle Animation */}
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={config.enableIdleAnimation}
                onChange={(e) => onChange({ enableIdleAnimation: e.target.checked })}
                className="w-4 h-4 rounded bg-gray-700 border-gray-600 accent-indigo-500"
              />
              <span className="text-sm text-gray-300">Idle animation</span>
            </label>
            {config.enableIdleAnimation && (
              <>
                <div className="space-y-2">
                  <span className="text-sm text-gray-400">Animation Mode</span>
                  <select
                    value={config.idleAnimationMode}
                    onChange={(e) => onChange({ idleAnimationMode: e.target.value as IdleAnimationMode })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200"
                  >
                    <option value="float">Float (Perlin noise)</option>
                    <option value="turbulence">Turbulence (Wave field)</option>
                    <option value="wave">Wave (Sine motion)</option>
                    <option value="pulse">Pulse (Breathing)</option>
                  </select>
                  <p className="text-xs text-gray-500">
                    {config.idleAnimationMode === "float" && "Particles float gently in random directions."}
                    {config.idleAnimationMode === "turbulence" && "Particles follow turbulent currents across the canvas. Stops near mouse."}
                    {config.idleAnimationMode === "wave" && "Particles move in a wave pattern."}
                    {config.idleAnimationMode === "pulse" && "Particles pulse in and out from center."}
                  </p>
                </div>
                <Slider
                  label="Idle Speed"
                  value={config.idleAnimationSpeed}
                  min={0.1}
                  max={2}
                  step={0.1}
                  onChange={(v) => onChange({ idleAnimationSpeed: v })}
                  suffix="x"
                />
                <Slider
                  label="Idle Intensity"
                  value={config.idleAnimationIntensity}
                  min={1}
                  max={20}
                  step={1}
                  onChange={(v) => onChange({ idleAnimationIntensity: v })}
                  suffix="px"
                />
                {config.idleAnimationMode === "turbulence" && (
                  <Slider
                    label="Turbulence Mouse Radius"
                    value={config.turbulenceMouseRadius}
                    min={50}
                    max={3000}
                    step={50}
                    onChange={(v) => onChange({ turbulenceMouseRadius: v })}
                    suffix="px"
                  />
                )}
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.idleAnimationAffectsMasked}
                    onChange={(e) => onChange({ idleAnimationAffectsMasked: e.target.checked })}
                    className="w-4 h-4 rounded bg-gray-700 border-gray-600 accent-indigo-500"
                  />
                  <span className="text-sm text-gray-300">Affect masked particles</span>
                </label>
              </>
            )}

            {/* Velocity Color */}
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={config.enableVelocityColor}
                onChange={(e) => onChange({ enableVelocityColor: e.target.checked })}
                className="w-4 h-4 rounded bg-gray-700 border-gray-600 accent-indigo-500"
              />
              <span className="text-sm text-gray-300">Velocity color shift</span>
            </label>
            {config.enableVelocityColor && (
              <>
                <div className="space-y-2">
                  <span className="text-sm text-gray-400">Color Mode</span>
                  <select
                    value={config.velocityColorMode}
                    onChange={(e) => onChange({ velocityColorMode: e.target.value as VelocityColorMode })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200"
                  >
                    <option value="brighten">Brighten</option>
                    <option value="darken">Darken</option>
                    <option value="hue-shift">Hue Shift</option>
                    <option value="hue-shift-colorize">Hue Shift Colorize (works on black)</option>
                    <option value="saturation">Saturation Boost</option>
                    <option value="rainbow">Rainbow (works on black)</option>
                  </select>
                </div>
                <Slider
                  label="Color Shift Intensity"
                  value={config.velocityColorIntensity}
                  min={0.1}
                  max={5}
                  step={0.1}
                  onChange={(v) => onChange({ velocityColorIntensity: v })}
                  suffix="x"
                />
                {config.velocityColorMode === "brighten" && (
                  <div className="space-y-2">
                    <label className="text-sm text-gray-400">Target Color</label>
                    <input
                      type="color"
                      value={config.velocityColorTarget || "#ffffff"}
                      onChange={(e) => onChange({ velocityColorTarget: e.target.value })}
                      className="w-full h-10 bg-gray-800 border border-gray-700 rounded-lg cursor-pointer"
                    />
                    <p className="text-xs text-gray-500">
                      Color to shift towards when particles move faster.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

