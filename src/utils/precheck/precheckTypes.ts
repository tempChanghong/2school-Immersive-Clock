/**
 * 预检系统共享类型定义
 */

export interface PrecheckLogEntry {
  ts: number;
  level: "debug" | "info" | "warn" | "error";
  module: string;
  action?: string;
  message: string;
  data?: Record<string, unknown>;
  traceId?: string;
}

export interface DiagnosticReport {
  generatedAt: string;
  appVersion: string;
  recentLogs: PrecheckLogEntry[];
  errorCenterRecords: unknown[];
  appSettings: unknown;
  integrityReport: IntegrityReport | null;
  environment: {
    userAgent: string;
    isElectron: boolean;
    localStorage: {
      keyCount: number;
      estimatedSizeMB: number;
    };
  };
}

export interface IntegrityCheck {
  name: string;
  status: "pass" | "warn" | "fail";
  message: string;
  details?: unknown;
}

export interface IntegrityReport {
  timestamp: number;
  status: "healthy" | "degraded" | "corrupted";
  checks: IntegrityCheck[];
}

export interface ReducedActionLog {
  ts: number;
  actionType: string;
  payload?: unknown;
  changedPaths: string[];
  traceId: string;
}

export interface SettingsEventLog {
  ts: number;
  eventName: string;
  detail?: unknown;
}
