import type { HomeworkItem } from "../types/classworks";
import { getAppSettings } from "../utils/appSettings";

/**
 * 格式化今天的日期为 YYYYMMDD
 */
export function getTodayDateString() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
}

/**
 * 构造请求头
 * 恢复为原版能够正常运行的双重兼容头部。
 */
function buildHeaders(siteKey?: string): Record<string, string> {
  const headers: Record<string, string> = {
    "Accept": "application/json",
  };
  
  if (siteKey) {
    headers["x-site-key"] = siteKey;
    headers["x-app-token"] = siteKey;
  }
  
  return headers;
}

/**
 * 获取作业列表，按照给定格式解析
 */
export async function fetchHomeworkData(): Promise<HomeworkItem[]> {
  const cwConfig = getAppSettings().general.classworks;
  const serverUrl = cwConfig.serverUrl || "https://kv-service.wuyuan.dev";
  const namespace = cwConfig.namespace;
  const siteKey = cwConfig.password;

  if (!cwConfig.enabled || !serverUrl || !namespace) {
    return [];
  }

  const dateStr = getTodayDateString();
  const dataKey = `classworks-data-${dateStr}`;

  try {
    const url = `${serverUrl.replace(/\/$/, '')}/kv/${dataKey}`;
    const headers = buildHeaders(siteKey);

    let response = await fetch(url, { headers });
    let isLegacy = false;

    // 如果新格式的每日数据不存在，尝试拉群原先 Immersive Clock 长期使用的旧版键名
    if (!response.ok && response.status === 404) {
      console.info(`No homework data found for today (${dataKey}), trying legacy key...`);
      const legacyKey = "classworks-config-homework-today";
      const legacyUrl = `${serverUrl.replace(/\/$/, '')}/kv/${legacyKey}`;
      response = await fetch(legacyUrl, { headers });
      isLegacy = true;

      if (!response.ok) {
        if (response.status === 404) {
          return [];
        }
        throw new Error(`Failed to fetch legacy homework: ${response.status} ${response.statusText}`);
      }
    } else if (!response.ok) {
      throw new Error(`Failed to fetch homework: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const itemsArray: HomeworkItem[] = [];

    if (isLegacy) {
      // 旧版数据格式: { "UUID1": { name: "Subject", content: "...", order: 1, type: "normal" } }
      for (const key in data) {
        if (typeof data[key] === "object" && data[key] !== null && data[key].name) {
          itemsArray.push({
            key: key,
            ...data[key]
          });
        }
      }
    } else {
      // 新版 Classworks 数据格式: { homework: { "Subject": { content: "...", ... } } }
      if (data && data.homework && typeof data.homework === "object") {
        let defaultOrder = 100;
        for (const subject in data.homework) {
          const itemObj = data.homework[subject];
          if (itemObj && typeof itemObj.content === "string") {
            itemsArray.push({
              key: subject,
              name: itemObj.name || subject,
              content: itemObj.content,
              order: typeof itemObj.order === "number" ? itemObj.order : defaultOrder++,
              type: itemObj.type || "normal",
              ...itemObj // Collect any other properties safely
            });
          }
        }
      }
    }

    return itemsArray.sort((a, b) => (a.order || 0) - (b.order || 0));
  } catch (error) {
    console.error("Error fetching homework data:", error);
    return [];
  }
}

/**
 * 测试作业板连通性
 */
export async function testHomeworkConnection(
  serverUrl: string,
  namespace: string,
  siteKey?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const url = `${serverUrl.replace(/\/$/, '')}/kv/_info`;
    const headers = buildHeaders(siteKey);

    const response = await fetch(url, { headers });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        return { success: false, error: "认证失败，请检查密码/Token是否正确" };
      }
      return { success: false, error: `服务器返回错误: ${response.status} ${response.statusText}` };
    }

    const data = await response.json();
    
    // ClassworksKV returns { device: {...} } for /_info in proxy mode
    if (data && data.device) {
      return { success: true };
    } else {
      // In case it's a direct connection and returns namespace info
      if (data && typeof data === "object") {
        return { success: true };
      }
      return { success: false, error: "连接成功，但数据格式不匹配预期规范" };
    }
  } catch (error: any) {
    if (error.message && error.message.includes("ISO-8859-1")) {
      return { success: false, error: "Token 或 命名空间 中包含不支持的中文字符，请使用拼音或标准的 UUID" };
    }
    return { success: false, error: error.message || "网络请求失败，请检查服务端地址" };
  }
}

/**
 * 获取作业板完整的原始数据
 */
export async function fetchRawClassworksData(dateStr?: string): Promise<any> {
  const cwConfig = getAppSettings().general.classworks;
  const serverUrl = cwConfig.serverUrl || "https://kv-service.wuyuan.dev";
  const namespace = cwConfig.namespace;
  const siteKey = cwConfig.password;

  if (!cwConfig.enabled || !serverUrl || !namespace) {
    return null;
  }

  const dateToFetch = dateStr || getTodayDateString();
  const dataKey = `classworks-data-${dateToFetch}`;

  try {
    const url = `${serverUrl.replace(/\/$/, "")}/kv/${dataKey}`;
    const headers = buildHeaders(siteKey);

    const response = await fetch(url, { headers });

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`Failed to fetch raw homework: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching raw homework data:", error);
    return null;
  }
}

/**
 * 保存作业板原始数据
 */
export async function saveClassworksData(dateStr: string, data: any): Promise<boolean> {
  const cwConfig = getAppSettings().general.classworks;
  const serverUrl = cwConfig.serverUrl || "https://kv-service.wuyuan.dev";
  const namespace = cwConfig.namespace;
  const siteKey = cwConfig.password;

  if (!cwConfig.enabled || !serverUrl || !namespace) {
    console.warn("Classworks save aborted (disabled or missing config).");
    return false;
  }

  const dataKey = `classworks-data-${dateStr}`;

  try {
    const url = `${serverUrl.replace(/\/$/, "")}/kv/${dataKey}`;
    const headers = buildHeaders(siteKey);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`Failed to save homework data: ${response.status} ${response.statusText}`);
    }

    return true;
  } catch (error) {
    console.error("Error saving classworks data:", error);
    return false;
  }
}

/**
 * 更新单科作业
 */
export async function updateHomeworkItem(dateStr: string, key: string, newContent: string): Promise<boolean> {
  const rawData = await fetchRawClassworksData(dateStr);
  if (!rawData) {
    console.warn("Failed to update homework item: raw data not found");
    return false;
  }

  if (!rawData.homework) {
    rawData.homework = {};
  }

  if (rawData.homework[key]) {
    rawData.homework[key].content = newContent;
  } else {
    rawData.homework[key] = {
      name: key,
      content: newContent,
      type: "normal",
      order: Object.keys(rawData.homework).length + 100,
    };
  }

  return await saveClassworksData(dateStr, rawData);
}


