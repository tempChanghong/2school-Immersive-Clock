/**
 * 诊断报告生成器
 * 生成完整诊断报告供 AI 或开发者消费
 */
import { getAppSettings } from "../appSettings";
import { getErrorCenterRecords } from "../errorCenter";

import { getLogSnapshot } from "./logRingBuffer";
import { DiagnosticReport } from "./precheckTypes";
import { runSettingsIntegrityCheck } from "./settingsIntegrity";

function isElectronEnv(): boolean {
  try {
    return (
      typeof navigator !== "undefined" && navigator.userAgent.toLowerCase().includes("electron")
    );
  } catch {
    return false;
  }
}

function estimateLocalStorageSizeMB(): number {
  let totalSize = 0;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        totalSize += key.length + (localStorage.getItem(key)?.length || 0);
      }
    }
  } catch {
    return 0;
  }
  return (totalSize * 2) / (1024 * 1024);
}

export function generateDiagnosticReport(): DiagnosticReport {
  const version =
    typeof import.meta !== "undefined"
      ? (import.meta as unknown as { env?: { VITE_APP_VERSION?: string } }).env?.VITE_APP_VERSION ||
        "unknown"
      : "unknown";

  return {
    generatedAt: new Date().toISOString(),
    appVersion: version,
    recentLogs: getLogSnapshot() as DiagnosticReport["recentLogs"],
    errorCenterRecords: getErrorCenterRecords() as DiagnosticReport["errorCenterRecords"],
    appSettings: getAppSettings(),
    integrityReport: runSettingsIntegrityCheck(),
    environment: {
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
      isElectron: isElectronEnv(),
      localStorage: {
        keyCount: typeof localStorage !== "undefined" ? localStorage.length : 0,
        estimatedSizeMB: estimateLocalStorageSizeMB(),
      },
    },
  };
}

export function exportDiagnosticReportJson(): string {
  return JSON.stringify(generateDiagnosticReport(), null, 2);
}

export function copyDiagnosticReportToClipboard(): Promise<boolean> {
  const json = exportDiagnosticReportJson();
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(json).then(() => true);
  }
  return Promise.resolve(false);
}

const _global = typeof window !== "undefined" ? (window as unknown as Record<string, unknown>) : {};
if (typeof _global.__precheck === "undefined") {
  _global.__precheck = {
    generateReport: generateDiagnosticReport,
    exportJson: exportDiagnosticReportJson,
  };
}
