"use client";

import { useEffect, useRef, useCallback, useMemo } from "react";
import { ImageData, ParticleConfig, Particle } from "@/types";
import { extractParticleData } from "@/utils/particleUtils";

interface ParticlePreviewProps {
  imageData: ImageData | null;
  config: ParticleConfig;
}

export default function ParticlePreview({ imageData, config }: ParticlePreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const mouseRef = useRef({ x: -1000, y: -1000 });
  const animationRef = useRef<number>(0);

  // Extract particle data from image
  const particleData = useMemo(() => {
    if (!imageData) return [];
    return extractParticleData(imageData, config);
  }, [imageData, config]);

  // Initialize particles
  const initParticles = useCallback((canvas: HTMLCanvasElement) => {
    if (!particleData.length) return;

    const rect = canvas.getBoundingClientRect();
    const cssWidth = rect.width;
    const cssHeight = rect.height;

    // Calculate scale to fit image in canvas while maintaining aspect ratio
    const imgAspect = imageData!.width / imageData!.height;
    const canvasAspect = cssWidth / cssHeight;
    
    let scale: number;
    let offsetX: number;
    let offsetY: number;

    if (imgAspect > canvasAspect) {
      // Image is wider - fit to width
      scale = (cssWidth * 0.8) / imageData!.width;
      offsetX = cssWidth * 0.1;
      offsetY = (cssHeight - imageData!.height * scale) / 2;
    } else {
      // Image is taller - fit to height
      scale = (cssHeight * 0.8) / imageData!.height;
      offsetX = (cssWidth - imageData!.width * scale) / 2;
      offsetY = cssHeight * 0.1;
    }

    particlesRef.current = particleData.map(p => ({
      x: offsetX + p.x * scale,
      y: offsetY + p.y * scale,
      originX: offsetX + p.x * scale,
      originY: offsetY + p.y * scale,
      vx: 0,
      vy: 0,
      size: config.particleSize + Math.random() * config.sizeVariation,
      color: p.color,
      alpha: 0.7 + Math.random() * 0.3,
    }));
  }, [particleData, config.particleSize, config.sizeVariation, imageData]);

  // Animation loop
  const animate = useCallback((ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
    const mouse = mouseRef.current;
    const mouseRadiusSq = config.mouseRadius * config.mouseRadius;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Group particles by color for batched drawing
    const colorGroups: Map<string, Particle[]> = new Map();

    for (const p of particlesRef.current) {
      const dx = mouse.x - p.x;
      const dy = mouse.y - p.y;
      const distSq = dx * dx + dy * dy;

      if (distSq < mouseRadiusSq && distSq > 0) {
        const dist = Math.sqrt(distSq);
        const force = (config.mouseRadius - dist) / config.mouseRadius;
        const angle = Math.atan2(dy, dx);
        p.vx -= Math.cos(angle) * force * config.mouseForce;
        p.vy -= Math.sin(angle) * force * config.mouseForce;
      }

      p.vx += (p.originX - p.x) * config.returnSpeed;
      p.vy += (p.originY - p.y) * config.returnSpeed;
      p.vx *= config.friction;
      p.vy *= config.friction;
      p.x += p.vx;
      p.y += p.vy;

      if (!colorGroups.has(p.color)) {
        colorGroups.set(p.color, []);
      }
      colorGroups.get(p.color)!.push(p);
    }

    // Batch draw by color
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
  }, [config]);

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

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
      <div className="p-3 border-b border-gray-800 flex items-center justify-between">
        <span className="text-sm text-gray-400">
          {particlesRef.current.length.toLocaleString()} particles
        </span>
        <span className="text-xs text-gray-500">Move mouse to interact</span>
      </div>
      <canvas
        ref={canvasRef}
        className="w-full h-[500px] cursor-crosshair"
        style={{ touchAction: "none" }}
      />
    </div>
  );
}

