import type { HomeworkItem } from "../types/classworks";
import { getAppSettings } from "../utils/appSettings";

/**
 * 格式化今天的日期为 YYYYMMDD
 */
function getTodayDateString() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
}

/**
 * 构造请求头
 */
function buildHeaders(siteKey?: string): Record<string, string> {
  const headers: Record<string, string> = {
    "Accept": "application/json"
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

    const response = await fetch(url, { headers });

    if (!response.ok) {
      if (response.status === 404) {
        console.info(`No homework data found for today (${dataKey}).`);
        return [];
      }
      throw new Error(`Failed to fetch homework: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const itemsArray: HomeworkItem[] = [];

    // Fetch the data. It contains "homework" and "attendance" properties
    if (data && data.homework && typeof data.homework === "object") {
      let defaultOrder = 100;
      for (const subject in data.homework) {
        const itemObj = data.homework[subject];
        if (itemObj && typeof itemObj.content === "string" && itemObj.content.trim() !== "") {
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

    return itemsArray;
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
    
    // ClassworksKV returns { device: {...} } for /_info
    if (data && data.device) {
      return { success: true };
    } else {
      return { success: false, error: "连接成功，但返回数据格式不符合预期的 ClassworksKV 规范" };
    }
  } catch (error: any) {
    return { success: false, error: error.message || "网络请求失败，请检查服务端地址" };
  }
}

