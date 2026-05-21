/**
 * 预检日志器 - 带模块标签的结构化日志
 * 在 dev 环境输出到 console，同时写入环形缓冲区以支持诊断导出
 */

import { logger as baseLogger } from "../logger";

import { pushLog } from "./logRingBuffer";
import { PrecheckLogEntry } from "./precheckTypes";

let traceSeq = 0;

function generateTraceId(): string {
  traceSeq += 1;
  return `${Date.now()}-${traceSeq.toString(36)}`;
}

function isDev(): boolean {
  return (
    (typeof import.meta !== "undefined" &&
      (import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV === true) ||
    process.env.NODE_ENV !== "production"
  );
}

const dev = isDev();

function createLogEntry(
  level: PrecheckLogEntry["level"],
  module: string,
  message: string,
  data?: Record<string, unknown>,
  action?: string
): PrecheckLogEntry {
  return {
    ts: Date.now(),
    level,
    module,
    action,
    message,
    data,
    traceId: generateTraceId(),
  };
}

export function createPrecheckLogger(module: string) {
  return {
    debug(message: string, data?: Record<string, unknown>, action?: string) {
      const entry = createLogEntry("debug", module, message, data, action);
      pushLog(entry);
      if (dev) {
        baseLogger.debug(`[${module}] ${message}`, data || "");
      }
    },
    info(message: string, data?: Record<string, unknown>, action?: string) {
      const entry = createLogEntry("info", module, message, data, action);
      pushLog(entry);
      if (dev) {
        baseLogger.info(`[${module}] ${message}`, data || "");
      }
    },
    warn(message: string, data?: Record<string, unknown>, action?: string) {
      const entry = createLogEntry("warn", module, message, data, action);
      pushLog(entry);
      baseLogger.warn(`[${module}] ${message}`, data || "");
    },
    error(message: string, data?: Record<string, unknown>, action?: string) {
      const entry = createLogEntry("error", module, message, data, action);
      pushLog(entry);
      baseLogger.error(`[${module}] ${message}`, data || "");
    },
  };
}

export type PrecheckLogger = ReturnType<typeof createPrecheckLogger>;
