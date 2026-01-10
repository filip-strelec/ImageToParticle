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
  const animationStartTimeRef = useRef<number>(0);
  const particlesActivatedRef = useRef<number>(0); // How many particles have been "shot" so far
  const [particleCount, setParticleCount] = useState(0); // Track particle count for display

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
    const mouse = mouseRef.current;
    const mouseRadiusSq = config.mouseRadius * config.mouseRadius;
    const particleCount = particlesRef.current.length;

    // Adaptive frame skipping for performance with large particle counts
    const skipFrames = particleCount > 20000 ? 2 : particleCount > 10000 ? 1 : 0;
    frameCountRef.current++;

    const shouldRender = frameCountRef.current % (skipFrames + 1) === 0;

    // Update how many particles should be activated (sequential shooting)
    if (config.enableInitialAnimation && particlesActivatedRef.current < particleCount) {
      const elapsed = (performance.now() - animationStartTimeRef.current) / 1000; // seconds
      const shouldBeActivated = Math.floor(elapsed * config.particlesPerSecond);
      particlesActivatedRef.current = Math.min(shouldBeActivated, particleCount);
    }

    // Always update physics, but only render on certain frames
    // Group particles by color for batched drawing
    // Separate masked and non-masked particles for proper z-index layering
    const colorGroups: Map<string, Particle[]> = new Map();
    const maskedColorGroups: Map<string, Particle[]> = new Map();

    const isAnimationComplete = particlesActivatedRef.current >= particleCount;

    for (let i = 0; i < particlesRef.current.length; i++) {
      const p = particlesRef.current[i];
      const isActivated = i < particlesActivatedRef.current;

      // Apply mouse interaction if particle is activated, not masked, and either:
      // - Animation is complete, OR
      // - Mouse interaction during animation is enabled
      const allowMouseInteraction = isAnimationComplete || config.mouseInteractionDuringAnimation;
      if (!p.masked && allowMouseInteraction && isActivated) {
        const dx = mouse.x - p.x;
        const dy = mouse.y - p.y;
        const distSq = dx * dx + dy * dy;

        if (distSq < mouseRadiusSq && distSq > 0) {
          const dist = Math.sqrt(distSq);
          const force = (config.mouseRadius - dist) / config.mouseRadius;
          const angle = Math.atan2(dy, dx);

          switch (config.mouseInteractionMode) {
            case "push":
              // Push particles away from mouse
              p.vx -= Math.cos(angle) * force * config.mouseForce;
              p.vy -= Math.sin(angle) * force * config.mouseForce;
              break;

            case "pull":
              // Pull particles toward mouse
              p.vx += Math.cos(angle) * force * config.mouseForce;
              p.vy += Math.sin(angle) * force * config.mouseForce;
              break;

            case "orbit":
              // Make particles orbit around mouse
              // Perpendicular angle for orbital motion
              const orbitAngle = angle + Math.PI / 2;
              const orbitForce = force * config.mouseForce * config.orbitSpeed * 0.3;
              p.vx += Math.cos(orbitAngle) * orbitForce;
              p.vy += Math.sin(orbitAngle) * orbitForce;
              // Also add slight pull toward mouse to maintain orbit
              p.vx += Math.cos(angle) * force * config.mouseForce * 0.1;
              p.vy += Math.sin(angle) * force * config.mouseForce * 0.1;
              break;

            case "turbulence":
              // Create chaotic turbulent motion
              const time = performance.now() * 0.001;
              // Use particle position and time for pseudo-random turbulence
              const turbulenceX = Math.sin(p.x * 0.01 + time * 2) * Math.cos(p.y * 0.01 + time);
              const turbulenceY = Math.cos(p.x * 0.01 + time) * Math.sin(p.y * 0.01 + time * 1.5);
              const turbulenceForce = force * config.mouseForce * config.turbulenceIntensity * 0.5;
              p.vx += turbulenceX * turbulenceForce;
              p.vy += turbulenceY * turbulenceForce;
              break;
          }
        }
      }

      // Only move particles that have been activated
      if (isActivated) {
        // Calculate return speed based on particle speed and bounce settings
        let returnSpeed = config.returnSpeed * config.particleSpeed;
        let friction = config.friction;

        // Apply bounce effect if enabled (overshoot and spring back)
        if (config.enableBounce && !isAnimationComplete) {
          // Bounce intensity affects how much the particle overshoots
          // Lower return speed = more overshoot
          returnSpeed = config.returnSpeed * (0.1 / config.bounceIntensity);
          // Bounce damping controls how quickly the oscillation settles
          friction = config.bounceDamping;
        }

        p.vx += (p.originX - p.x) * returnSpeed;
        p.vy += (p.originY - p.y) * returnSpeed;
        p.vx *= friction;
        p.vy *= friction;
        p.x += p.vx;
        p.y += p.vy;

        if (shouldRender) {
          // Separate masked and non-masked particles for proper layering
          const targetMap = p.masked ? maskedColorGroups : colorGroups;
          if (!targetMap.has(p.color)) {
            targetMap.set(p.color, []);
          }
          targetMap.get(p.color)!.push(p);
        }
      }
    }

    // Only render if we should this frame
    if (shouldRender) {
      // Clear using logical dimensions (not buffer dimensions)
      ctx.clearRect(0, 0, width, height);

      // Draw non-masked particles first (bottom layer)
      for (const [color, particles] of colorGroups) {
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        for (const p of particles) {
          ctx.moveTo(p.x + p.size, p.y);
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        }
        ctx.fill();
      }

      // Draw masked particles on top (top layer - highest z-index)
      for (const [color, particles] of maskedColorGroups) {
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        for (const p of particles) {
          ctx.moveTo(p.x + p.size, p.y);
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        }
        ctx.fill();
      }

      ctx.globalAlpha = 1;
    }

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

