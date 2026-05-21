/**
 * 设置保存前后 diff 追踪
 * 在设置面板保存时记录 before/after 快照
 */
import { AppSettings } from "../appSettings";

import { createPrecheckLogger } from "./precheckLogger";

const log = createPrecheckLogger("Settings.Save");

export function traceSettingsSaveDiff(
  traceId: string,
  before: AppSettings,
  after: AppSettings,
  saveResults: Array<{ success: boolean; error?: string; quotaExceeded?: boolean }>
): void {
  const changedPaths = getSettingsChangedPaths(before, after);
  const failedResults = saveResults.filter((r) => !r.success);

  log.info("设置保存完成", {
    traceId,
    changedFieldsCount: changedPaths.length,
    changedFields: changedPaths,
    totalSavedActions: saveResults.length,
    failedActions: failedResults.length,
    failedDetails: failedResults.length > 0 ? failedResults : undefined,
  });
}

function getSettingsChangedPaths(before: AppSettings, after: AppSettings): string[] {
  const paths: string[] = [];

  function diff(a: Record<string, unknown>, b: Record<string, unknown>, prefix: string): void {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const key of keys) {
      const va = a[key];
      const vb = b[key];
      const currentPath = prefix ? `${prefix}.${key}` : key;

      if (va !== vb) {
        if (
          typeof va === "object" &&
          typeof vb === "object" &&
          va !== null &&
          vb !== null &&
          !Array.isArray(va) &&
          !Array.isArray(vb)
        ) {
          diff(va as Record<string, unknown>, vb as Record<string, unknown>, currentPath);
        } else {
          paths.push(currentPath);
        }
      }
    }
  }

  diff(
    before as unknown as Record<string, unknown>,
    after as unknown as Record<string, unknown>,
    ""
  );

  return paths;
}
