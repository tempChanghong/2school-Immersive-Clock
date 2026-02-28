import { AlertCircle, Check } from "lucide-react";
import React, { useEffect, useState } from "react";

import { useAppState, useAppDispatch } from "../../contexts/AppContext";
import { socketService } from "../../services/socketService";
import { ClassworksNotification } from "../../types/classworks";
import { getAppSettings } from "../../utils/appSettings";

import styles from "./UrgentNotificationModal.module.css";

const playUrgentSound = () => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    // Urgent attention sound, but not deafening
    oscillator.frequency.setValueAtTime(440, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(880, audioContext.currentTime + 0.1);

    oscillator.type = "sine";

    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.2, audioContext.currentTime + 0.05);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.3);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);
  } catch (e) {
    console.warn("Failed to play urgent sound", e);
  }
};

export const UrgentNotificationModal: React.FC = () => {
  const { currentUrgentNotification } = useAppState();
  const dispatch = useAppDispatch();
  const [isVisible, setIsVisible] = useState(false);
  const [displayNotif, setDisplayNotif] = useState<ClassworksNotification | null>(null);

  useEffect(() => {
    if (currentUrgentNotification) {
      if (!displayNotif || displayNotif.id !== currentUrgentNotification.id) {
        setDisplayNotif(currentUrgentNotification);

        // Dispatch displayed receipt back to server
        if (currentUrgentNotification.id) {
          socketService.sendDisplayedReceipt(currentUrgentNotification.id);
        }

        // Optional: Hardware browser notification if supported and allowed
        if ("Notification" in window && Notification.permission === "granted") {
          const senderName = currentUrgentNotification.senderInfo?.deviceName || "系统通知";
          new Notification("🚨 强调通知", {
            body: `${currentUrgentNotification.message}\n来自: ${senderName}`,
            requireInteraction: true,
          });
        }

        // Play sound if configured
        const settings = getAppSettings().general.classworks;
        if (settings.soundEnabled) {
          playUrgentSound();
        }
      }

      const timer = setTimeout(() => setIsVisible(true), 50);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
      const timer = setTimeout(() => setDisplayNotif(null), 400); // Wait for transition
      return () => clearTimeout(timer);
    }
  }, [currentUrgentNotification, displayNotif]);

  if (!displayNotif && !isVisible) return null;

  const handleDismiss = () => {
    setIsVisible(false);

    // Dispatch read receipt back to server
    if (displayNotif?.id) {
      socketService.sendReadReceipt(displayNotif.id);
    }

    setTimeout(() => {
      dispatch({ type: "DISMISS_URGENT_NOTIFICATION" });
    }, 400);
  };

  const senderName =
    displayNotif?.senderInfo?.deviceName || displayNotif?.senderInfo?.deviceType || "系统发送";
  const timeString = new Date(displayNotif?.timestamp || Date.now()).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className={`${styles.overlay} ${isVisible ? styles.visible : ""}`}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <AlertCircle size={36} />
          <h2 className={styles.title}>强调通知</h2>
        </div>

        <div className={styles.sender}>来自: {senderName}</div>
        <div className={styles.message}>{displayNotif?.message}</div>
        <div className={styles.timestamp}>发布时间: {timeString}</div>

        <div className={styles.footer}>
          <button className={styles.button} onClick={handleDismiss}>
            <Check size={22} />
            我知道了
          </button>
        </div>
      </div>
    </div>
  );
};
