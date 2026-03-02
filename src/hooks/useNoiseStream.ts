import { useCallback, useEffect, useRef, useState } from "react";

import type { NoiseStreamSnapshot } from "../services/noise/noiseStreamService";
import {
  getNoiseStreamSnapshot,
  restartNoiseStream,
  subscribeNoiseStream,
} from "../services/noise/noiseStreamService";
import { getAppSettings } from "../utils/appSettings";

/**
 * 订阅环境噪音数据流的 Hook
 * @returns 包含噪音快照数据和重试函数的对象
 */
export function useNoiseStream(): NoiseStreamSnapshot & { retry: () => void } {
  const [snap, setSnap] = useState<NoiseStreamSnapshot>(() => getNoiseStreamSnapshot());
  const lastUpdateRef = useRef<number>(0);

  useEffect(() => {
    let mounted = true;
    const update = () => {
      if (!mounted) return;

      const now = Date.now();
      const isEcoMode = getAppSettings().general.ecoMode ?? true;
      const throttleMs = isEcoMode ? 500 : 0;

      if (now - lastUpdateRef.current >= throttleMs) {
        lastUpdateRef.current = now;
        setSnap(getNoiseStreamSnapshot());
      }
    };
    const unsubscribe = subscribeNoiseStream(update);

    // Force immediate first update
    lastUpdateRef.current = Date.now();
    setSnap(getNoiseStreamSnapshot());

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const retry = useCallback(() => {
    void restartNoiseStream();
  }, []);

  return { ...snap, retry };
}
