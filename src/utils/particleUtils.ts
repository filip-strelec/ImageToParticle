import { ImageData, ParticleConfig, ParticleData, OptionalMask, ParticleEdit, ColorFilter } from "@/types";

/**
 * Apply color filter to RGB values
 */
export function applyColorFilter(r: number, g: number, b: number, filter: ColorFilter): [number, number, number] {
  switch (filter) {
    case "grayscale": {
      const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
      return [gray, gray, gray];
    }
    case "sepia": {
      return [
        Math.min(255, Math.round(0.393 * r + 0.769 * g + 0.189 * b)),
        Math.min(255, Math.round(0.349 * r + 0.686 * g + 0.168 * b)),
        Math.min(255, Math.round(0.272 * r + 0.534 * g + 0.131 * b)),
      ];
    }
    case "inverted":
      return [255 - r, 255 - g, 255 - b];
    case "saturated": {
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      const factor = 1.5;
      return [
        Math.min(255, Math.max(0, Math.round(gray + factor * (r - gray)))),
        Math.min(255, Math.max(0, Math.round(gray + factor * (g - gray)))),
        Math.min(255, Math.max(0, Math.round(gray + factor * (b - gray)))),
      ];
    }
    case "desaturated": {
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      const factor = 0.5;
      return [
        Math.round(gray + factor * (r - gray)),
        Math.round(gray + factor * (g - gray)),
        Math.round(gray + factor * (b - gray)),
      ];
    }
    case "warm":
      return [
        Math.min(255, r + 20),
        g,
        Math.max(0, b - 20),
      ];
    case "cool":
      return [
        Math.max(0, r - 20),
        g,
        Math.min(255, b + 20),
      ];
    case "vintage": {
      // Sepia + slight desaturation + warm tones
      const sepia: [number, number, number] = [
        Math.min(255, Math.round(0.393 * r + 0.769 * g + 0.189 * b)),
        Math.min(255, Math.round(0.349 * r + 0.686 * g + 0.168 * b)),
        Math.min(255, Math.round(0.272 * r + 0.534 * g + 0.131 * b)),
      ];
      return [
        Math.min(255, sepia[0] + 10),
        sepia[1],
        Math.max(0, sepia[2] - 15),
      ];
    }
    case "none":
    default:
      return [r, g, b];
  }
}

/**
 * Extract particle data from image pixels
 */
export function extractParticleData(
  imageData: ImageData,
  config: ParticleConfig,
  maskData?: Uint8ClampedArray,
  optionalMasks?: OptionalMask[],
  particleEdits?: ParticleEdit[]
): ParticleData[] {
  const { width, height, pixels } = imageData;
  const { resolution, alphaThreshold, maxParticles, useOriginalColors, customColors, colorClustering, clusterCount, colorFilter } = config;

  // If clustering is enabled, first quantize the image colors
  let palette: string[] | null = null;
  if (useOriginalColors && colorClustering) {
    palette = quantizeColors(imageData, clusterCount);
  }

  const particles: ParticleData[] = [];
  const gap = Math.max(1, resolution);

  // Offset by half gap so particles aren't cropped at edges
  const halfGap = Math.floor(gap / 2);

  // Create a set of delete zones for efficient checking
  const deleteEdits = particleEdits?.filter(e => e.type === "delete") || [];

  // First pass: collect all potential particles from image
  const potentialParticles: ParticleData[] = [];

  for (let y = halfGap; y < height - halfGap; y += gap) {
    for (let x = halfGap; x < width - halfGap; x += gap) {
      const index = (y * width + x) * 4;
      const r = pixels[index];
      const g = pixels[index + 1];
      const b = pixels[index + 2];
      const a = pixels[index + 3];

      // Skip transparent pixels
      if (a < alphaThreshold) continue;

      // Check if this pixel falls within a delete zone
      let isDeleted = false;
      for (const edit of deleteEdits) {
        const dx = x - edit.x;
        const dy = y - edit.y;
        const radius = edit.radius || 15;
        if (dx * dx + dy * dy < radius * radius) {
          isDeleted = true;
          break;
        }
      }
      if (isDeleted) continue;

      // Check if this pixel is masked (main interaction mask)
      const isMasked = maskData ? maskData[index] < 128 : false;

      // Check which optional masks this pixel belongs to
      const particleMasks: string[] = [];
      if (optionalMasks) {
        for (const mask of optionalMasks) {
          if (mask.data && mask.data[index] < 128) {
            particleMasks.push(mask.slug);
          }
        }
      }

      // Apply color filter
      const [fr, fg, fb] = applyColorFilter(r, g, b, colorFilter);

      // Determine color
      let color: string;
      if (useOriginalColors) {
        if (palette) {
          // Find nearest color in palette
          color = findNearestColor([fr, fg, fb], palette);
        } else {
          color = `rgb(${fr},${fg},${fb})`;
        }
      } else {
        color = customColors[Math.floor(Math.random() * customColors.length)];
      }

      potentialParticles.push({
        x,
        y,
        color,
        masked: isMasked,
        optionalMasks: particleMasks.length > 0 ? particleMasks : undefined,
      });
    }
  }

  // Add manually added particles (also check against delete zones)
  const addEdits = particleEdits?.filter(e => e.type === "add") || [];
  for (const edit of addEdits) {
    // Check if this added particle falls within a delete zone
    let isDeleted = false;
    for (const deleteEdit of deleteEdits) {
      const dx = edit.x - deleteEdit.x;
      const dy = edit.y - deleteEdit.y;
      const radius = deleteEdit.radius || 15;
      if (dx * dx + dy * dy < radius * radius) {
        isDeleted = true;
        break;
      }
    }
    if (isDeleted) continue;

    potentialParticles.push({
      x: edit.x,
      y: edit.y,
      color: edit.color || "#ffffff",
      masked: false,
      optionalMasks: edit.optionalMasks,
    });
  }

  // If we have more particles than the limit, sample evenly across the image
  if (potentialParticles.length > maxParticles) {
    const step = potentialParticles.length / maxParticles;
    for (let i = 0; i < maxParticles; i++) {
      const index = Math.floor(i * step);
      particles.push(potentialParticles[index]);
    }
  } else {
    return potentialParticles;
  }

  return particles;
}

