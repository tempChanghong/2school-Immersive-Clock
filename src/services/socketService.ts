import { io, Socket } from "socket.io-client";
import { ClassworksNotification, NotificationLevel } from "../types/classworks";

type NotificationCallback = (notification: ClassworksNotification, rawEvent: any) => void;

class SocketService {
  private socket: Socket | null = null;
  private serverUrl: string | null = null;
  private currentToken: string | null = null;
  
  private notificationListeners: Set<NotificationCallback> = new Set();
  private urgentNoticeListeners: Set<NotificationCallback> = new Set();
  
  public connect(serverUrl: string, token?: string) {
    if (this.socket && this.serverUrl === serverUrl) {
      if (token && this.currentToken !== token) {
        if (this.currentToken) this.leaveToken(this.currentToken);
        this.joinToken(token);
        this.currentToken = token;
      }
      return;
    }
    
    this.disconnect();
    this.serverUrl = serverUrl;
    this.currentToken = token || null;
    
    // Ensure we strip trailing slashes for the serverUrl
    const url = serverUrl.replace(/\/$/, "");
    
    this.socket = io(url, {
      transports: ["polling", "websocket"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity
    });
    
    this.socket.on("connect", () => {
      console.log("[SocketService] Connected to Classworks server");
      if (this.currentToken) {
        this.joinToken(this.currentToken);
      }
    });
    
    this.socket.on("disconnect", (reason) => {
      console.log(`[SocketService] Disconnected. Reason: ${reason}`);
    });
    
    // Listen to normal notifications
    this.socket.on("notification", (data: any) => {
      console.log("[SocketService] Received notification:", data);
      const notification = this.mapEventToNotification(data, "info");
      this.notificationListeners.forEach(listener => listener(notification, data));
    });
    
    // Listen to urgent notices
    this.socket.on("urgent-notice", (data: any) => {
      console.log("[SocketService] Received urgent-notice:", data);
      const urgency = data?.content?.urgency === "info" ? "info" : "urgent";
      const notification = this.mapEventToNotification(data, urgency);
      this.urgentNoticeListeners.forEach(listener => listener(notification, data));
    });
  }
  
  public disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.serverUrl = null;
    this.currentToken = null;
  }
  
  public joinToken(token: string) {
    if (this.socket && this.socket.connected) {
      this.socket.emit("join-token", { token });
    }
  }
  
  public leaveToken(token: string) {
    if (this.socket && this.socket.connected) {
      this.socket.emit("leave-token", { token });
    }
  }
  
  public sendReadReceipt(notificationId: string) {
    if (!this.socket || !this.socket.connected) return;
    this.socket.emit("send-event", {
      type: "read-receipt",
      content: { notificationId }
    });
  }
  
  public sendDisplayedReceipt(notificationId: string) {
    if (!this.socket || !this.socket.connected) return;
    this.socket.emit("send-event", {
      type: "displayed-receipt",
      content: { notificationId }
    });
  }
  
  public onNotification(callback: NotificationCallback) {
    this.notificationListeners.add(callback);
    return () => this.notificationListeners.delete(callback);
  }
  
  public onUrgentNotice(callback: NotificationCallback) {
    this.urgentNoticeListeners.add(callback);
    return () => this.urgentNoticeListeners.delete(callback);
  }
  
  private mapEventToNotification(data: any, defaultLevel: NotificationLevel): ClassworksNotification {
    return {
      id: data?.content?.notificationId || data?.eventId || `notif-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      level: data?.content?.isUrgent ? "urgent" : defaultLevel,
      message: data?.content?.message || "收到一条新通知",
      timestamp: data?.timestamp || new Date().toISOString(),
      senderInfo: data?.senderInfo || data?.content?.senderInfo,
      eventId: data?.eventId
    };
  }
}

export const socketService = new SocketService();
