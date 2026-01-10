export type ShootingDirection = "top-to-bottom" | "all-directions";
export type MouseInteractionMode = "push" | "pull" | "orbit" | "turbulence";

// Optional mask for custom particle grouping
export interface OptionalMask {
  id: string;           // Unique ID
  slug: string;         // URL-friendly name for code export (e.g., "foreground", "logo")
  name: string;         // Display name
  color: string;        // Color for visualization in editor
  data: Uint8ClampedArray | null; // Mask pixel data (null if not yet painted)
}

// Manual particle edit (add/delete/modify)
export interface ParticleEdit {
  id: string;
  type: "add" | "delete" | "modify";
  x: number;
  y: number;
  color?: string;       // For add/modify
  size?: number;        // For add/modify
  radius?: number;      // Radius of effect (for delete/modify area)
  optionalMasks?: string[]; // Mask slugs this particle belongs to
}

export interface ParticleConfig {
  resolution: number;         // Pixels per dot (1-20)
  particleSize: number;       // Base particle size (1-10)
  minParticleSize: number;    // Minimum particle size (0.5-5)
  sizeVariation: number;      // Random size variation (0-5)
  friction: number;           // Movement friction (0.8-0.99)
  returnSpeed: number;        // Speed of return to origin (0.01-0.2)
  mouseRadius: number;        // Mouse interaction radius (20-200)
  mouseForce: number;         // Mouse push force (5-30)
  mouseInteractionMode: MouseInteractionMode; // Type of mouse interaction
  orbitSpeed: number;         // Speed of orbital rotation (0.5-3)
  turbulenceIntensity: number; // Intensity of turbulence effect (0.5-3)
  useOriginalColors: boolean; // Use colors from image
  customColors: string[];     // Custom color palette
  alphaThreshold: number;     // Min alpha to include pixel (0-255)
  colorClustering: boolean;   // Enable color clustering/quantization
  clusterCount: number;       // Number of color clusters (2-32)
  maxParticles: number;       // Max particles limit (1000-50000)
  enableInitialAnimation: boolean; // Enable sequential shooting animation
  particlesPerSecond: number; // How many particles shoot out per second (100-10000)
  shootingDirection: ShootingDirection; // Direction particles shoot out
  particleSpeed: number;      // Speed multiplier for particles moving to position (0.5-3)
  enableBounce: boolean;      // Add bounce/overshoot effect to particles
  bounceIntensity: number;    // How much particles overshoot (0.5-2)
  bounceDamping: number;      // How quickly bounce settles (0.7-0.95)
  mouseInteractionDuringAnimation: boolean; // Allow mouse interaction during initial animation
}

export interface ImageData {
  width: number;
  height: number;
  pixels: Uint8ClampedArray;
  dataUrl: string;
  fileName: string;
  originalWidth: number;  // Original image dimensions before scaling
  originalHeight: number;
  canvasScale: number;    // Scale factor applied to canvas
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
  masked?: boolean;           // Whether this particle is masked (won't interact with mouse)
  optionalMasks?: string[];   // Slugs of optional masks this particle belongs to
}

export interface ParticleData {
  x: number;
  y: number;
  color: string;
  masked?: boolean;
  optionalMasks?: string[];   // Slugs of optional masks this particle belongs to
}

