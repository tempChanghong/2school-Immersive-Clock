import React, { useEffect, useState, useRef } from "react";
import { Bell } from "lucide-react";

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

export const NotificationPill: React.FC = () => {
  const { notifications } = useAppState();
  const dispatch = useAppDispatch();
  const [isVisible, setIsVisible] = useState(false);
  const [displayNotif, setDisplayNotif] = useState<any>(null);
  const timersRef = useRef<{ show?: number; hide?: number; dismiss?: number }>({});
  
  // We process the queue by taking the oldest info notification
  const infoNotifications = notifications.filter(n => n.level === "info");
  
  useEffect(() => {
    if (infoNotifications.length > 0 && !displayNotif) {
      setDisplayNotif(infoNotifications[0]);
    }
  }, [infoNotifications, displayNotif]);
  
  useEffect(() => {
    if (displayNotif) {
      const showTimer = window.setTimeout(() => {
        setIsVisible(true);
        const settings = getAppSettings().general.classworks;
        if (settings.soundEnabled) {
          playInfoSound();
        }
      }, 50);
      
      const hideTimer = window.setTimeout(() => {
        setIsVisible(false);
      }, 5000); // 5 seconds display time
      
      const dismissTimer = window.setTimeout(() => {
        dispatch({ type: "DISMISS_NOTIFICATION", payload: displayNotif.id });
        setDisplayNotif(null);
      }, 5500); // Wait for exit transition
      
      timersRef.current = { show: showTimer, hide: hideTimer, dismiss: dismissTimer };
      
      return () => {
        window.clearTimeout(timersRef.current.show);
        window.clearTimeout(timersRef.current.hide);
        window.clearTimeout(timersRef.current.dismiss);
      };
    } else {
      setIsVisible(false);
    }
  }, [displayNotif, dispatch]);
  
  if (!displayNotif) return null;
  
  const senderName = displayNotif.senderInfo?.deviceName || "系统通知";
  
  return (
    <div className={`${styles.pillContainer} ${isVisible ? styles.visible : ""}`}>
      <div className={styles.iconWrapper}>
        <Bell size={18} />
      </div>
      <div className={styles.content}>
        <span className={styles.sender}>{senderName}:</span>
        <span className={styles.message}>{displayNotif.message}</span>
      </div>
    </div>
  );
};
