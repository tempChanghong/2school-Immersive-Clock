import React, { useEffect, useState } from "react";
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
  
  // We process the queue by taking the oldest info notification
  const infoNotifications = notifications.filter(n => n.level === "info");
  const activeNotification = infoNotifications[infoNotifications.length - 1]; 
  
  useEffect(() => {
    if (activeNotification && !isVisible && (!displayNotif || displayNotif.id !== activeNotification.id)) {
      setDisplayNotif(activeNotification);
      
      const showTimer = setTimeout(() => {
        setIsVisible(true);
        const settings = getAppSettings().general.classworks;
        if (settings.soundEnabled) {
          playInfoSound();
        }
      }, 100);
      
      const hideTimer = setTimeout(() => {
        setIsVisible(false);
        setTimeout(() => {
          dispatch({ type: "DISMISS_NOTIFICATION", payload: activeNotification.id });
          setDisplayNotif(null);
        }, 500); // Wait for transition
      }, 5000); // 5 seconds display time
      
      return () => {
        clearTimeout(showTimer);
        clearTimeout(hideTimer);
      };
    }
  }, [activeNotification, isVisible, displayNotif, dispatch]);
  
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
