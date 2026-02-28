import { Bell } from "lucide-react";
import React, { useEffect, useState, useRef } from "react";

import { useAppState, useAppDispatch } from "../../contexts/AppContext";
import { getAppSettings } from "../../utils/appSettings";

import styles from "./NotificationPill.module.css";

const playInfoSound = () => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    // Make a gentle "pop" or "ding" sound, very unobtrusive
    oscillator.frequency.setValueAtTime(600, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(300, audioContext.currentTime + 0.2);

    oscillator.type = "sine";

    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.1, audioContext.currentTime + 0.05);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.3);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.4);
  } catch (e) {
    console.warn("Failed to play notification sound", e);
  }
};

const CloseIcon = ({ size = 24 }: { size?: number }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="18" y1="6" x2="6" y2="18"></line>
    <line x1="6" y1="6" x2="18" y2="18"></line>
  </svg>
);

const PillItem = ({ notif, index }: { notif: any; index: number }) => {
  const dispatch = useAppDispatch();
  const [isVisible, setIsVisible] = useState(false);
  const timersRef = useRef<{ show?: number }>({});

  useEffect(() => {
    const showTimer = window.setTimeout(() => {
      setIsVisible(true);
      if (index === 0) {
        const settings = getAppSettings().general.classworks;
        if (settings.soundEnabled) {
          playInfoSound();
        }
      }
    }, 50);

    timersRef.current = { show: showTimer };

    return () => {
      window.clearTimeout(timersRef.current.show);
    };
  }, [index]);

  const handleClose = () => {
    setIsVisible(false);
    // 动画延迟后从store移除
    setTimeout(() => {
      dispatch({ type: "DISMISS_NOTIFICATION", payload: notif.id });
    }, 300);
  };

  const senderName = notif.senderInfo?.deviceName || "系统通知";

  // 计算偏移与缩放效果，越靠后越小、越靠下（也可以重叠）。这里采用向下的多维叠放设计
  const offsetY = index * 60;
  const scale = 1 - index * 0.05;
  const opacity = 1 - index * 0.2;

  return (
    <div
      className={styles.pillItem}
      style={{
        transform: isVisible
          ? `translate(-50%, ${offsetY}px) scale(${scale})`
          : `translate(-50%, -150%) scale(1)`,
        opacity: isVisible ? Math.max(0, opacity) : 0,
        zIndex: 9999 - index,
      }}
    >
      <div className={styles.iconWrapper}>
        <Bell size={18} />
      </div>
      <div className={styles.content}>
        <span className={styles.sender}>{senderName}:</span>
        <span className={styles.message}>{notif.message}</span>
      </div>
      <button type="button" onClick={handleClose} className={styles.closeBtn} title="关闭通知">
        <CloseIcon size={16} />
      </button>
    </div>
  );
};

export const NotificationPill: React.FC = () => {
  const { notifications } = useAppState();

  // 取最前面（最老或最新视队列而定）的 3 个 info 级别消息
  const infoNotifications = notifications.filter((n) => n.level === "info").slice(0, 3);

  if (infoNotifications.length === 0) return null;

  return (
    <div className={styles.pillContainer}>
      {infoNotifications.map((notif, index) => (
        <PillItem key={notif.id} notif={notif} index={index} />
      ))}
    </div>
  );
};
