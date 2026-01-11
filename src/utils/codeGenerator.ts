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

// Generate helper functions for new features
function generateHelperFunctions(config: ParticleConfig): string {
  let helpers = "";

  if (config.enableIdleAnimation) {
    helpers += `
// Simple noise for idle animation
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
`;
  }

  if (config.enableVelocityColor) {
    helpers += `
// Parse color to RGB for velocity color shifting
function parseColorToRGB(color: string): [number, number, number] {
  if (color.startsWith("rgb")) {
    const match = color.match(/\\d+/g);
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
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
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
  if (s === 0) { r = g = b = l; }
  else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1; if (t > 1) t -= 1;
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

type VelocityColorMode = "brighten" | "darken" | "hue-shift" | "saturation" | "rainbow";

// Store particle hue offset for rainbow mode
const particleHueOffsets = new WeakMap<object, number>();

function shiftColorByVelocity(color: string, velocity: number, intensity: number, mode: VelocityColorMode, targetColor: string, particleRef?: object): string {
  const [r, g, b] = parseColorToRGB(color);
  const factor = Math.min(velocity * intensity * 10, 100);
  switch (mode) {
    case "brighten": {
      const [tr, tg, tb] = parseColorToRGB(targetColor);
      const t = Math.min(factor / 100, 1);
      const nr = Math.round(r + (tr - r) * t);
      const ng = Math.round(g + (tg - g) * t);
      const nb = Math.round(b + (tb - b) * t);
      return \`rgb(\${nr},\${ng},\${nb})\`;
    }
    case "darken":
      return \`rgb(\${Math.max(0, r - factor)},\${Math.max(0, g - factor)},\${Math.max(0, b - factor)})\`;
    case "hue-shift": {
      const [h, s, l] = rgbToHsl(r, g, b);
      const [nr, ng, nb] = hslToRgb((h + factor * 0.01) % 1, s, l);
      return \`rgb(\${nr},\${ng},\${nb})\`;
    }
    case "saturation": {
      const [h, s, l] = rgbToHsl(r, g, b);
      const [nr, ng, nb] = hslToRgb(h, Math.min(1, s + factor * 0.01), l);
      return \`rgb(\${nr},\${ng},\${nb})\`;
    }
    case "rainbow": {
      if (velocity < 0.1) return color;
      let hueOffset = 0;
      if (particleRef) {
        hueOffset = particleHueOffsets.get(particleRef) || Math.random();
        hueOffset = (hueOffset + velocity * intensity * 0.02) % 1;
        particleHueOffsets.set(particleRef, hueOffset);
      } else {
        hueOffset = (performance.now() * 0.001 * intensity + velocity * 0.1) % 1;
      }
      const [nr, ng, nb] = hslToRgb(hueOffset, 1, 0.5);
      return \`rgb(\${nr},\${ng},\${nb})\`;
    }
    default:
      return color;
  }
}
`;
  }

  return helpers;
}

