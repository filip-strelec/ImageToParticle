import { ParticleConfig, ParticleData, ImageData } from "@/types";

// Optimized: Uses normalized direction vectors instead of atan2/cos/sin
function generateMouseInteractionCode(config: ParticleConfig): string {
  switch (config.mouseInteractionMode) {
    case "push":
      return `          // Push particles away from mouse (optimized: no trig)
          p.vx -= nx * force * CONFIG.mouseForce;
          p.vy -= ny * force * CONFIG.mouseForce;`;

    case "pull":
      return `          // Pull particles toward mouse (optimized: no trig)
          p.vx += nx * force * CONFIG.mouseForce;
          p.vy += ny * force * CONFIG.mouseForce;`;

    case "orbit":
      return `          // Make particles orbit around mouse (optimized: no trig)
          // Perpendicular direction for orbit: rotate 90° = [-ny, nx]
          const orbitForce = force * CONFIG.mouseForce * CONFIG.orbitSpeed * 0.3;
          p.vx += (-ny) * orbitForce;
          p.vy += nx * orbitForce;
          // Slight pull toward mouse to maintain orbit
          p.vx += nx * force * CONFIG.mouseForce * 0.1;
          p.vy += ny * force * CONFIG.mouseForce * 0.1;`;

    case "turbulence":
      return `          // Create chaotic turbulent motion
          const turbulenceX = Math.sin(p.x * 0.01 + now * 0.002) * Math.cos(p.y * 0.01 + now * 0.001);
          const turbulenceY = Math.cos(p.x * 0.01 + now * 0.001) * Math.sin(p.y * 0.01 + now * 0.0015);
          const turbulenceForce = force * CONFIG.mouseForce * CONFIG.turbulenceIntensity * 0.5;
          p.vx += turbulenceX * turbulenceForce;
          p.vy += turbulenceY * turbulenceForce;`;

    default:
      return `          // Push particles away from mouse (optimized: no trig)
          p.vx -= nx * force * CONFIG.mouseForce;
          p.vy -= ny * force * CONFIG.mouseForce;`;
  }
}

function generatePhysicsCode(config: ParticleConfig): string {
  if (config.enableBounce && config.enableInitialAnimation) {
    return `        // Calculate physics with bounce effect
        let returnSpeed = CONFIG.returnSpeed * CONFIG.particleSpeed;
        let friction = CONFIG.friction;

        // Apply bounce effect during animation
        if (CONFIG.enableBounce && !isAnimationComplete) {
          returnSpeed = CONFIG.returnSpeed * (0.1 / CONFIG.bounceIntensity);
          friction = CONFIG.bounceDamping;
        }`;
  } else {
    return `        // Calculate physics
        const returnSpeed = CONFIG.returnSpeed * CONFIG.particleSpeed;
        const friction = CONFIG.friction;`;
  }
}

