import React, { useCallback, useEffect, useRef, useState } from "react";

import { STOPWATCH_TICK_MS } from "../../constants/timer";
import { useAppState, useAppDispatch } from "../../contexts/AppContext";
import { useAccumulatingTimer } from "../../hooks/useTimer";
import { formatStopwatch } from "../../utils/formatTime";

import styles from "./Stopwatch.module.css";

/**
 * 秒表组件
 * 显示秒表时间，支持启动、暂停、重置功能
 * 使用高频计时器，并利用局部状态拦截高频更新，避免全局频繁渲染
 */
export function Stopwatch() {
  const { stopwatch } = useAppState();
  const dispatch = useAppDispatch();

  // 1. 使用局部状态接管高频的渲染，初始值为全局的 elapsedTime
  const [localElapsedTime, setLocalElapsedTime] = useState(stopwatch.elapsedTime);

  // 2. 累积还未同步至全局的 tick 计数
  const unsyncedCountRef = useRef(0);

  // 处理全局重置的操作，当外部将其归零时重置本地状态和计数
  useEffect(() => {
    if (stopwatch.elapsedTime === 0) {
      setLocalElapsedTime(0);
      unsyncedCountRef.current = 0;
    }
  }, [stopwatch.elapsedTime]);

  // 抽离同步回全局的方法
  const syncToGlobal = useCallback(() => {
    if (unsyncedCountRef.current > 0) {
      dispatch({ type: "TICK_STOPWATCH_BY", payload: unsyncedCountRef.current });
      unsyncedCountRef.current = 0;
    }
  }, [dispatch]);

  // 组件暂停时，将累积的跳动次数同步回全局状态
  useEffect(() => {
    if (!stopwatch.isActive) {
      syncToGlobal();
    }
  }, [stopwatch.isActive, syncToGlobal]);

  // 组件被卸载时（例如切换到另一个时钟模式），同步回全局状态
  useEffect(() => {
    return () => {
      syncToGlobal();
    };
  }, [syncToGlobal]);

  /**
   * 秒表递增处理函数
   */
  const handleTick = useCallback((count: number) => {
    // 累加局部状态以更新 UI
    setLocalElapsedTime((prev) => prev + count * STOPWATCH_TICK_MS);
    // 记录本次累加但未向全局下发的计数
    unsyncedCountRef.current += count;
  }, []);

  // 使用累积计时器：按10ms间隔计算应触发次数，仅仅修改局部状态
  useAccumulatingTimer(handleTick, stopwatch.isActive, STOPWATCH_TICK_MS);

  // 基于 localElapsedTime 而不是 stopwatch.elapsedTime 渲染
  const timeString = formatStopwatch(localElapsedTime);
  const totalSeconds = Math.floor(localElapsedTime / 1000);
  const isLongDuration = totalSeconds >= 3600; // 1小时以上

  return (
    <div className={styles.stopwatch}>
      <div
        className={`${styles.time} ${stopwatch.isActive ? styles.running : ""}`}
        aria-live="polite"
      >
        {localElapsedTime === 0 ? <span className={styles.placeholder}>00:00:00</span> : timeString}
      </div>

      {localElapsedTime > 0 && !stopwatch.isActive && <div className={styles.status}>已暂停</div>}

      {isLongDuration && <div className={styles.milestone}>🎉 已超过1小时！</div>}
    </div>
  );
}
