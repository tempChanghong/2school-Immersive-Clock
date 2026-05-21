import { getAppSettings, resetAppSettings, updateStudySettings } from "./appSettings";
import { logger } from "./logger";
import {
  BACKGROUND_INDEXEDDB_MARKER,
  saveBackgroundImageToIndexedDB,
} from "./studyBackgroundStorage";

const LEGACY_KEYS = [
  "quote-auto-refresh-interval",
  "quote-channels",
  "immersive-clock-announcement",
  "study-target-year",
  "countdown-type",
  "custom-countdown-name",
  "custom-countdown-date",
  "study-display",
  "study-countdown-items",
  "study-carousel-interval",
  "study-digit-color",
  "study-digit-opacity",
  "study-message-popup-enabled",
  "study-weather-alert-enabled",
  "study-minutely-precip-enabled",
  "study-numeric-font",
  "study-text-font",
  "noise-control-max-level-db",
  "noise-control-baseline-db",
  "noise-control-show-realtime-db",
  "noise-control-avg-window-sec",
  "study-bg-type",
  "study-bg-color",
  "study-bg-color-alpha",
  "study-bg-image",
  "noise-monitor-baseline",
  "noise-monitor-baseline-rms",
  "noise-report-auto-popup",
  "countdown-mode",
  // 旧版天气缓存键
  "weather.coords.lat",
  "weather.coords.lon",
  "weather.coords.source",
  "weather.coords.cachedAt",
  "weather.city",
  "weather.city.cachedAt",
  "weather.city.sig",
  "weather.locationId",
  "weather.address",
  "weather.address.source",
  "weather.address.cachedAt",
  "weather.address.sig",
  "weather.now.obsTime",
  "weather.now.text",
  "weather.now.temp",
  "weather.now.feelsLike",
  "weather.now.windDir",
  "weather.now.windScale",
  "weather.now.windSpeed",
  "weather.now.humidity",
  "weather.now.pressure",
  "weather.now.precip",
  "weather.now.vis",
  "weather.now.cloud",
  "weather.now.dew",
  "weather.refer.sources",
  "weather.refer.license",
  "weather.lastSuccessTs",
  "weather.refreshStatus",
  "weather.minutely.cache.v1",
  "weather.minutely.lastApiFetchAt",
  "weather.alert.lastTag",
];

type LegacyStudyPeriod = {
  id: string;
  startTime: string;
  endTime: string;
  name: string;
};

function isValidLegacyStudyPeriod(value: unknown): value is LegacyStudyPeriod {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    typeof v.startTime === "string" &&
    typeof v.endTime === "string" &&
    typeof v.name === "string"
  );
}

function readLegacyStudySchedule(): LegacyStudyPeriod[] | null {
  try {
    const raw = localStorage.getItem("study-schedule") ?? localStorage.getItem("studySchedule");
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    if (!parsed.every((p) => isValidLegacyStudyPeriod(p))) return null;
    return parsed;
  } catch {
    return null;
  }
}

function hasExplicitScheduleInRawAppSettings(rawSettings: string | null): boolean {
  if (!rawSettings) return false;
  try {
    const parsed = JSON.parse(rawSettings) as { study?: { schedule?: unknown } };
    return Array.isArray(parsed?.study?.schedule);
  } catch {
    return false;
  }
}

export async function initializeStorage() {
  logger.info("Initializing storage...");

  // 1. 检查是否存在 AppSettings
  const rawSettings = localStorage.getItem("AppSettings");
  const explicitScheduleExists = hasExplicitScheduleInRawAppSettings(rawSettings);
  if (!rawSettings) {
    logger.info("AppSettings not found. Creating default settings...");
    resetAppSettings();
  }

  // 2. 迁移：旧课程表键 -> AppSettings（避免被 legacy 清理误删）
  if (!explicitScheduleExists) {
    const legacySchedule = readLegacyStudySchedule();
    if (legacySchedule) {
      try {
        updateStudySettings({ schedule: legacySchedule });
        localStorage.removeItem("study-schedule");
        localStorage.removeItem("studySchedule");
        logger.info("Migrated legacy study schedule to AppSettings.");
      } catch (error) {
        logger.warn("Failed to migrate legacy study schedule:", error);
      }
    }
  }
  if (explicitScheduleExists) {
    localStorage.removeItem("study-schedule");
    localStorage.removeItem("studySchedule");
  }

  // 3. 清理历史存储键
  let cleanedCount = 0;
  LEGACY_KEYS.forEach((key) => {
    if (localStorage.getItem(key) !== null) {
      localStorage.removeItem(key);
      cleanedCount++;
    }
  });

  if (cleanedCount > 0) {
    logger.info(`Cleaned up ${cleanedCount} legacy storage keys.`);
  }

  // 3.5 迁移：背景图片 base64 → IndexedDB
  // 当 AppSettings 中 study.background.imageDataUrl 包含实际的 base64 图片数据时，
  // 将其迁移到 IndexedDB 并将 AppSettings 中的字段替换为标记值，
  // 从而释放 localStorage 配额空间
  try {
    const settings = getAppSettings();
    const bg = settings?.study?.background;
    if (
      bg &&
      bg.type === "image" &&
      typeof bg.imageDataUrl === "string" &&
      bg.imageDataUrl.length > 100 &&
      bg.imageDataUrl !== BACKGROUND_INDEXEDDB_MARKER &&
      bg.imageDataUrl.startsWith("data:image/")
    ) {
      const dataUrl = bg.imageDataUrl;
      // 尝试迁移到 IndexedDB
      try {
        await saveBackgroundImageToIndexedDB(dataUrl);
        // 迁移成功后更新 AppSettings
        updateStudySettings({
          background: { ...bg, imageDataUrl: BACKGROUND_INDEXEDDB_MARKER },
        });
        logger.info("背景图片已从 localStorage 迁移到 IndexedDB");
      } catch (migrateError) {
        // 迁移失败时保留原数据，下次启动重试
        logger.warn("背景图片迁移到 IndexedDB 失败，保留原 localStorage 数据:", migrateError);
        // 通过 Toast 通知用户
        window.dispatchEvent(
          new CustomEvent("settings-toast", {
            detail: {
              type: "warning",
              message: "背景图片存储优化失败，图片仍可使用但可能影响其他设置的保存。",
              duration: 8000,
            },
          })
        );
      }
    }
  } catch (bgMigrateError) {
    logger.warn("背景图片迁移检查失败:", bgMigrateError);
  }

  // 4. 校验配置完整性（简单检查）
  const currentSettings = getAppSettings();
  if (!currentSettings || !currentSettings.version) {
    logger.warn("AppSettings integrity check failed. Resetting...");
    resetAppSettings();
  }

  logger.info("Storage initialization complete.");
}
