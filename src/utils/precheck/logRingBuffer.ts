/**
 * 环形日志缓冲区
 * 保留最近 N 条预检日志（包括 debug/info），用于诊断报告导出
 */
import { PrecheckLogEntry } from "./precheckTypes";

const MAX_ENTRIES = 500;
const buffer: PrecheckLogEntry[] = [];

export function pushLog(entry: PrecheckLogEntry): void {
  buffer.push(entry);
  if (buffer.length > MAX_ENTRIES) {
    buffer.splice(0, buffer.length - MAX_ENTRIES);
  }
}

export function getLogSnapshot(): ReadonlyArray<PrecheckLogEntry> {
  return buffer.slice();
}

export function queryLogs(filter: {
  module?: string;
  level?: PrecheckLogEntry["level"];
  since?: number;
  traceId?: string;
}): PrecheckLogEntry[] {
  let result = buffer.slice();
  if (filter.module) {
    result = result.filter((e) => e.module === filter.module);
  }
  if (filter.level) {
    result = result.filter((e) => e.level === filter.level);
  }
  if (filter.since) {
    result = result.filter((e) => e.ts >= filter.since!);
  }
  if (filter.traceId) {
    result = result.filter((e) => e.traceId === filter.traceId);
  }
  return result;
}

export function exportLogsJson(): string {
  return JSON.stringify(buffer.slice(), null, 2);
}

export function clearLogBuffer(): void {
  buffer.length = 0;
}
