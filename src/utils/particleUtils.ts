import { ImageData, ParticleConfig, ParticleData } from "@/types";

/**
 * Extract particle data from image pixels
 */
export function extractParticleData(
  imageData: ImageData,
  config: ParticleConfig
): ParticleData[] {
  const { width, height, pixels } = imageData;
  const { resolution, alphaThreshold, maxParticles, useOriginalColors, customColors, colorClustering, clusterCount } = config;

  // If clustering is enabled, first quantize the image colors
  let palette: string[] | null = null;
  if (useOriginalColors && colorClustering) {
    palette = quantizeColors(imageData, clusterCount);
  }

  const particles: ParticleData[] = [];
  const gap = Math.max(1, resolution);

  for (let y = 0; y < height; y += gap) {
    for (let x = 0; x < width; x += gap) {
      const index = (y * width + x) * 4;
      const r = pixels[index];
      const g = pixels[index + 1];
      const b = pixels[index + 2];
      const a = pixels[index + 3];

      // Skip transparent pixels
      if (a < alphaThreshold) continue;

      // Determine color
      let color: string;
      if (useOriginalColors) {
        if (palette) {
          // Find nearest color in palette
          color = findNearestColor([r, g, b], palette);
        } else {
          color = `rgb(${r},${g},${b})`;
        }
      } else {
        color = customColors[Math.floor(Math.random() * customColors.length)];
      }

      particles.push({ x, y, color });

      // Early exit if we hit max particles
      if (particles.length >= maxParticles) {
        return particles;
      }
    }
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

