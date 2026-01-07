export interface ParticleConfig {
  resolution: number;         // Pixels per dot (1-20)
  particleSize: number;       // Base particle size (1-10)
  sizeVariation: number;      // Random size variation (0-5)
  friction: number;           // Movement friction (0.8-0.99)
  returnSpeed: number;        // Speed of return to origin (0.01-0.2)
  mouseRadius: number;        // Mouse interaction radius (20-200)
  mouseForce: number;         // Mouse push force (5-30)
  useOriginalColors: boolean; // Use colors from image
  customColors: string[];     // Custom color palette
  alphaThreshold: number;     // Min alpha to include pixel (0-255)
  colorClustering: boolean;   // Enable color clustering/quantization
  clusterCount: number;       // Number of color clusters (2-32)
  maxParticles: number;       // Max particles limit (1000-50000)
}

export interface ImageData {
  width: number;
  height: number;
  pixels: Uint8ClampedArray;
  dataUrl: string;
  fileName: string;
}

export interface Particle {
  x: number;
  y: number;
  originX: number;
  originY: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
}

export interface ParticleData {
  x: number;
  y: number;
  color: string;
}

