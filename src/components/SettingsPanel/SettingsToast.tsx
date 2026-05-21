import React, { useEffect, useState, useCallback, useRef } from "react";
import { createPortal } from "react-dom";

import { logger } from "../../utils/logger";

import styles from "./SettingsToast.module.css";

interface ToastItem {
  id: number;
  type: "success" | "error" | "warning";
  message: string;
  duration: number;
  removing: boolean;
}

const DEFAULT_DURATIONS: Record<ToastItem["type"], number> = {
  success: 2000,
  error: 5000,
  warning: 4000,
};

/**
 * 设置面板 Toast 通知组件
 * 监听 `settings-toast` 自定义事件，以 Portal 方式渲染在页面上方
 * 支持 success / error / warning 三种类型，自动消失并支持手动关闭
 */
export function SettingsToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  /** 在移除动画完成后真正删除 toast */
  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  /** 开始淡出动画，动画结束后移除 */
  const startRemoving = useCallback(
    (id: number) => {
      setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, removing: true } : t)));
      setTimeout(() => removeToast(id), 300);
    },
    [removeToast]
  );

  /** 添加新的 toast 通知并设置自动消失定时器 */
  const addToast = useCallback(
    (options: { type: ToastItem["type"]; message: string; duration?: number }) => {
      const id = ++idRef.current;
      const duration = options.duration ?? DEFAULT_DURATIONS[options.type];
      const newToast: ToastItem = {
        id,
        type: options.type,
        message: options.message,
        duration,
        removing: false,
      };
      setToasts((prev) => [...prev, newToast]);

      if (duration > 0) {
        setTimeout(() => startRemoving(id), duration);
      }
    },
    [startRemoving]
  );

  useEffect(() => {
    const handler = (evt: Event) => {
      try {
        const detail = (evt as CustomEvent).detail as {
          type?: string;
          message?: string;
          duration?: number;
        };
        if (detail && typeof detail.message === "string" && detail.message.trim().length > 0) {
          const type =
            detail.type === "success" || detail.type === "error" || detail.type === "warning"
              ? detail.type
              : "success";
          addToast({
            type,
            message: detail.message.trim(),
            duration: detail.duration,
          });
        }
      } catch (error) {
        logger.warn("处理 settings-toast 事件失败:", error);
      }
    };

    window.addEventListener("settings-toast", handler as EventListener);
    return () => window.removeEventListener("settings-toast", handler as EventListener);
  }, [addToast]);

  if (toasts.length === 0) return null;

  const typeClass: Record<ToastItem["type"], string> = {
    success: styles.toastSuccess,
    error: styles.toastError,
    warning: styles.toastWarning,
  };

  const iconText: Record<ToastItem["type"], string> = {
    success: "✓",
    error: "✕",
    warning: "!",
  };

  const portalContent = (
    <div className={styles.toastContainer}>
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`${styles.toastItem} ${typeClass[t.type]} ${t.removing ? styles.removing : ""}`}
        >
          <span className={styles.toastIcon}>{iconText[t.type]}</span>
          <span className={styles.toastMessage}>{t.message}</span>
          <button
            className={styles.toastClose}
            onClick={() => startRemoving(t.id)}
            aria-label="关闭通知"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );

  return createPortal(portalContent, document.body);
}
