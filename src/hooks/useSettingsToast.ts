import { useCallback } from "react";

/**
 * Toast 通知选项
 * - `type`：通知类型（成功/错误/警告）
 * - `message`：显示的消息文本
 * - `duration`：自动消失时间（ms），默认 success:2000, error:5000, warning:4000
 */
export interface ToastOptions {
  type: "success" | "error" | "warning";
  message: string;
  duration?: number;
}

/**
 * 设置面板 Toast 通知 Hook
 * 通过自定义事件 `settings-toast` 分发通知，由 SettingsToast 组件负责渲染
 */
export function useSettingsToast() {
  const showToast = useCallback((options: ToastOptions) => {
    window.dispatchEvent(new CustomEvent("settings-toast", { detail: options }));
  }, []);

  const showSuccess = useCallback(
    (message: string) => {
      showToast({ type: "success", message, duration: 2000 });
    },
    [showToast]
  );

  const showError = useCallback(
    (message: string) => {
      showToast({ type: "error", message, duration: 5000 });
    },
    [showToast]
  );

  const showWarning = useCallback(
    (message: string) => {
      showToast({ type: "warning", message, duration: 4000 });
    },
    [showToast]
  );

  return { showToast, showSuccess, showError, showWarning };
}