// Generate shape drawing code
function generateShapeDrawCode(config: ParticleConfig): string {
  if (config.particleShape === "circle") {
    return `ctx.moveTo(x + size, y);
          ctx.arc(x, y, size, 0, TWO_PI);`;
  }

  return `switch (CONFIG.particleShape) {
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
      }`;
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
  const lastFrameTimeRef = useRef<number>(0);
  // Quality mode: null = undecided, locks after measuring during activity
  const qualityModeRef = useRef<"circles" | "squares" | null>(null);
  const slowFrameCountRef = useRef<number>(0);
  const activityFrameCountRef = useRef<number>(0);`;
    } else {
      return `  // Performance measurement ref
  const lastFrameTimeRef = useRef<number>(0);`;
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
  const helperFunctions = generateHelperFunctions(config);
  const shapeDrawCode = generateShapeDrawCode(config);

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
${helperFunctions}
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
  // New features
  enableMouseInteraction: ${config.enableMouseInteraction},
  particleShape: "${config.particleShape}" as const,
  autoPerformance: ${config.autoPerformance ?? false},
  enableTrails: ${config.enableTrails},
  trailLength: ${config.trailLength},
  trailBackgroundColor: "${config.trailBackgroundColor || '#ffffff'}",
  enableConnections: ${config.enableConnections},
  connectionDistance: ${config.connectionDistance},
  connectionOpacity: ${config.connectionOpacity},
  connectionColor: "${config.connectionColor || '#ffffff'}",
  enableIdleAnimation: ${config.enableIdleAnimation},
  idleAnimationMode: "${config.idleAnimationMode || 'float'}" as const,
  idleAnimationSpeed: ${config.idleAnimationSpeed},
  idleAnimationIntensity: ${config.idleAnimationIntensity},
  idleAnimationAffectsMasked: ${config.idleAnimationAffectsMasked ?? false},
  turbulenceMouseRadius: ${config.turbulenceMouseRadius || 200},
  enableVelocityColor: ${config.enableVelocityColor},
  velocityColorMode: "${config.velocityColorMode || 'brighten'}" as const,
  velocityColorIntensity: ${config.velocityColorIntensity},
  velocityColorTarget: "${config.velocityColorTarget || '#ffffff'}",
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

    // Update activated particles count for sequential animation
    if (CONFIG.enableInitialAnimation && particlesActivatedRef.current < pCount) {
      const elapsed = (now - animationStartTimeRef.current) / 1000;
      particlesActivatedRef.current = Math.min(Math.floor(elapsed * CONFIG.particlesPerSecond), pCount);
    }

    const isAnimationComplete = particlesActivatedRef.current >= pCount;
    const isMouseActive = mouse.x > -500 && mouse.y > -500;
${qualityDetection}
    // Pre-compute values outside loop
    const mouseX = mouse.x;
    const mouseY = mouse.y;
    const mouseRadius = CONFIG.mouseRadius;
    ${config.enableIdleAnimation ? 'const idleTime = now * 0.001 * CONFIG.idleAnimationSpeed;' : ''}

    // Physics loop - always runs
    for (let i = 0; i < pCount; i++) {
      const p = particlesRef.current[i];
      const isActivated = i < particlesActivatedRef.current;
      if (!isActivated) continue;

      // Apply mouse interaction (optimized: no trig functions)
      const allowMouseInteraction = ${config.enableMouseInteraction ? 'CONFIG.enableMouseInteraction && ' : ''}(isAnimationComplete || CONFIG.mouseInteractionDuringAnimation);
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
${config.enableIdleAnimation ? `
      // Apply idle animation based on mode (skip masked particles if disabled)
      if (CONFIG.enableIdleAnimation && isAnimationComplete && (!p.masked || CONFIG.idleAnimationAffectsMasked)) {
        const intensity = CONFIG.idleAnimationIntensity * 0.1;
        const distToMouse = Math.sqrt((p.x - mouseX) * (p.x - mouseX) + (p.y - mouseY) * (p.y - mouseY));
        const turbRadius = CONFIG.turbulenceMouseRadius;
        const mouseFade = CONFIG.idleAnimationMode === "turbulence"
          ? Math.min(1, Math.max(0, (distToMouse - turbRadius * 0.3) / (turbRadius * 0.7)))
          : (isMouseActive ? 0 : 1);

        switch (CONFIG.idleAnimationMode) {
          case "float":
            if (!isMouseActive) {
              const noiseX = smoothNoise(p.originX * 0.01, p.originY * 0.01, idleTime);
              const noiseY = smoothNoise(p.originX * 0.01 + 100, p.originY * 0.01 + 100, idleTime);
              p.vx += noiseX * intensity;
              p.vy += noiseY * intensity;
            }
            break;
          case "turbulence": {
            const angle = smoothNoise(p.originX * 0.005, p.originY * 0.005, idleTime * 0.5) * Math.PI * 2;
            p.vx += Math.cos(angle) * intensity * 2 * mouseFade;
            p.vy += Math.sin(angle) * intensity * 2 * mouseFade;
            break;
          }
          case "wave":
            if (!isMouseActive) {
              const waveOffset = p.originX * 0.02 + idleTime * 2;
              p.vy += Math.sin(waveOffset) * intensity * 0.5;
              p.vx += Math.cos(waveOffset * 0.7) * intensity * 0.3;
            }
            break;
          case "pulse":
            if (!isMouseActive) {
              const centerX = width / 2, centerY = height / 2;
              const dx = p.originX - centerX, dy = p.originY - centerY;
              const dist = Math.sqrt(dx * dx + dy * dy) || 1;
              const pulse = Math.sin(idleTime * 3) * intensity * 0.5;
              p.vx += (dx / dist) * pulse;
              p.vy += (dy / dist) * pulse;
            }
            break;
        }
      }
` : ''}
${physicsCode}

      p.vx += (p.originX - p.x) * returnSpeed;
      p.vy += (p.originY - p.y) * returnSpeed;
      p.vx *= friction;
      p.vy *= friction;
      p.x += p.vx;
      p.y += p.vy;
    }

    // Trails: use semi-transparent fill instead of clear
    ${config.enableTrails ? `// Parse hex color to RGB for trails
    const hexToRgb = (hex: string) => {
      const result = /^#?([a-f\\d]{2})([a-f\\d]{2})([a-f\\d]{2})$/i.exec(hex);
      return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
      } : { r: 255, g: 255, b: 255 };
    };
    const bgColor = hexToRgb(CONFIG.trailBackgroundColor);
    ctx.fillStyle = \`rgba(\${bgColor.r}, \${bgColor.g}, \${bgColor.b}, \${CONFIG.trailLength})\`;
    ctx.fillRect(0, 0, width, height);` : `ctx.clearRect(0, 0, width, height);`}

    // Render mode
    ${useSquaresCode}
