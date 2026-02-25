import React, { useEffect, useState, useCallback } from "react";
import { X, RefreshCw } from "lucide-react";

import { useAppState } from "../../contexts/AppContext";
import { fetchHomeworkData } from "../../services/classworksService";
import type { HomeworkItem } from "../../types/classworks";

import styles from "./HomeworkBoard.module.css";

interface HomeworkBoardProps {
  isOpen: boolean;
  onClose: () => void;
}

export function HomeworkBoard({ isOpen, onClose }: HomeworkBoardProps) {
  const { study } = useAppState(); // We can add mapping of refresh intervals here if needed later.
  const [data, setData] = useState<HomeworkItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await fetchHomeworkData();
      setData(items);
      setLastUpdated(new Date());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load homework data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, loadData]);

  // Handle Escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent click from propagating to ClockPage
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const splitContent = (content: string) => {
    if (!content) return [];
    return content.split("\n").filter((line) => line.trim().length > 0);
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className={styles.overlay} onClick={handleOverlayClick} aria-label="作业板遮罩">
      <div
        className={styles.boardContainer}
        role="dialog"
        aria-label="作业板"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <div className={styles.titleArea}>
            <h2 className={styles.title}>作业板 (Homework)</h2>
            <div className={styles.statusInfo}>
              {loading ? (
                <span className={styles.loadingText}>更新中...</span>
              ) : (
                <span className={styles.updateTime}>
                  最后更新: {lastUpdated ? lastUpdated.toLocaleTimeString() : "未知"}
                </span>
              )}
            </div>
          </div>
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.iconBtn}
              onClick={loadData}
              title="刷新作业台"
              disabled={loading}
            >
              <RefreshCw size={20} className={loading ? styles.spinning : ""} />
            </button>
            <button type="button" className={styles.iconBtn} onClick={onClose} title="关闭">
              <X size={24} />
            </button>
          </div>
        </div>

        <div className={styles.contentArea}>
          {error ? (
            <div className={styles.errorState}>
              <p>无法获取作业数据</p>
              <span className={styles.errorMsg}>{error}</span>
            </div>
          ) : data.length === 0 && !loading ? (
            <div className={styles.emptyState}>
              <p>今天没有作业记录哦~</p>
              <span className={styles.emptyHint}>可能是放假，或者后端暂未配置</span>
            </div>
          ) : (
            <div className={styles.masonryGrid}>
              {data.map((item) => (
                <div key={item.key} className={styles.card}>
                  <div className={styles.cardHeader}>
                    <h3 className={styles.cardTitle}>{item.name}</h3>
                    {item.type && item.type !== "normal" && (
                      <span className={styles.cardBadge}>{item.type}</span>
                    )}
                  </div>
                  <div className={styles.cardBody}>
                    <ul className={styles.taskList}>
                      {splitContent(item.content).map((line, idx) => (
                        <li key={`${item.key}-line-${idx}`} className={styles.taskItem}>
                          {line}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
