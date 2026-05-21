/**
 * Settings 完整性校验
 * 启动时自动检查配置完整性，输出健康报告
 */
import { getAppSettings } from "../appSettings";

import { createPrecheckLogger } from "./precheckLogger";
import type { IntegrityCheck, IntegrityReport } from "./precheckTypes";

const log = createPrecheckLogger("IntegrityCheck");

const COLOR_HEX_RE = /^#[0-9a-fA-F]{3,8}$/;

function checkSettingsReadable(): IntegrityCheck {
  try {
    const settings = getAppSettings();
    if (settings && typeof settings === "object") {
      return { name: "AppSettings 可读性", status: "pass", message: "可以正常读取" };
    }
    return {
      name: "AppSettings 可读性",
      status: "fail",
      message: "读取失败，返回非对象",
    };
  } catch (err) {
    return {
      name: "AppSettings 可读性",
      status: "fail",
      message: `读取异常: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

function checkSettingsVersion(): IntegrityCheck {
  try {
    const settings = getAppSettings();
    if (typeof settings.version === "number" && settings.version >= 1) {
      return {
        name: "版本号",
        status: "pass",
        message: `版本: ${settings.version}`,
        details: { version: settings.version },
      };
    }
    return {
      name: "版本号",
      status: "warn",
      message: "版本号缺失或无效",
    };
  } catch (err) {
    return {
      name: "版本号",
      status: "fail",
      message: `检查异常: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

function checkRequiredFields(): IntegrityCheck {
  const missingFields: string[] = [];
  try {
    const settings = getAppSettings();

    if (!settings.general) missingFields.push("general");
    if (!settings.study) missingFields.push("study");
    if (!settings.performance) missingFields.push("performance");
    if (!settings.noiseControl) missingFields.push("noiseControl");

    if (missingFields.length === 0) {
      return {
        name: "必要字段完整性",
        status: "pass",
        message: "所有必要分区存在",
      };
    }
    return {
      name: "必要字段完整性",
      status: "fail",
      message: `缺失分区: ${missingFields.join(", ")}`,
      details: { missingFields },
    };
  } catch (err) {
    return {
      name: "必要字段完整性",
      status: "fail",
      message: `检查异常: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

function checkColorValues(): IntegrityCheck {
  const invalidColors: string[] = [];
  try {
    const settings = getAppSettings();
    const style = settings.study.style;

    const colorFields: Array<{ name: string; value: string | undefined }> = [
      { name: "study.style.digitColor", value: style.digitColor },
      { name: "study.style.textColor", value: style.textColor },
      { name: "study.style.timeColor", value: style.timeColor },
      { name: "study.style.dateColor", value: style.dateColor },
    ];

    for (const field of colorFields) {
      if (field.value !== undefined && field.value !== null && !COLOR_HEX_RE.test(field.value)) {
        invalidColors.push(`${field.name}: ${field.value}`);
      }
    }

    const items = settings.study.countdownItems || [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      for (const key of ["bgColor", "textColor", "digitColor"] as const) {
        const v = item[key];
        if (v !== undefined && v !== null && !COLOR_HEX_RE.test(v)) {
          invalidColors.push(`countdownItems[${i}].${key}: ${v}`);
        }
      }
    }

    if (invalidColors.length === 0) {
      return {
        name: "颜色值格式",
        status: "pass",
        message: "所有颜色值格式正确",
      };
    }
    return {
      name: "颜色值格式",
      status: "warn",
      message: `${invalidColors.length} 个颜色值格式不正确`,
      details: { invalidColors },
    };
  } catch (err) {
    return {
      name: "颜色值格式",
      status: "fail",
      message: `检查异常: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

function checkStorageQuota(): IntegrityCheck {
  try {
    let totalSize = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        totalSize += key.length + (localStorage.getItem(key)?.length || 0);
      }
    }
    const totalSizeMB = (totalSize * 2) / (1024 * 1024);
    if (totalSizeMB > 4) {
      return {
        name: "存储容量",
        status: "warn",
        message: `localStorage 使用: ${totalSizeMB.toFixed(2)} MB (接近限制)`,
        details: { localStorageMB: parseFloat(totalSizeMB.toFixed(2)) },
      };
    }
    return {
      name: "存储容量",
      status: "pass",
      message: `localStorage 使用: ${totalSizeMB.toFixed(2)} MB`,
      details: { localStorageMB: parseFloat(totalSizeMB.toFixed(2)) },
    };
  } catch (err) {
    return {
      name: "存储容量",
      status: "fail",
      message: `检查异常: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

function checkCountdownItems(): IntegrityCheck {
  try {
    const settings = getAppSettings();
    const items = settings.study.countdownItems || [];

    if (!Array.isArray(items)) {
      return {
        name: "倒计时项目结构",
        status: "fail",
        message: "countdownItems 不是数组",
      };
    }

    const issues: string[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.id) issues.push(`items[${i}].id 缺失`);
      if (item.kind !== "gaokao" && item.kind !== "custom")
        issues.push(`items[${i}].kind 无效: ${item.kind}`);
      if (item.kind === "custom" && !item.targetDate)
        issues.push(`items[${i}].targetDate 缺失 (custom 类型必须)`);
    }

    if (issues.length === 0) {
      return {
        name: "倒计时项目结构",
        status: "pass",
        message: `${items.length} 个项目，结构正常`,
        details: { count: items.length },
      };
    }
    return {
      name: "倒计时项目结构",
      status: "warn",
      message: `${issues.length} 个结构问题`,
      details: { issues },
    };
  } catch (err) {
    return {
      name: "倒计时项目结构",
      status: "fail",
      message: `检查异常: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

function checkContextSettingsConsistency(contextState: {
  study: {
    textColor?: string;
    digitColor?: string;
    textOpacity?: number;
    digitOpacity?: number;
    timeColor?: string;
    dateColor?: string;
  };
}): IntegrityCheck {
  try {
    const settings = getAppSettings();
    const study = contextState.study;
    const style = settings.study.style;

    const mismatches: string[] = [];

    const pairs: Array<{ name: string; ctx: unknown; settings: unknown }> = [
      { name: "textColor", ctx: study.textColor, settings: style.textColor },
      { name: "digitColor", ctx: study.digitColor, settings: style.digitColor },
      { name: "timeColor", ctx: study.timeColor, settings: style.timeColor },
      { name: "dateColor", ctx: study.dateColor, settings: style.dateColor },
    ];

    for (const pair of pairs) {
      if (pair.ctx !== pair.settings) {
        mismatches.push(
          `${pair.name}: Context=${String(pair.ctx ?? "undefined")} vs Settings=${String(pair.settings ?? "undefined")}`
        );
      }
    }

    if (mismatches.length === 0) {
      return {
        name: "Context ↔ Settings 一致性",
        status: "pass",
        message: "内存状态与持久化状态一致",
      };
    }
    return {
      name: "Context ↔ Settings 一致性",
      status: "warn",
      message: `发现 ${mismatches.length} 处不一致`,
      details: { mismatches },
    };
  } catch (err) {
    return {
      name: "Context ↔ Settings 一致性",
      status: "fail",
      message: `检查异常: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

function deriveOverallStatus(checks: IntegrityCheck[]): IntegrityReport["status"] {
  if (checks.some((c) => c.status === "fail")) return "corrupted";
  if (checks.some((c) => c.status === "warn")) return "degraded";
  return "healthy";
}

export function runSettingsIntegrityCheck(): IntegrityReport {
  const checks: IntegrityCheck[] = [];

  checks.push(checkSettingsReadable());
  checks.push(checkSettingsVersion());
  checks.push(checkRequiredFields());
  checks.push(checkColorValues());
  checks.push(checkStorageQuota());
  checks.push(checkCountdownItems());

  const status = deriveOverallStatus(checks);

  const report: IntegrityReport = {
    timestamp: Date.now(),
    status,
    checks,
  };

  if (status !== "healthy") {
    log.warn("完整性检查发现问题", {
      status,
      failCount: checks.filter((c) => c.status === "fail").length,
      warnCount: checks.filter((c) => c.status === "warn").length,
    });
  }

  return report;
}

export function runFullIntegrityCheck(
  contextState?: Parameters<typeof checkContextSettingsConsistency>[0]
): IntegrityReport {
  const report = runSettingsIntegrityCheck();
  if (contextState) {
    report.checks.push(checkContextSettingsConsistency(contextState));
    report.status = deriveOverallStatus(report.checks);
  }
  return report;
}