export function generateComponentCode(
  particles: ParticleData[],
  config: ParticleConfig,
  imageData: ImageData,
  mode: "inline" | "separate"
): string {
  const dataImport = mode === "separate"
    ? `import { PARTICLE_DATA } from "./particleData";\n`
    : "";

  // Helper to generate particle data object string
  const formatParticle = (p: ParticleData): string => {
    const parts: string[] = [
      `x:${Math.round(p.x)}`,
      `y:${Math.round(p.y)}`,
      `c:"${p.color}"`,
    ];
    if (p.masked) parts.push('m:true');
    if (p.optionalMasks && p.optionalMasks.length > 0) {
      parts.push(`om:["${p.optionalMasks.join('","')}"]`);
    }
    return `{${parts.join(',')}}`;
  };

  const dataConst = mode === "inline"
    ? `\n// Particle positions and colors extracted from image\nconst PARTICLE_DATA: ParticleData[] = [\n${
        particles.map(p => `  ${formatParticle(p)}`).join(',\n')
      }\n];\n`
    : "";

  // Check if any particles have optional masks
  const hasOptionalMasks = particles.some(p => p.optionalMasks && p.optionalMasks.length > 0);

  // Generate mouse interaction mode code
  const mouseInteractionCode = generateMouseInteractionCode(config);

  // Generate physics code based on config
  const physicsCode = generatePhysicsCode(config);

  // Generate refs based on render mode
  const generatePerformanceRefs = (renderMode: string): string => {
    if (renderMode === "auto") {
      return `  // Performance optimization refs
  const frameCountRef = useRef<number>(0);
  const lastFrameTimeRef = useRef<number>(0);
  const adaptiveSkipRef = useRef<number>(0);
  // Quality mode: null = undecided, locks after measuring during activity
  const qualityModeRef = useRef<"circles" | "squares" | null>(null);
  const slowFrameCountRef = useRef<number>(0);
  const activityFrameCountRef = useRef<number>(0);`;
    } else {
      return `  // Performance optimization refs
  const frameCountRef = useRef<number>(0);
  const lastFrameTimeRef = useRef<number>(0);
  const adaptiveSkipRef = useRef<number>(0);`;
    }
  };

  // Generate quality detection code for auto mode
  const generateQualityDetection = (renderMode: string): string => {
    if (renderMode === "auto") {
      return `
    // Detect activity (animation running or mouse interaction)
    const isMouseActive = mouse.x > -500 && mouse.y > -500;
    const isActive = !isAnimationComplete || isMouseActive;

    // Measure performance during activity, then lock the decision permanently
    if (qualityModeRef.current === null && isActive && lastFrameTimeRef.current > 0) {
      activityFrameCountRef.current++;
      if (frameTime > 20) slowFrameCountRef.current++;
      // After 60 frames of activity (~1 second), decide
      if (activityFrameCountRef.current >= 60) {
        const slowRatio = slowFrameCountRef.current / activityFrameCountRef.current;
        qualityModeRef.current = slowRatio > 0.3 ? "squares" : "circles";
      }
    }
`;
    }
    return "";
  };

  // Generate the useSquares determination based on render mode
  const generateUseSquaresCode = (renderMode: string): string => {
    if (renderMode === "circles") {
      return `const useSquares = false; // Always use circles`;
    } else if (renderMode === "squares") {
      return `const useSquares = true; // Always use squares for performance`;
    } else {
      return `const useSquares = qualityModeRef.current === "squares"; // Auto-detected`;
    }
  };

  const performanceRefs = generatePerformanceRefs(config.renderMode);
  const qualityDetection = generateQualityDetection(config.renderMode);
  const useSquaresCode = generateUseSquaresCode(config.renderMode);

  return `"use client";

import { useEffect, useRef, useCallback } from "react";
${dataImport}
interface ParticleData {
  x: number;
  y: number;
  c: string; // color
  m?: boolean; // masked (won't interact with mouse)${hasOptionalMasks ? '\n  om?: string[]; // optional mask slugs this particle belongs to' : ''}
}

interface Particle {
  x: number;
  y: number;
  originX: number;
  originY: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  masked?: boolean;${hasOptionalMasks ? '\n  optionalMasks?: string[];' : ''}
}

interface ParticleAnimationProps {
  className?: string;
}
${dataConst}
// Original image dimensions
const IMG_WIDTH = ${imageData.width};
const IMG_HEIGHT = ${imageData.height};

// Pre-computed constant for performance
const TWO_PI = Math.PI * 2;

// Configuration
const CONFIG = {
  friction: ${config.friction},
  returnSpeed: ${config.returnSpeed},
  mouseRadius: ${config.mouseRadius},
  mouseForce: ${config.mouseForce},
  mouseInteractionMode: "${config.mouseInteractionMode}" as const,
  orbitSpeed: ${config.orbitSpeed},
  turbulenceIntensity: ${config.turbulenceIntensity},
  particleSpeed: ${config.particleSpeed},
  enableBounce: ${config.enableBounce},
  bounceIntensity: ${config.bounceIntensity},
  bounceDamping: ${config.bounceDamping},
  enableInitialAnimation: ${config.enableInitialAnimation},
  particlesPerSecond: ${config.particlesPerSecond},
  shootingDirection: "${config.shootingDirection}" as const,
  mouseInteractionDuringAnimation: ${config.mouseInteractionDuringAnimation},
  particleSize: ${config.particleSize},
  minParticleSize: ${config.minParticleSize},
  sizeVariation: ${config.sizeVariation},
};

export default function ParticleAnimation({ className = "" }: ParticleAnimationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const mouseRef = useRef({ x: -1000, y: -1000 });
  const animationRef = useRef<number>(0);
  const animationStartTimeRef = useRef<number>(0);
  const particlesActivatedRef = useRef<number>(0);
${performanceRefs}

  const initParticles = useCallback(() => {
    const centerX = IMG_WIDTH / 2;
    const centerY = IMG_HEIGHT / 2;

    // Sort particles based on shooting direction
    let sortedData = [...PARTICLE_DATA];
    if (CONFIG.enableInitialAnimation) {
      if (CONFIG.shootingDirection === "top-to-bottom") {
        sortedData.sort((a, b) => a.y - b.y);
      } else if (CONFIG.shootingDirection === "all-directions") {
        sortedData.sort((a, b) => {
          const distA = Math.sqrt(Math.pow(a.x - centerX, 2) + Math.pow(a.y - centerY, 2));
          const distB = Math.sqrt(Math.pow(b.x - centerX, 2) + Math.pow(b.y - centerY, 2));
          return distA - distB;
        });
      }
    }

    particlesRef.current = sortedData.map(p => {
      const startX = CONFIG.enableInitialAnimation ? centerX : p.x;
      const startY = CONFIG.enableInitialAnimation ? centerY : p.y;

      return {
        x: startX,
        y: startY,
        originX: p.x,
        originY: p.y,
        vx: 0,
        vy: 0,
        size: Math.max(CONFIG.minParticleSize, CONFIG.particleSize + Math.random() * CONFIG.sizeVariation),
        color: p.c,
        masked: p.m,${hasOptionalMasks ? '\n        optionalMasks: p.om,' : ''}
      };
    });

    // Reset animation
    animationStartTimeRef.current = performance.now();
    particlesActivatedRef.current = CONFIG.enableInitialAnimation ? 0 : particlesRef.current.length;
  }, []);

  const animate = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const now = performance.now();
    const mouse = mouseRef.current;
    const mouseRadiusSq = CONFIG.mouseRadius * CONFIG.mouseRadius;
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

    // Update activated particles count for sequential animation
    if (CONFIG.enableInitialAnimation && particlesActivatedRef.current < pCount) {
      const elapsed = (now - animationStartTimeRef.current) / 1000;
      particlesActivatedRef.current = Math.min(Math.floor(elapsed * CONFIG.particlesPerSecond), pCount);
    }

    const isAnimationComplete = particlesActivatedRef.current >= pCount;
${qualityDetection}
    // Pre-compute values outside loop
    const mouseX = mouse.x;
    const mouseY = mouse.y;
    const mouseRadius = CONFIG.mouseRadius;

    // Physics loop - always runs
    for (let i = 0; i < pCount; i++) {
      const p = particlesRef.current[i];
      const isActivated = i < particlesActivatedRef.current;
      if (!isActivated) continue;

      // Apply mouse interaction (optimized: no trig functions)
      const allowMouseInteraction = isAnimationComplete || CONFIG.mouseInteractionDuringAnimation;
      if (!p.masked && allowMouseInteraction) {
        const dx = mouseX - p.x;
        const dy = mouseY - p.y;
        const distSq = dx * dx + dy * dy;

        if (distSq < mouseRadiusSq && distSq > 0) {
          const dist = Math.sqrt(distSq);
          const force = (mouseRadius - dist) / mouseRadius;
          // Normalized direction vector (replaces atan2/cos/sin)
          const invDist = 1 / dist;
          const nx = dx * invDist;
          const ny = dy * invDist;

${mouseInteractionCode}
        }
      }

${physicsCode}

      p.vx += (p.originX - p.x) * returnSpeed;
      p.vy += (p.originY - p.y) * returnSpeed;
      p.vx *= friction;
      p.vy *= friction;
      p.x += p.vx;
      p.y += p.vy;
    }

    // Skip rendering on some frames for performance
    if (!shouldRender) {
      animationRef.current = requestAnimationFrame(() => animate(ctx, width, height));
      return;
    }

    // Clear and render
    ctx.clearRect(0, 0, width, height);

    // Render mode
    ${useSquaresCode}

    // Group particles by color for batched drawing
    const colorGroups: Map<string, Particle[]> = new Map();
    const maskedColorGroups: Map<string, Particle[]> = new Map();

    for (let i = 0; i < particlesActivatedRef.current; i++) {
      const p = particlesRef.current[i];
      const targetMap = p.masked ? maskedColorGroups : colorGroups;
      if (!targetMap.has(p.color)) targetMap.set(p.color, []);
      targetMap.get(p.color)!.push(p);
    }

    // Helper to draw a group of particles
    const drawGroup = (groups: Map<string, Particle[]>) => {
      for (const [color, particles] of groups) {
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
    };

    // Draw based on z-order setting
    ${config.maskedParticlesOnTop ? `drawGroup(colorGroups);       // Non-masked first (bottom)
    drawGroup(maskedColorGroups); // Masked on top` : `drawGroup(maskedColorGroups); // Masked first (bottom)
    drawGroup(colorGroups);       // Non-masked on top`}

    ctx.globalAlpha = 1;
    animationRef.current = requestAnimationFrame(() => animate(ctx, width, height));
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size to match image dimensions
    const dpr = window.devicePixelRatio || 1;
    canvas.width = IMG_WIDTH * dpr;
    canvas.height = IMG_HEIGHT * dpr;
    ctx.scale(dpr, dpr);

    initParticles();

    const getCoords = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = IMG_WIDTH / rect.width;
      const scaleY = IMG_HEIGHT / rect.height;
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

    animationRef.current = requestAnimationFrame(() => animate(ctx, IMG_WIDTH, IMG_HEIGHT));

    return () => {
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("mouseleave", handleMouseLeave);
      canvas.removeEventListener("touchmove", handleTouchMove);
      cancelAnimationFrame(animationRef.current);
    };
  }, [initParticles, animate]);

  // Calculate display dimensions maintaining aspect ratio
  const aspectRatio = IMG_WIDTH / IMG_HEIGHT;

  return (
    <canvas
      ref={canvasRef}
      className={\`cursor-crosshair \${className}\`}
      style={{
        touchAction: "none",
        width: "100%",
        height: "auto",
        aspectRatio: \`\${aspectRatio}\`,
        maxWidth: \`\${IMG_WIDTH}px\`,
      }}
    />
  );
}
`;
}

export function generateParticleDataCode(particles: ParticleData[]): string {
  const hasOptionalMasks = particles.some(p => p.optionalMasks && p.optionalMasks.length > 0);

  // Helper to format a particle
  const formatParticle = (p: ParticleData): string => {
    const parts: string[] = [
      `x:${Math.round(p.x)}`,
      `y:${Math.round(p.y)}`,
      `c:"${p.color}"`,
    ];
    if (p.masked) parts.push('m:true');
    if (p.optionalMasks && p.optionalMasks.length > 0) {
      parts.push(`om:["${p.optionalMasks.join('","')}"]`);
    }
    return `  {${parts.join(',')}}`;
  };

  return `// Auto-generated particle data
// Particles: ${particles.length}

export interface ParticleData {
  x: number;
  y: number;
  c: string;
  m?: boolean;${hasOptionalMasks ? '\n  om?: string[]; // optional mask slugs' : ''}
}

export const PARTICLE_DATA: ParticleData[] = [
${particles.map(p => formatParticle(p)).join(',\n')}
];
`;
}

