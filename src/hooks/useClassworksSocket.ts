import { useEffect } from "react";
import { useAppState, useAppDispatch } from "../contexts/AppContext";
import { socketService } from "../services/socketService";
import { getAppSettings } from "../utils/appSettings";
import { ClassworksNotification } from "../types/classworks";

export function useClassworksSocket() {
  const { isHomeworkEnabled } = useAppState();
  const dispatch = useAppDispatch();

  useEffect(() => {
    // Only attempt to connect if homework is globally enabled in AppState
    if (!isHomeworkEnabled) {
      socketService.disconnect();
      return;
    }

    const classworksSettings = getAppSettings().general.classworks;
    
    // Check if notifications are enabled
    if (!classworksSettings.enabled || !classworksSettings.notificationsEnabled) {
      socketService.disconnect();
      return;
    }
    
    // Establish connection if we have a server URL
    if (classworksSettings.serverUrl) {
      socketService.connect(classworksSettings.serverUrl, classworksSettings.password);
    }
    
    const handleNotification = (notification: ClassworksNotification) => {
      dispatch({ type: "ADD_NOTIFICATION", payload: notification });
    };
    
    const unsubscribeNotif = socketService.onNotification(handleNotification);
    const unsubscribeUrgent = socketService.onUrgentNotice(handleNotification);
    
    return () => {
      unsubscribeNotif();
      unsubscribeUrgent();
      // Disconnect when component using the hook unmounts 
      // (e.g., navigating to settings) to ensure fresh connection with new settings upon return.
      socketService.disconnect();
    };
  }, [isHomeworkEnabled, dispatch]);
  
  return socketService;
}
