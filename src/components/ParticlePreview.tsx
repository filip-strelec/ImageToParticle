"use client";

import { useEffect, useRef, useCallback, useMemo, useState } from "react";
import { ImageData, ParticleConfig, Particle, OptionalMask, ParticleEdit } from "@/types";
import { extractParticleData } from "@/utils/particleUtils";
import { RotateCcw } from "lucide-react";

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

    // Update how many particles should be activated (sequential shooting)
    if (config.enableInitialAnimation && particlesActivatedRef.current < pCount) {
      const elapsed = (now - animationStartTimeRef.current) / 1000;
      particlesActivatedRef.current = Math.min(Math.floor(elapsed * config.particlesPerSecond), pCount);
    }

    const isAnimationComplete = particlesActivatedRef.current >= pCount;

    // Detect if there's activity (animation running or mouse interaction)
    const isMouseActive = mouse.x > -500 && mouse.y > -500;
    const isActive = !isAnimationComplete || isMouseActive;

    // Measure performance during activity, then lock the decision
    if (qualityModeRef.current === null && isActive && lastFrameTimeRef.current > 0) {
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

    // Physics loop - always runs
    for (let i = 0; i < pCount; i++) {
      const p = particlesRef.current[i];
      const isActivated = i < particlesActivatedRef.current;
      if (!isActivated) continue;

      // Apply mouse interaction
      const allowMouseInteraction = isAnimationComplete || config.mouseInteractionDuringAnimation;
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

    // Clear and render
    ctx.clearRect(0, 0, width, height);

    // Use circles by default, squares only if locked to squares after measurement
    const useSquares = qualityModeRef.current === "squares";
    const TWO_PI = Math.PI * 2;

    // Group particles by color for batched drawing
    const colorGroups: Map<string, Particle[]> = new Map();
    const maskedColorGroups: Map<string, Particle[]> = new Map();

    for (let i = 0; i < particlesActivatedRef.current; i++) {
      const p = particlesRef.current[i];
      const targetMap = p.masked ? maskedColorGroups : colorGroups;
      if (!targetMap.has(p.color)) targetMap.set(p.color, []);
      targetMap.get(p.color)!.push(p);
    }

    // Draw non-masked particles first (bottom layer)
    for (const [color, particles] of colorGroups) {
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.85;
      if (useSquares) {
        for (const p of particles) {
          ctx.fillRect(p.x - p.size, p.y - p.size, p.size * 2, p.size * 2);
        }
      } else {
        ctx.beginPath();
        for (const p of particles) {
          ctx.moveTo(p.x + p.size, p.y);
          ctx.arc(p.x, p.y, p.size, 0, TWO_PI);
        }
        ctx.fill();
      }
    }

    // Draw masked particles on top (top layer)
    for (const [color, particles] of maskedColorGroups) {
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.85;
      if (useSquares) {
        for (const p of particles) {
          ctx.fillRect(p.x - p.size, p.y - p.size, p.size * 2, p.size * 2);
        }
      } else {
        ctx.beginPath();
        for (const p of particles) {
          ctx.moveTo(p.x + p.size, p.y);
          ctx.arc(p.x, p.y, p.size, 0, TWO_PI);
        }
        ctx.fill();
      }
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
        <div className="p-3 border-b border-gray-800 flex items-center justify-between">
          <span className="text-sm text-gray-400">
            {particleCount.toLocaleString()} particles
          </span>
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

