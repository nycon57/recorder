/**
 * useAdaptiveLOD - Adaptive Level of Detail hook
 *
 * Automatically adjusts rendering quality based on:
 * - Node count (more nodes = lower detail)
 * - Real-time FPS (poor performance = lower detail)
 * - Device capabilities
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import type { LODLevel, LODConfig, DeviceCapabilities } from '../types';
import { LOD_CONFIGS } from '../types';

interface UseAdaptiveLODOptions {
  nodeCount: number;
  targetFPS?: number;           // Minimum acceptable FPS (default: 30)
  adaptationSpeed?: number;     // How quickly to adapt (0-1, default: 0.1)
  manualOverride?: LODLevel;    // Force specific LOD level
}

interface UseAdaptiveLODResult {
  lodLevel: LODLevel;
  lodConfig: LODConfig;
  currentFPS: number;
  isAdapting: boolean;
}

/**
 * Detect device GPU capabilities
 */
function detectDeviceCapabilities(): DeviceCapabilities {
  if (typeof window === 'undefined') {
    return {
      webgl2: false,
      webgl1: false,
      maxTextureSize: 0,
      gpuTier: 'unknown',
      recommendedLOD: 'medium',
    };
  }

  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');

    if (!gl) {
      return {
        webgl2: false,
        webgl1: false,
        maxTextureSize: 0,
        gpuTier: 'unknown',
        recommendedLOD: 'low',
      };
    }

    const webgl2 = !!canvas.getContext('webgl2');
    const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);

    let gpuTier: 'high' | 'medium' | 'low' | 'unknown' = 'medium';
    let recommendedLOD: LODLevel = 'medium';

    // Try to detect GPU tier from renderer string
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    if (debugInfo) {
      const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);

      // High-end discrete GPUs
      if (/NVIDIA|Radeon RX|GeForce RTX|GeForce GTX 10|GeForce GTX 16|GeForce GTX 20/i.test(renderer)) {
        gpuTier = 'high';
        recommendedLOD = 'ultra';
      }
      // Mid-range GPUs and good integrated
      else if (/Intel (Iris|UHD|HD 6)/i.test(renderer) || /Radeon|GeForce/i.test(renderer)) {
        gpuTier = 'medium';
        recommendedLOD = 'high';
      }
      // Low-end or software rendering
      else if (/SwiftShader|llvmpipe|Software|Mali|Adreno 3|Intel HD 4/i.test(renderer)) {
        gpuTier = 'low';
        recommendedLOD = 'low';
      }
    }

    return {
      webgl2,
      webgl1: true,
      maxTextureSize,
      gpuTier,
      recommendedLOD,
    };
  } catch {
    return {
      webgl2: false,
      webgl1: false,
      maxTextureSize: 0,
      gpuTier: 'unknown',
      recommendedLOD: 'low',
    };
  }
}

/**
 * Calculate LOD level based on node count
 */
function getLODFromNodeCount(nodeCount: number): LODLevel {
  if (nodeCount < 100) return 'ultra';
  if (nodeCount < 300) return 'high';
  if (nodeCount < 700) return 'medium';
  if (nodeCount < 2000) return 'low';
  return 'minimal';
}

/**
 * Calculate LOD level based on FPS
 */
function getLODFromFPS(fps: number): LODLevel {
  if (fps >= 55) return 'ultra';
  if (fps >= 45) return 'high';
  if (fps >= 35) return 'medium';
  if (fps >= 25) return 'low';
  return 'minimal';
}

/**
 * LOD level ordering for comparison
 */
const LOD_ORDER: LODLevel[] = ['minimal', 'low', 'medium', 'high', 'ultra'];

function getLODIndex(level: LODLevel): number {
  return LOD_ORDER.indexOf(level);
}

function minLOD(a: LODLevel, b: LODLevel): LODLevel {
  return getLODIndex(a) <= getLODIndex(b) ? a : b;
}

/**
 * Main adaptive LOD hook
 */
export function useAdaptiveLOD(options: UseAdaptiveLODOptions): UseAdaptiveLODResult {
  const {
    nodeCount,
    targetFPS = 30,
    adaptationSpeed = 0.1,
    manualOverride,
  } = options;

  const [lodLevel, setLodLevel] = useState<LODLevel>('medium');
  const [currentFPS, setCurrentFPS] = useState(60);
  const [isAdapting, setIsAdapting] = useState(false);

  const frameCount = useRef(0);
  const lastTime = useRef(performance.now());
  const lowFPSStreak = useRef(0);
  const deviceCapabilities = useRef<DeviceCapabilities | null>(null);

  // Detect device capabilities on mount
  useEffect(() => {
    deviceCapabilities.current = detectDeviceCapabilities();

    // Set initial LOD based on device and node count
    const deviceLOD = deviceCapabilities.current.recommendedLOD;
    const countLOD = getLODFromNodeCount(nodeCount);
    const initialLOD = minLOD(deviceLOD, countLOD);

    setLodLevel(manualOverride ?? initialLOD);
  }, [manualOverride, nodeCount]);

  // FPS measurement and adaptive LOD (using useFrame for R3F integration)
  useFrame(() => {
    frameCount.current++;
    const now = performance.now();
    const elapsed = now - lastTime.current;

    // Update FPS every second
    if (elapsed >= 1000) {
      const fps = Math.round((frameCount.current * 1000) / elapsed);
      setCurrentFPS(fps);
      frameCount.current = 0;
      lastTime.current = now;

      // Skip adaptation if manual override is set
      if (manualOverride) return;

      // Adapt LOD based on FPS
      const countLOD = getLODFromNodeCount(nodeCount);
      const fpsLOD = getLODFromFPS(fps);
      const targetLOD = minLOD(countLOD, fpsLOD);

      // Track low FPS streaks for more aggressive adaptation
      if (fps < targetFPS) {
        lowFPSStreak.current++;
        setIsAdapting(true);

        // After 3 seconds of low FPS, force lower LOD
        if (lowFPSStreak.current >= 3) {
          const currentIndex = getLODIndex(lodLevel);
          if (currentIndex > 0) {
            setLodLevel(LOD_ORDER[currentIndex - 1]);
          }
          lowFPSStreak.current = 0;
        }
      } else {
        lowFPSStreak.current = 0;
        setIsAdapting(false);

        // Gradually increase LOD if performance is good
        if (fps > 50) {
          const currentIndex = getLODIndex(lodLevel);
          const targetIndex = getLODIndex(targetLOD);
          if (currentIndex < targetIndex) {
            setLodLevel(LOD_ORDER[Math.min(currentIndex + 1, targetIndex)]);
          }
        }
      }
    }
  });

  return {
    lodLevel: manualOverride ?? lodLevel,
    lodConfig: LOD_CONFIGS[manualOverride ?? lodLevel],
    currentFPS,
    isAdapting,
  };
}

/**
 * Standalone hook for device capability detection (use outside R3F)
 */
export function useDeviceCapabilities(): DeviceCapabilities {
  const [capabilities, setCapabilities] = useState<DeviceCapabilities>({
    webgl2: false,
    webgl1: false,
    maxTextureSize: 0,
    gpuTier: 'unknown',
    recommendedLOD: 'medium',
  });

  useEffect(() => {
    setCapabilities(detectDeviceCapabilities());
  }, []);

  return capabilities;
}

export default useAdaptiveLOD;
