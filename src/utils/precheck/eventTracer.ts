/**
 * 事件追踪器 - 自动追踪设置相关事件的广播和接收
 */
import { SETTINGS_EVENTS } from "../settingsEvents";

import { createPrecheckLogger } from "./precheckLogger";

let tracerInitialized = false;

const log = createPrecheckLogger("EventTracer");

export function initEventTracer(): void {
  if (tracerInitialized) return;
  tracerInitialized = true;

  const originalAddEventListener = window.addEventListener;

  for (const eventName of Object.values(SETTINGS_EVENTS)) {
    window.addEventListener(eventName, (e: Event) => {
      const detail = (e as CustomEvent).detail;
      log.info(`事件接收: ${eventName}`, {
        eventName,
        detail: detail as Record<string, unknown> | undefined,
      });
    });
  }

  window.addEventListener("precheck:settingsWriteFailed", (e: Event) => {
    const detail = (e as CustomEvent).detail;
    log.warn("Settings 写入失败", {
      eventName: "precheck:settingsWriteFailed",
      detail: detail as Record<string, unknown> | undefined,
    });
  });

  _restoreOriginalAddEventListener(originalAddEventListener);
}

function _restoreOriginalAddEventListener(_original: typeof window.addEventListener): void {
  // noop - 占位，保持 API 对称性
}

export function traceEventDispatch(eventName: string, detail?: unknown): void {
  log.info(`事件广播: ${eventName}`, { eventName, detail });
}
