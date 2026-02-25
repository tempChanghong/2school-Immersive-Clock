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
    const url = `${serverUrl.replace(/\/$/, '')}/kv/${namespace}/${dataKey}`;
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

    // The new response format is: { homework: { "Subject": { content: "..." }, ... } }
    if (data && data.homework && typeof data.homework === "object") {
      let orderIndex = 0;
      for (const subject in data.homework) {
        const itemObj = data.homework[subject];
        if (itemObj && typeof itemObj.content === "string") {
          itemsArray.push({
            key: subject, // subject as unique key
            name: subject,
            content: itemObj.content,
            order: orderIndex++,
            type: "normal"
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
    const dateStr = getTodayDateString();
    const dataKey = `classworks-data-${dateStr}`;
    const url = `${serverUrl.replace(/\/$/, '')}/kv/${namespace}/${dataKey}`;
    const headers = buildHeaders(siteKey);

    const response = await fetch(url, { headers });

    if (!response.ok) {
      if (response.status === 404) {
        return { success: false, error: "能连接上服务器，但当前命名空间下没有今天的作业数据 (404 Not Found)" };
      }
      if (response.status === 401 || response.status === 403) {
        return { success: false, error: "认证失败，请检查密码/Token是否正确" };
      }
      return { success: false, error: `服务器返回错误: ${response.status} ${response.statusText}` };
    }

    const data = await response.json();
    
    if (data && data.homework) {
      return { success: true };
    } else {
      return { success: false, error: "连接成功，但数据格式不匹配，未找到 homework 字段" };
    }
  } catch (error: any) {
    return { success: false, error: error.message || "网络请求失败，请检查服务端地址" };
  }
}