${config.enableConnections ? `
    // Draw connections between nearby particles
    const connDistSq = CONFIG.connectionDistance * CONFIG.connectionDistance;
    const connHex = (hex: string) => {
      const result = /^#?([a-f\\d]{2})([a-f\\d]{2})([a-f\\d]{2})$/i.exec(hex);
      return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
      } : { r: 255, g: 255, b: 255 };
    };
    const connColor = connHex(CONFIG.connectionColor);
    ctx.strokeStyle = \`rgba(\${connColor.r}, \${connColor.g}, \${connColor.b}, \${CONFIG.connectionOpacity})\`;
    ctx.lineWidth = 0.5;
    ctx.beginPath();

    const activeParticles = particlesRef.current.slice(0, particlesActivatedRef.current);
    for (let i = 0; i < activeParticles.length; i++) {
      const p1 = activeParticles[i];
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
` : ''}
    // Group particles by color for batched drawing
    const colorGroups: Map<string, Particle[]> = new Map();
    const maskedColorGroups: Map<string, Particle[]> = new Map();

    for (let i = 0; i < particlesActivatedRef.current; i++) {
      const p = particlesRef.current[i];
      ${config.enableVelocityColor ? `// Calculate display color with velocity shift
      const velocity = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
      const displayColor = shiftColorByVelocity(p.color, velocity, CONFIG.velocityColorIntensity, CONFIG.velocityColorMode, CONFIG.velocityColorTarget, p);` : 'const displayColor = p.color;'}
      const targetMap = p.masked ? maskedColorGroups : colorGroups;
      if (!targetMap.has(displayColor)) targetMap.set(displayColor, []);
      targetMap.get(displayColor)!.push(p);
    }

    // Helper to draw a single particle shape
    const drawShape = (x: number, y: number, size: number) => {
      ${shapeDrawCode}
    };

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
    // Use alpha: false for better performance and to prevent flickering on Safari/iOS
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    // Set canvas size to match image dimensions
    const dpr = window.devicePixelRatio || 1;
    canvas.width = IMG_WIDTH * dpr;
    canvas.height = IMG_HEIGHT * dpr;
    ctx.scale(dpr, dpr);

    // Fill with background color initially
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, IMG_WIDTH, IMG_HEIGHT);

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

