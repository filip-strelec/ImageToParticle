"use client";

import { useEffect, useRef, useCallback, useMemo, useState } from "react";
import { ImageData, ParticleConfig, Particle, OptionalMask, ParticleEdit, VelocityColorMode } from "@/types";
import { extractParticleData } from "@/utils/particleUtils";
import { RotateCcw } from "lucide-react";

// Simple Perlin-like noise for idle animation
function noise2D(x: number, y: number): number {
  const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return (n - Math.floor(n)) * 2 - 1;
}

function smoothNoise(x: number, y: number, t: number): number {
  return (
    noise2D(x + t * 0.3, y + t * 0.2) * 0.5 +
    noise2D(x * 0.5 + t * 0.5, y * 0.5) * 0.3 +
    noise2D(x * 0.25 + t * 0.7, y * 0.25 + t * 0.4) * 0.2
  );
}

// Parse color to RGB for velocity color shifting
function parseColorToRGB(color: string): [number, number, number] {
  if (color.startsWith("rgb")) {
    const match = color.match(/\d+/g);
    if (match) return [parseInt(match[0]), parseInt(match[1]), parseInt(match[2])];
  }
  if (color.startsWith("#")) {
    const hex = color.slice(1);
    return [
      parseInt(hex.slice(0, 2), 16),
      parseInt(hex.slice(2, 4), 16),
      parseInt(hex.slice(4, 6), 16),
    ];
  }
  return [255, 255, 255];
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return [h, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  let r, g, b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

function shiftColorByVelocity(color: string, velocity: number, intensity: number, mode: VelocityColorMode = "brighten", targetColor: string = "#ffffff"): string {
  const [r, g, b] = parseColorToRGB(color);
  const factor = Math.min(velocity * intensity * 10, 100);

  switch (mode) {
    case "brighten": {
      // Interpolate towards target color
      const [tr, tg, tb] = parseColorToRGB(targetColor);
      const t = Math.min(factor / 100, 1); // Normalize factor to 0-1
      const nr = Math.round(r + (tr - r) * t);
      const ng = Math.round(g + (tg - g) * t);
      const nb = Math.round(b + (tb - b) * t);
      return `rgb(${nr},${ng},${nb})`;
    }
    case "darken": {
      return `rgb(${Math.max(0, r - factor)},${Math.max(0, g - factor)},${Math.max(0, b - factor)})`;
    }
    case "hue-shift": {
      const [h, s, l] = rgbToHsl(r, g, b);
      const newH = (h + factor * 0.01) % 1;
      const [nr, ng, nb] = hslToRgb(newH, s, l);
      return `rgb(${nr},${ng},${nb})`;
    }
    case "saturation": {
      const [h, s, l] = rgbToHsl(r, g, b);
      const newS = Math.min(1, s + factor * 0.01);
      const [nr, ng, nb] = hslToRgb(h, newS, l);
      return `rgb(${nr},${ng},${nb})`;
    }
    default:
      return color;
  }
}

interface ParticlePreviewProps {
  imageData: ImageData | null;
  config: ParticleConfig;
  maskData?: Uint8ClampedArray;
  optionalMasks?: OptionalMask[];
  particleEdits?: ParticleEdit[];
}

export default function ParticlePreview({
  imageData,
  config,
  maskData,
  optionalMasks,
  particleEdits,
}: ParticlePreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const mouseRef = useRef({ x: -1000, y: -1000 });
  const animationRef = useRef<number>(0);
  const frameCountRef = useRef<number>(0);
  const lastFrameTimeRef = useRef<number>(0);
  const adaptiveSkipRef = useRef<number>(0);
  // Quality mode: starts as null (undecided), locks after measurement during activity
  const qualityModeRef = useRef<"circles" | "squares" | null>(null);
  const slowFrameCountRef = useRef<number>(0); // Count slow frames during activity
  const activityFrameCountRef = useRef<number>(0); // Count total frames during activity
  const animationStartTimeRef = useRef<number>(0);
  const particlesActivatedRef = useRef<number>(0);
  const [particleCount, setParticleCount] = useState(0);

  // FPS and metrics tracking
  const fpsHistoryRef = useRef<number[]>([]);
  const [metrics, setMetrics] = useState({
    fps: 0,
    avgFps: 0,
    frameTime: 0,
    renderMode: "circles" as "circles" | "squares",
    skipFrames: 0,
  });

  // Extract particle data from image
  const particleData = useMemo(() => {
    if (!imageData) return [];
    return extractParticleData(imageData, config, maskData, optionalMasks, particleEdits);
  }, [imageData, config, maskData, optionalMasks, particleEdits]);

  // Reset animation
  const resetAnimation = useCallback(() => {
    animationStartTimeRef.current = performance.now();
    particlesActivatedRef.current = 0;
  }, []);

  // Reset performance measurement when autoPerformance or particleShape changes
  useEffect(() => {
    qualityModeRef.current = null;
    slowFrameCountRef.current = 0;
    activityFrameCountRef.current = 0;
  }, [config.autoPerformance, config.particleShape]);

  // Initialize particles
  const initParticles = useCallback(() => {
    if (!particleData.length || !imageData) return;

    const centerX = imageData.width / 2;
    const centerY = imageData.height / 2;

    // Sort particles based on shooting direction
    let sortedParticleData = [...particleData];
    if (config.enableInitialAnimation) {
      if (config.shootingDirection === "top-to-bottom") {
        // Sort by Y position (top to bottom)
        sortedParticleData.sort((a, b) => a.y - b.y);
      } else if (config.shootingDirection === "all-directions") {
        // Sort by distance from center (closest to farthest)
        sortedParticleData.sort((a, b) => {
          const distA = Math.sqrt(Math.pow(a.x - centerX, 2) + Math.pow(a.y - centerY, 2));
          const distB = Math.sqrt(Math.pow(b.x - centerX, 2) + Math.pow(b.y - centerY, 2));
          return distA - distB;
        });
      }
    }

    // Particles start at center if animation enabled, otherwise at their final position
    particlesRef.current = sortedParticleData.map(p => {
      const startX = config.enableInitialAnimation ? centerX : p.x;
      const startY = config.enableInitialAnimation ? centerY : p.y;

      return {
        x: startX,
        y: startY,
        originX: p.x,
        originY: p.y,
        vx: 0,
        vy: 0,
        size: Math.max(config.minParticleSize, config.particleSize + Math.random() * config.sizeVariation),
        color: p.color,
        alpha: 0.7 + Math.random() * 0.3,
        masked: p.masked,
      };
    });

    // Update particle count for display
    setParticleCount(particlesRef.current.length);

    // Reset animation
    if (config.enableInitialAnimation) {
      resetAnimation();
    } else {
      // If animation disabled, activate all particles immediately
      particlesActivatedRef.current = particlesRef.current.length;
    }
  }, [particleData, config.particleSize, config.minParticleSize, config.sizeVariation, config.enableInitialAnimation, config.shootingDirection, imageData, resetAnimation]);

  // Animation loop
  const animate = useCallback((ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, width: number, height: number) => {
    const now = performance.now();
    const mouse = mouseRef.current;
    const mouseRadiusSq = config.mouseRadius * config.mouseRadius;
    const pCount = particlesRef.current.length;

    // Performance measurement
    const frameTime = now - lastFrameTimeRef.current;
    lastFrameTimeRef.current = now;

    // Adaptive frame skipping
    if (frameTime > 20 && adaptiveSkipRef.current < 3) {
      adaptiveSkipRef.current++;
    } else if (frameTime < 12 && adaptiveSkipRef.current > 0) {
      adaptiveSkipRef.current--;
    }

    const baseSkip = pCount > 20000 ? 2 : pCount > 10000 ? 1 : 0;
    const skipFrames = Math.max(baseSkip, adaptiveSkipRef.current);
    frameCountRef.current++;
    const shouldRender = frameCountRef.current % (skipFrames + 1) === 0;

    // Calculate and update FPS metrics (every 10 frames to reduce state updates)
    if (frameCountRef.current % 10 === 0 && frameTime > 0) {
      const currentFps = Math.round(1000 / frameTime);
      fpsHistoryRef.current.push(currentFps);
      if (fpsHistoryRef.current.length > 30) fpsHistoryRef.current.shift();
      const avgFps = Math.round(fpsHistoryRef.current.reduce((a, b) => a + b, 0) / fpsHistoryRef.current.length);

      // Determine the current render mode for display
      const effectiveShape = (config.autoPerformance && qualityModeRef.current === "squares")
        ? "squares"
        : (config.particleShape === "square" ? "squares" : "circles");

      setMetrics({
        fps: currentFps,
        avgFps,
        frameTime: Math.round(frameTime * 10) / 10,
        renderMode: effectiveShape as "circles" | "squares",
        skipFrames,
      });
    }

    // Update how many particles should be activated (sequential shooting)
    if (config.enableInitialAnimation && particlesActivatedRef.current < pCount) {
      const elapsed = (now - animationStartTimeRef.current) / 1000;
      particlesActivatedRef.current = Math.min(Math.floor(elapsed * config.particlesPerSecond), pCount);
    }

    const isAnimationComplete = particlesActivatedRef.current >= pCount;

    // Detect if there's activity (animation running or mouse interaction)
    const isMouseActive = mouse.x > -500 && mouse.y > -500;
    const isActive = !isAnimationComplete || isMouseActive;

    // Measure performance during activity when autoPerformance is enabled
    if (config.autoPerformance && qualityModeRef.current === null && isActive && lastFrameTimeRef.current > 0) {
      activityFrameCountRef.current++;
      if (frameTime > 20) {
        slowFrameCountRef.current++;
      }
      // After 60 frames of activity (~1 second), make the decision
      if (activityFrameCountRef.current >= 60) {
        const slowRatio = slowFrameCountRef.current / activityFrameCountRef.current;
        // If more than 30% of frames were slow, use squares
        qualityModeRef.current = slowRatio > 0.3 ? "squares" : "circles";
      }
    }

    // Pre-compute constants
    const mouseX = mouse.x;
    const mouseY = mouse.y;
    const mouseForce = config.mouseForce;
    const mouseRadius = config.mouseRadius;

    // Idle animation time factor
    const idleTime = now * 0.001 * config.idleAnimationSpeed;

    // Physics loop - always runs
    for (let i = 0; i < pCount; i++) {
      const p = particlesRef.current[i];
      const isActivated = i < particlesActivatedRef.current;
      if (!isActivated) continue;

      // Apply mouse interaction (only if enabled)
      const allowMouseInteraction = config.enableMouseInteraction && (isAnimationComplete || config.mouseInteractionDuringAnimation);
      if (!p.masked && allowMouseInteraction) {
        const dx = mouseX - p.x;
        const dy = mouseY - p.y;
        const distSq = dx * dx + dy * dy;

        if (distSq < mouseRadiusSq && distSq > 0) {
          const dist = Math.sqrt(distSq);
          const force = (mouseRadius - dist) / mouseRadius;
          // Use normalized direction instead of atan2/cos/sin for push/pull
          const invDist = 1 / dist;
          const nx = dx * invDist;
          const ny = dy * invDist;

          switch (config.mouseInteractionMode) {
            case "push":
              p.vx -= nx * force * mouseForce;
              p.vy -= ny * force * mouseForce;
              break;

            case "pull":
              p.vx += nx * force * mouseForce;
              p.vy += ny * force * mouseForce;
              break;

            case "orbit":
              // Perpendicular direction for orbital motion (rotate 90°: [-ny, nx])
              const orbitForce = force * mouseForce * config.orbitSpeed * 0.3;
              p.vx += (-ny) * orbitForce;
              p.vy += nx * orbitForce;
              // Slight pull toward mouse
              p.vx += nx * force * mouseForce * 0.1;
              p.vy += ny * force * mouseForce * 0.1;
              break;

            case "turbulence":
              const time = now * 0.001;
              const turbulenceX = Math.sin(p.x * 0.01 + time * 2) * Math.cos(p.y * 0.01 + time);
              const turbulenceY = Math.cos(p.x * 0.01 + time) * Math.sin(p.y * 0.01 + time * 1.5);
              const turbulenceForce = force * mouseForce * config.turbulenceIntensity * 0.5;
              p.vx += turbulenceX * turbulenceForce;
              p.vy += turbulenceY * turbulenceForce;
              break;
          }
        }
      }

      // Apply idle animation when mouse is not active (or mouse-aware modes)
      // Skip masked particles if idleAnimationAffectsMasked is disabled
      if (config.enableIdleAnimation && isAnimationComplete && (!p.masked || config.idleAnimationAffectsMasked)) {
        const mode = config.idleAnimationMode || "float";
        const intensity = config.idleAnimationIntensity * 0.1;

        // Calculate distance to mouse for turbulence fade
        const distToMouse = Math.sqrt(
          (p.x - mouseX) * (p.x - mouseX) + (p.y - mouseY) * (p.y - mouseY)
        );
        const turbulenceRadius = config.turbulenceMouseRadius || 200;
        const mouseFade = mode === "turbulence"
          ? Math.min(1, Math.max(0, (distToMouse - turbulenceRadius * 0.3) / (turbulenceRadius * 0.7)))
          : (isMouseActive ? 0 : 1);

        switch (mode) {
          case "float":
            // Classic Perlin noise floating
            if (!isMouseActive) {
              const noiseX = smoothNoise(p.originX * 0.01, p.originY * 0.01, idleTime);
              const noiseY = smoothNoise(p.originX * 0.01 + 100, p.originY * 0.01 + 100, idleTime);
              p.vx += noiseX * intensity;
              p.vy += noiseY * intensity;
            }
            break;
          case "turbulence":
            // Wave field that fades near mouse
            {
              const angle = smoothNoise(p.originX * 0.005, p.originY * 0.005, idleTime * 0.5) * Math.PI * 2;
              const flowX = Math.cos(angle) * intensity * 2;
              const flowY = Math.sin(angle) * intensity * 2;
              p.vx += flowX * mouseFade;
              p.vy += flowY * mouseFade;
            }
            break;
          case "wave":
            // Sine wave motion
            if (!isMouseActive) {
              const waveOffset = p.originX * 0.02 + idleTime * 2;
              p.vy += Math.sin(waveOffset) * intensity * 0.5;
              p.vx += Math.cos(waveOffset * 0.7) * intensity * 0.3;
            }
            break;
          case "pulse":
            // Breathing/pulse effect from center
            if (!isMouseActive) {
              const centerX = width / 2;
              const centerY = height / 2;
              const dx = p.originX - centerX;
              const dy = p.originY - centerY;
              const dist = Math.sqrt(dx * dx + dy * dy) || 1;
              const pulse = Math.sin(idleTime * 3) * intensity * 0.5;
              p.vx += (dx / dist) * pulse;
              p.vy += (dy / dist) * pulse;
            }
            break;
        }
      }

      // Calculate return speed based on particle speed and bounce settings
      let returnSpeed = config.returnSpeed * config.particleSpeed;
      let friction = config.friction;

      if (config.enableBounce && !isAnimationComplete) {
        returnSpeed = config.returnSpeed * (0.1 / config.bounceIntensity);
        friction = config.bounceDamping;
      }

      p.vx += (p.originX - p.x) * returnSpeed;
      p.vy += (p.originY - p.y) * returnSpeed;
      p.vx *= friction;
      p.vy *= friction;
      p.x += p.vx;
      p.y += p.vy;
    }

    // Skip rendering on some frames for performance
    if (!shouldRender) {
      animationRef.current = requestAnimationFrame(() => animate(ctx, canvas, width, height));
      return;
    }

    // Trails: use semi-transparent fill instead of clear
    if (config.enableTrails) {
      // Parse hex color to RGB
      const hexToRgb = (hex: string) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16)
        } : { r: 255, g: 255, b: 255 };
      };
      const bgColor = hexToRgb(config.trailBackgroundColor || "#ffffff");
      ctx.fillStyle = `rgba(${bgColor.r}, ${bgColor.g}, ${bgColor.b}, ${config.trailLength})`;
      ctx.fillRect(0, 0, width, height);
    } else {
      ctx.clearRect(0, 0, width, height);
    }

    const TWO_PI = Math.PI * 2;
    // Use squares when auto-performance detected low FPS
    const shape = (config.autoPerformance && qualityModeRef.current === "squares")
      ? "square"
      : config.particleShape;

    // Helper to draw a single particle shape
    const drawShape = (x: number, y: number, size: number) => {
      switch (shape) {
        case "circle":
          ctx.moveTo(x + size, y);
          ctx.arc(x, y, size, 0, TWO_PI);
          break;
        case "square":
          ctx.rect(x - size, y - size, size * 2, size * 2);
          break;
        case "triangle":
          ctx.moveTo(x, y - size);
          ctx.lineTo(x + size, y + size);
          ctx.lineTo(x - size, y + size);
          ctx.closePath();
          break;
        case "diamond":
          ctx.moveTo(x, y - size);
          ctx.lineTo(x + size, y);
          ctx.lineTo(x, y + size);
          ctx.lineTo(x - size, y);
          ctx.closePath();
          break;
        case "star":
          for (let j = 0; j < 5; j++) {
            const outerAngle = (j * 4 * Math.PI) / 5 - Math.PI / 2;
            const innerAngle = outerAngle + Math.PI / 5;
            if (j === 0) ctx.moveTo(x + Math.cos(outerAngle) * size, y + Math.sin(outerAngle) * size);
            else ctx.lineTo(x + Math.cos(outerAngle) * size, y + Math.sin(outerAngle) * size);
            ctx.lineTo(x + Math.cos(innerAngle) * size * 0.5, y + Math.sin(innerAngle) * size * 0.5);
          }
          ctx.closePath();
          break;
        case "heart":
          const hs = size * 0.6;
          ctx.moveTo(x, y + size * 0.3);
          ctx.bezierCurveTo(x, y - hs, x - size, y - hs, x - size, y);
          ctx.bezierCurveTo(x - size, y + hs, x, y + size, x, y + size);
          ctx.bezierCurveTo(x, y + size, x + size, y + hs, x + size, y);
          ctx.bezierCurveTo(x + size, y - hs, x, y - hs, x, y + size * 0.3);
          break;
      }
    };

    // Draw connections between nearby particles
    if (config.enableConnections) {
      const connDistSq = config.connectionDistance * config.connectionDistance;
      // Parse connection color to RGB for opacity support
      const hexToRgb = (hex: string) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16)
        } : { r: 255, g: 255, b: 255 };
      };
      const connColor = hexToRgb(config.connectionColor || "#ffffff");
      ctx.strokeStyle = `rgba(${connColor.r}, ${connColor.g}, ${connColor.b}, ${config.connectionOpacity})`;
      ctx.lineWidth = 0.5;
      ctx.beginPath();

      const activeParticles = particlesRef.current.slice(0, particlesActivatedRef.current);
      for (let i = 0; i < activeParticles.length; i++) {
        const p1 = activeParticles[i];
        // Only check a limited number of neighbors for performance
        for (let j = i + 1; j < Math.min(i + 50, activeParticles.length); j++) {
          const p2 = activeParticles[j];
          const dx = p1.x - p2.x;
          const dy = p1.y - p2.y;
          const distSq = dx * dx + dy * dy;
          if (distSq < connDistSq) {
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
          }
        }
      }
      ctx.stroke();
    }

    // Group particles by color for batched drawing
    const colorGroups: Map<string, Particle[]> = new Map();
    const maskedColorGroups: Map<string, Particle[]> = new Map();

    for (let i = 0; i < particlesActivatedRef.current; i++) {
      const p = particlesRef.current[i];
      // Calculate display color (with velocity shift if enabled)
      let displayColor = p.color;
      if (config.enableVelocityColor) {
        const velocity = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        displayColor = shiftColorByVelocity(
          p.color,
          velocity,
          config.velocityColorIntensity,
          config.velocityColorMode || "brighten",
          config.velocityColorTarget || "#ffffff"
        );
      }

      const targetMap = p.masked ? maskedColorGroups : colorGroups;
      if (!targetMap.has(displayColor)) targetMap.set(displayColor, []);
      targetMap.get(displayColor)!.push(p);
    }

    // Helper to draw a group of particles
    const drawGroup = (groups: Map<string, Particle[]>) => {
      for (const [color, particles] of groups) {
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        for (const p of particles) {
          drawShape(p.x, p.y, p.size);
        }
        ctx.fill();
      }
    };

    // Draw based on maskedParticlesOnTop setting
    if (config.maskedParticlesOnTop) {
      drawGroup(colorGroups);       // Non-masked first (bottom)
      drawGroup(maskedColorGroups); // Masked on top
    } else {
      drawGroup(maskedColorGroups); // Masked first (bottom)
      drawGroup(colorGroups);       // Non-masked on top
    }

    ctx.globalAlpha = 1;
    animationRef.current = requestAnimationFrame(() => animate(ctx, canvas, width, height));
  }, [config]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imageData) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size to match image dimensions exactly
    const dpr = window.devicePixelRatio || 1;
    canvas.width = imageData.width * dpr;
    canvas.height = imageData.height * dpr;

    // Scale the context to handle high DPI displays
    ctx.scale(dpr, dpr);

    initParticles();

    const getCoords = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      // Convert from CSS coordinates to canvas coordinates
      const scaleX = imageData.width / rect.width;
      const scaleY = imageData.height / rect.height;
      return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY
      };
    };

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = getCoords(e.clientX, e.clientY);
    };

    const handleMouseLeave = () => {
      mouseRef.current = { x: -1000, y: -1000 };
    };

    const handleTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (touch) mouseRef.current = getCoords(touch.clientX, touch.clientY);
    };

    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mouseleave", handleMouseLeave);
    canvas.addEventListener("touchmove", handleTouchMove);

    animationRef.current = requestAnimationFrame(() => animate(ctx, canvas, imageData.width, imageData.height));

    return () => {
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("mouseleave", handleMouseLeave);
      canvas.removeEventListener("touchmove", handleTouchMove);
      cancelAnimationFrame(animationRef.current);
    };
  }, [initParticles, animate, imageData]);

  if (!imageData) {
    return (
      <div className="bg-gray-900 rounded-xl border border-gray-800 h-[500px] flex items-center justify-center">
        <div className="text-center text-gray-500">
          <div className="text-6xl mb-4">🖼️</div>
          <p>Upload an image to see the particle animation</p>
        </div>
      </div>
    );
  }

  // Calculate display dimensions to fit within a max height while maintaining aspect ratio
  const maxHeight = 600;
  const aspectRatio = imageData.width / imageData.height;
  const displayHeight = Math.min(maxHeight, imageData.height);
  const displayWidth = displayHeight * aspectRatio;

  return (
    <div className="space-y-4">
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <div className="p-3 border-b border-gray-800 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-400">
              {particleCount.toLocaleString()} particles
            </span>
            {/* Performance Metrics */}
            <div className="flex items-center gap-3 text-xs">
              <span className={`font-mono ${metrics.fps >= 50 ? "text-green-400" : metrics.fps >= 30 ? "text-yellow-400" : "text-red-400"}`}>
                {metrics.fps} FPS
              </span>
              <span className="text-gray-500">avg: {metrics.avgFps}</span>
              <span className="text-gray-500">{metrics.frameTime}ms</span>
              <span className="text-gray-500 capitalize">{metrics.renderMode}</span>
              {metrics.skipFrames > 0 && (
                <span className="text-gray-500">skip: {metrics.skipFrames}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {config.enableInitialAnimation && (
              <button
                onClick={() => {
                  initParticles();
                }}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-xs text-white transition-colors flex items-center gap-1.5"
              >
                <RotateCcw className="w-3 h-3" />
                Replay Animation
              </button>
            )}
            <span className="text-xs text-gray-500">Move mouse to interact</span>
          </div>
        </div>
        <div className="flex items-center justify-center p-4 bg-gray-800/30">
          <canvas
            ref={canvasRef}
            className="cursor-crosshair"
            style={{
              touchAction: "none",
              width: `${displayWidth}px`,
              height: `${displayHeight}px`,
              maxWidth: "100%"
            }}
          />
        </div>
      </div>

      {/* Original Image Preview */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <div className="p-3 border-b border-gray-800">
          <span className="text-sm text-gray-400">Original Image</span>
        </div>
        <div className="p-4 flex items-center justify-center bg-gray-800/50">
          <img
            src={imageData.dataUrl}
            alt="Original"
            className="max-h-[300px] object-contain rounded"
          />
        </div>
      </div>
    </div>
  );
}

