import React, { useEffect, useState, useCallback } from "react";
import { X, RefreshCw, Expand } from "lucide-react";

import { useAppState } from "../../contexts/AppContext";
import { fetchHomeworkData, updateHomeworkItem, getTodayDateString } from "../../services/classworksService";
import type { HomeworkItem } from "../../types/classworks";
import { getAppSettings } from "../../utils/appSettings";

import styles from "./HomeworkBoard.module.css";
import { ExpandedHomeworkBoard } from "./ExpandedHomeworkBoard";

interface HomeworkBoardProps {
  isOpen: boolean;
}

export const HomeworkBoard: React.FC<HomeworkBoardProps> = ({ isOpen }) => {
  const { study } = useAppState(); // We can add mapping of refresh intervals here if needed later.
  const [data, setData] = useState<HomeworkItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

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

  const handleSaveItem = async (key: string, newContent: string) => {
    const success = await updateHomeworkItem(getTodayDateString(), key, newContent);
    if (success) {
      await loadData();
      return true;
    }
    return false;
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
      
      const refreshSec = getAppSettings().general.classworks.autoRefreshIntervalSec || 30;
      // Minimum 5 seconds to prevent extremely fast API requests
      const intervalMs = Math.max(5, refreshSec) * 1000;
      
      const timerId = setInterval(loadData, intervalMs);
      return () => clearInterval(timerId);
    }
  }, [isOpen, loadData]);

  const splitContent = (content: string) => {
    if (!content) return [];
    return content.split("\n").filter((line) => line.trim().length > 0);
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className={styles.boardContainer}
      role="region"
      aria-label="作业板"
    >
      <div className={styles.header}>
          <div className={styles.titleArea}>
            <h2 className={styles.title}>作业板</h2>
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
              onClick={() => setIsExpanded(true)}
              title="展开作业板"
            >
              <Expand size={20} />
            </button>
            <button
              type="button"
              className={styles.iconBtn}
              onClick={loadData}
              title="刷新作业"
              disabled={loading}
            >
              <RefreshCw size={20} className={loading ? styles.spinning : ""} />
            </button>
          </div>
        </div>

        <div className={styles.contentArea}>
          {error ? (
            <div className={styles.errorState}>
              <p>无法获取作业数据</p>
              <span className={styles.errorMsg}>{error}</span>
            </div>
          ) : data.filter((item) => (item.type && item.type !== "normal" && item.type !== "custom") || (item.content && item.content.trim().length > 0)).length === 0 && !loading ? (
            <div className={styles.emptyState}>
              <p>今天没有作业记录哦~</p>
              <span className={styles.emptyHint}>可能是放假，或者后端暂未配置</span>
            </div>
          ) : (
            <div className={styles.masonryGrid}>
              {data.filter((item) => (item.type && item.type !== "normal" && item.type !== "custom") || (item.content && item.content.trim().length > 0)).map((item) => (
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
      <ExpandedHomeworkBoard 
        isOpen={isExpanded} 
        onClose={() => setIsExpanded(false)} 
        data={data} 
        onSaveItem={handleSaveItem}
      />
    </div>
  );
};
