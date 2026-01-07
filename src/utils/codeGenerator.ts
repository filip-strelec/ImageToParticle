import { ParticleConfig, ParticleData, ImageData } from "@/types";

export function generateComponentCode(
  particles: ParticleData[],
  config: ParticleConfig,
  imageData: ImageData,
  mode: "inline" | "separate"
): string {
  const dataImport = mode === "separate" 
    ? `import { PARTICLE_DATA } from "./particleData";\n` 
    : "";

  const dataConst = mode === "inline"
    ? `\n// Particle positions and colors extracted from image\nconst PARTICLE_DATA: ParticleData[] = [\n${
        particles.map(p => {
          const obj = `{x:${Math.round(p.x)},y:${Math.round(p.y)},c:"${p.color}"${p.masked ? ',m:true' : ''}}`;
          return `  ${obj}`;
        }).join(',\n')
      }\n];\n`
    : "";

  return `"use client";

import { useEffect, useRef, useCallback } from "react";
${dataImport}
interface ParticleData {
  x: number;
  y: number;
  c: string; // color
  m?: boolean; // masked (won't interact with mouse)
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
  masked?: boolean;
}

interface ParticleAnimationProps {
  className?: string;
  friction?: number;
  returnSpeed?: number;
  mouseRadius?: number;
  mouseForce?: number;
}
${dataConst}
// Original image dimensions: ${imageData.width}x${imageData.height}
const IMG_WIDTH = ${imageData.width};
const IMG_HEIGHT = ${imageData.height};

export default function ParticleAnimation({
  className = "",
  friction = ${config.friction},
  returnSpeed = ${config.returnSpeed},
  mouseRadius = ${config.mouseRadius},
  mouseForce = ${config.mouseForce},
}: ParticleAnimationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const mouseRef = useRef({ x: -1000, y: -1000 });
  const animationRef = useRef<number>(0);
  const configRef = useRef({ friction, returnSpeed, mouseRadius, mouseForce });

  // Update config ref when props change
  useEffect(() => {
    configRef.current = { friction, returnSpeed, mouseRadius, mouseForce };
  }, [friction, returnSpeed, mouseRadius, mouseForce]);

  const initParticles = useCallback((canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const cssWidth = rect.width;
    const cssHeight = rect.height;

    // Calculate scale to fit image in canvas
    const imgAspect = IMG_WIDTH / IMG_HEIGHT;
    const canvasAspect = cssWidth / cssHeight;
    
    let scale: number, offsetX: number, offsetY: number;

    if (imgAspect > canvasAspect) {
      scale = (cssWidth * 0.9) / IMG_WIDTH;
      offsetX = cssWidth * 0.05;
      offsetY = (cssHeight - IMG_HEIGHT * scale) / 2;
    } else {
      scale = (cssHeight * 0.9) / IMG_HEIGHT;
      offsetX = (cssWidth - IMG_WIDTH * scale) / 2;
      offsetY = cssHeight * 0.05;
    }

    particlesRef.current = PARTICLE_DATA.map(p => ({
      x: offsetX + p.x * scale,
      y: offsetY + p.y * scale,
      originX: offsetX + p.x * scale,
      originY: offsetY + p.y * scale,
      vx: 0,
      vy: 0,
      size: Math.max(${config.minParticleSize}, ${config.particleSize} + Math.random() * ${config.sizeVariation}),
      color: p.c,
      masked: p.m,
    }));
  }, []);

  const animate = useCallback((ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
    const { friction, returnSpeed, mouseRadius, mouseForce } = configRef.current;
    const mouse = mouseRef.current;
    const mouseRadiusSq = mouseRadius * mouseRadius;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const colorGroups: Map<string, Particle[]> = new Map();

    for (const p of particlesRef.current) {
      // Only apply mouse interaction if particle is not masked
      if (!p.masked) {
        const dx = mouse.x - p.x;
        const dy = mouse.y - p.y;
        const distSq = dx * dx + dy * dy;

        if (distSq < mouseRadiusSq && distSq > 0) {
          const dist = Math.sqrt(distSq);
          const force = (mouseRadius - dist) / mouseRadius;
          const angle = Math.atan2(dy, dx);
          p.vx -= Math.cos(angle) * force * mouseForce;
          p.vy -= Math.sin(angle) * force * mouseForce;
        }
      }

      p.vx += (p.originX - p.x) * returnSpeed;
      p.vy += (p.originY - p.y) * returnSpeed;
      p.vx *= friction;
      p.vy *= friction;
      p.x += p.vx;
      p.y += p.vy;

      if (!colorGroups.has(p.color)) colorGroups.set(p.color, []);
      colorGroups.get(p.color)!.push(p);
    }

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
    ctx.globalAlpha = 1;

    animationRef.current = requestAnimationFrame(() => animate(ctx, canvas));
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const handleResize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      initParticles(canvas);
    };

    const getCoords = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      return { x: clientX - rect.left, y: clientY - rect.top };
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

    handleResize();
    window.addEventListener("resize", handleResize);
    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mouseleave", handleMouseLeave);
    canvas.addEventListener("touchmove", handleTouchMove);

    animationRef.current = requestAnimationFrame(() => animate(ctx, canvas));

    return () => {
      window.removeEventListener("resize", handleResize);
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("mouseleave", handleMouseLeave);
      canvas.removeEventListener("touchmove", handleTouchMove);
      cancelAnimationFrame(animationRef.current);
    };
  }, [initParticles, animate]);

  return (
    <canvas
      ref={canvasRef}
      className={\`w-full h-full \${className}\`}
      style={{ touchAction: "none" }}
    />
  );
}
`;
}

export function generateParticleDataCode(particles: ParticleData[]): string {
  const data = particles.map(p => ({
    x: Math.round(p.x),
    y: Math.round(p.y),
    c: p.color,
    ...(p.masked ? { m: true } : {})
  }));

  return `// Auto-generated particle data
// Particles: ${data.length}

export interface ParticleData {
  x: number;
  y: number;
  c: string;
  m?: boolean;
}

export const PARTICLE_DATA: ParticleData[] = [
${data.map(p => `  {x:${Math.round(p.x)},y:${Math.round(p.y)},c:"${p.c}"${p.m ? ',m:true' : ''}}`).join(',\n')}
];
`;
}