/**
 * Find the nearest color in a palette
 */
function findNearestColor(rgb: [number, number, number], palette: string[]): string {
  let minDist = Infinity;
  let nearest = palette[0];

  for (const color of palette) {
    const parsed = parseColor(color);
    const dist = colorDistance(rgb, parsed);
    if (dist < minDist) {
      minDist = dist;
      nearest = color;
    }
  }

  return nearest;
}

/**
 * Quantize colors using k-means clustering
 */
export function quantizeColors(
  imageData: ImageData,
  clusterCount: number
): string[] {
  const { pixels } = imageData;
  const colors: [number, number, number][] = [];

  // Sample colors from image
  for (let i = 0; i < pixels.length; i += 4 * 10) {
    if (pixels[i + 3] > 128) {
      colors.push([pixels[i], pixels[i + 1], pixels[i + 2]]);
    }
  }

  if (colors.length === 0) return ["#ffffff"];

  // Simple k-means clustering
  let centroids = colors.slice(0, clusterCount);
  
  for (let iter = 0; iter < 10; iter++) {
    const clusters: [number, number, number][][] = Array.from({ length: clusterCount }, () => []);
    
    for (const color of colors) {
      let minDist = Infinity;
      let closestIdx = 0;
      for (let i = 0; i < centroids.length; i++) {
        const dist = colorDistance(color, centroids[i]);
        if (dist < minDist) {
          minDist = dist;
          closestIdx = i;
        }
      }
      clusters[closestIdx].push(color);
    }

    // Update centroids
    centroids = clusters.map((cluster, i) => {
      if (cluster.length === 0) return centroids[i];
      const avg: [number, number, number] = [0, 0, 0];
      for (const c of cluster) {
        avg[0] += c[0];
        avg[1] += c[1];
        avg[2] += c[2];
      }
      return [
        Math.round(avg[0] / cluster.length),
        Math.round(avg[1] / cluster.length),
        Math.round(avg[2] / cluster.length),
      ] as [number, number, number];
    });
  }

  return centroids.map(c => `rgb(${c[0]},${c[1]},${c[2]})`);
}

function colorDistance(c1: [number, number, number], c2: [number, number, number]): number {
  return Math.sqrt(
    (c1[0] - c2[0]) ** 2 +
    (c1[1] - c2[1]) ** 2 +
    (c1[2] - c2[2]) ** 2
  );
}

/**
 * Convert RGB to hex
 */
export function rgbToHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map(x => x.toString(16).padStart(2, "0")).join("");
}

/**
 * Parse color string to RGB array
 */
export function parseColor(color: string): [number, number, number] {
  if (color.startsWith("#")) {
    const hex = color.slice(1);
    return [
      parseInt(hex.slice(0, 2), 16),
      parseInt(hex.slice(2, 4), 16),
      parseInt(hex.slice(4, 6), 16),
    ];
  }
  const match = color.match(/\d+/g);
  if (match) {
    return [parseInt(match[0]), parseInt(match[1]), parseInt(match[2])];
  }
  return [255, 255, 255];
}

