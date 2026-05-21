import { getAppSettings, SettingsSaveResult, updateAppSettings } from "./appSettings";
import { bgDb } from "./db";
import { logger } from "./logger";

export type StudyBackgroundType = "default" | "color" | "image";

export interface StudyBackgroundSettings {
  type: StudyBackgroundType;
  color?: string;
  /** 颜色透明度（0-1，仅当type=color有效） */
  colorAlpha?: number;
  /** 背景图片 data URL（仅当type=image有效），当使用 IndexedDB 存储时此值为空或占位符 */
  imageDataUrl?: string;
}

/** IndexedDB 中存储的背景图片 key */
const BG_IMAGE_KEY = "current-background";

/** IndexedDB 中背景图片存储的标记值，表示图片已迁移到 IndexedDB */
export const BACKGROUND_INDEXEDDB_MARKER = "indexeddb";

interface BackgroundImageRecord {
  id: string;
  dataUrl: string;
  storedAt: number;
}

function isValidHexColor(hex: string): boolean {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(hex);
}

/**
 * 读取当前背景设置
 */
export function readStudyBackground(): StudyBackgroundSettings {
  return getAppSettings().study.background;
}

/**
 * 保存背景设置到 AppSettings
 * 注意：当 type="image" 时，实际图片数据应通过 saveBackgroundImageToIndexedDB 存入 IndexedDB，
 * 此处不再将 base64 图片数据写入 localStorage
 * 返回保存结果，调用方可据此向用户提供反馈
 */
export function saveStudyBackground(settings: StudyBackgroundSettings): SettingsSaveResult {
  const type = settings.type ?? "default";

  const newBackground: StudyBackgroundSettings = { type };

  if (type === "color" && settings.color && isValidHexColor(settings.color)) {
    newBackground.color = settings.color;
    newBackground.colorAlpha =
      typeof settings.colorAlpha === "number" ? Math.max(0, Math.min(1, settings.colorAlpha)) : 1;
  } else if (type === "image") {
    newBackground.imageDataUrl = settings.imageDataUrl;
  }

  return updateAppSettings((current) => ({
    study: {
      ...current.study,
      background: newBackground,
    },
  }));
}

/**
 * 重置背景设置为默认
 * 返回保存结果，调用方可据此向用户提供反馈
 */
export function resetStudyBackground(): SettingsSaveResult {
  return updateAppSettings((current) => ({
    study: {
      ...current.study,
      background: { type: "default" },
    },
  }));
}

/**
 * 将背景图片压缩后的 data URL 存入 IndexedDB
 * 存入后调用方应将 AppSettings 中的 imageDataUrl 设为 BACKGROUND_INDEXEDDB_MARKER
 * @param dataUrl 压缩后的图片 data URL
 */
export async function saveBackgroundImageToIndexedDB(dataUrl: string): Promise<void> {
  const record: BackgroundImageRecord = {
    id: BG_IMAGE_KEY,
    dataUrl,
    storedAt: Date.now(),
  };
  await bgDb.set(BG_IMAGE_KEY, record);
}

/**
 * 从 IndexedDB 加载背景图片 data URL
 * @returns 存储的图片 data URL，或 null（未存储/出错）
 */
export async function loadBackgroundImageFromIndexedDB(): Promise<string | null> {
  try {
    const record = await bgDb.get<BackgroundImageRecord>(BG_IMAGE_KEY);
    if (record && typeof record.dataUrl === "string" && record.dataUrl.length > 0) {
      return record.dataUrl;
    }
    return null;
  } catch (error) {
    logger.warn("从 IndexedDB 加载背景图片失败:", error);
    return null;
  }
}

/**
 * 从 IndexedDB 中清除背景图片
 */
export async function clearBackgroundImageFromIndexedDB(): Promise<void> {
  try {
    await bgDb.del(BG_IMAGE_KEY);
  } catch (error) {
    logger.warn("清除 IndexedDB 背景图片失败:", error);
  }
}

/**
 * 估算当前网站存储用量
 * 使用 navigator.storage.estimate() 获取已用和配额信息
 * @returns 已用和配额字节数，或 null（浏览器不支持）
 */
export async function estimateStorageUsage(): Promise<{ used: number; quota: number } | null> {
  if (!navigator.storage || typeof navigator.storage.estimate !== "function") {
    return null;
  }
  try {
    const estimate = await navigator.storage.estimate();
    if (estimate.usage != null && estimate.quota != null) {
      return { used: estimate.usage, quota: estimate.quota };
    }
    return null;
  } catch {
    return null;
  }
}
